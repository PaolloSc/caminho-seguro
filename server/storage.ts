import { db } from "./db";
import {
  reports,
  comments,
  reportFlags,
  reportVerifications,
  users,
  auditLogs,
  userPreferences,
  type Report,
  type InsertReport,
  type Comment,
  type InsertComment,
  type ReportFlag,
  type InsertReportFlag,
  type User,
  type AuditLog,
  type UserPreferences,
  type UpdateUserPreferences
} from "@shared/schema";
import { eq, sql, lt, and, desc } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";

// === Funções de Hash para LGPD ===
function hashAnonymous(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET must be set and have at least 16 characters for secure hashing');
  }
  return crypto.createHash('sha256').update(value + secret).digest('hex').slice(0, 16);
}

// === Constantes de Validação ===
const USER_LEVELS = {
  novo: { maxReportsPerDay: 3, maxReportsPerHour: 2, daysToNormal: 7 },
  normal: { maxReportsPerDay: 10, maxReportsPerHour: 5, daysToVerified: 30 },
  verificado: { maxReportsPerDay: 20, maxReportsPerHour: 10 },
};

const VELOCITY_MAX_KMH = 120; // Velocidade máxima razoável em km/h
const SIMILARITY_THRESHOLD = 0.85; // 85% de similaridade para considerar duplicata
const DUPLICATE_RADIUS_METERS = 500; // Raio para buscar duplicatas

export interface IStorage {
  getReports(delayMinutes?: number): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(report: InsertReport & { userId: string }): Promise<Report>;
  verifyReport(id: number, userId: string): Promise<Report | undefined>;
  downvoteReport(id: number, userId: string): Promise<Report | undefined>;
  getUserVote(reportId: number, userId: string): Promise<string | null>;
  hasUserVerified(reportId: number, userId: string): Promise<boolean>;
  
  getComments(reportId: number): Promise<Comment[]>;
  createComment(comment: InsertComment & { userId: string }): Promise<Comment>;
  
  createReportFlag(flag: InsertReportFlag & { userId: string; reportId: number }): Promise<ReportFlag>;
  getUserReportCount(userId: string, hoursAgo: number): Promise<number>;
  
  updateUserName(userId: string, firstName: string, lastName?: string): Promise<boolean>;
  
  // === Novas Funções de Validação ===
  getUser(userId: string): Promise<User | undefined>;
  getUserLevel(userId: string): Promise<string>;
  getUserRateLimits(userId: string): Promise<{ maxPerDay: number; maxPerHour: number }>;
  getLastUserReport(userId: string): Promise<Report | undefined>;
  validateGeographicMovement(userId: string, newLat: number, newLng: number): Promise<{ valid: boolean; reason?: string }>;
  findDuplicateReport(lat: number, lng: number, description: string, hoursAgo?: number): Promise<{ isDuplicate: boolean; similarity?: number; originalId?: number }>;
  updateUserReputation(userId: string, action: 'report_verified' | 'report_created' | 'report_flagged'): Promise<void>;
  createAuditLog(log: { action: string; userId: string; ip?: string; entityType: string; entityId?: number; metadata?: any; lat?: number; lng?: number }): Promise<void>;
  
  // === Preferências de Usuário ===
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, data: UpdateUserPreferences): Promise<UserPreferences>;
  verifyDisguisePin(userId: string, pin: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getReports(delayMinutes: number = 30): Promise<Report[]> {
    const delayDate = new Date(Date.now() - delayMinutes * 60 * 1000);
    return await db
      .select()
      .from(reports)
      .where(lt(reports.createdAt, delayDate))
      .orderBy(sql`${reports.createdAt} DESC`);
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async createReport(report: InsertReport & { userId: string }): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async verifyReport(id: number, userId: string): Promise<Report | undefined> {
    try {
      const existingVote = await this.getUserVote(id, userId);
      
      if (existingVote === 'up') {
        return await this.getReport(id);
      }
      
      // Buscar o relatório para saber quem é o dono
      const report = await this.getReport(id);
      if (!report) return undefined;
      
      if (existingVote === 'down') {
        const updateResult = await db.update(reportVerifications)
          .set({ voteType: 'up' })
          .where(and(
            eq(reportVerifications.reportId, id),
            eq(reportVerifications.userId, userId),
            eq(reportVerifications.voteType, 'down')
          ))
          .returning();
        
        if (updateResult.length > 0) {
          const [updated] = await db
            .update(reports)
            .set({ 
              verifiedCount: sql`${reports.verifiedCount} + 1`,
              downvoteCount: sql`GREATEST(${reports.downvoteCount} - 1, 0)`
            })
            .where(eq(reports.id, id))
            .returning();
          
          // Atualizar reputação do dono do relatório
          if (report.userId && report.userId !== userId) {
            await this.updateUserReputation(report.userId, 'report_verified');
          }
          
          return updated;
        }
        return await this.getReport(id);
      }
      
      await db.insert(reportVerifications).values({
        reportId: id,
        userId,
        voteType: 'up',
      });
      
      const [updated] = await db
        .update(reports)
        .set({ verifiedCount: sql`${reports.verifiedCount} + 1` })
        .where(eq(reports.id, id))
        .returning();
      
      // Atualizar reputação do dono do relatório (não pode verificar próprio relatório)
      if (report.userId && report.userId !== userId) {
        await this.updateUserReputation(report.userId, 'report_verified');
      }
      
      return updated;
    } catch (error: any) {
      if (error.code === '23505') {
        return await this.getReport(id);
      }
      throw error;
    }
  }

  async downvoteReport(id: number, userId: string): Promise<Report | undefined> {
    try {
      const existingVote = await this.getUserVote(id, userId);
      
      if (existingVote === 'down') {
        return await this.getReport(id);
      }
      
      if (existingVote === 'up') {
        const updateResult = await db.update(reportVerifications)
          .set({ voteType: 'down' })
          .where(and(
            eq(reportVerifications.reportId, id),
            eq(reportVerifications.userId, userId),
            eq(reportVerifications.voteType, 'up')
          ))
          .returning();
        
        if (updateResult.length > 0) {
          const [updated] = await db
            .update(reports)
            .set({ 
              verifiedCount: sql`GREATEST(${reports.verifiedCount} - 1, 0)`,
              downvoteCount: sql`${reports.downvoteCount} + 1`
            })
            .where(eq(reports.id, id))
            .returning();
          return updated;
        }
        return await this.getReport(id);
      }
      
      await db.insert(reportVerifications).values({
        reportId: id,
        userId,
        voteType: 'down',
      });
      
      const [updated] = await db
        .update(reports)
        .set({ downvoteCount: sql`${reports.downvoteCount} + 1` })
        .where(eq(reports.id, id))
        .returning();
      return updated;
    } catch (error: any) {
      if (error.code === '23505') {
        return await this.getReport(id);
      }
      throw error;
    }
  }

  async getUserVote(reportId: number, userId: string): Promise<string | null> {
    const [existing] = await db
      .select({ voteType: reportVerifications.voteType })
      .from(reportVerifications)
      .where(and(
        eq(reportVerifications.reportId, reportId),
        eq(reportVerifications.userId, userId)
      ))
      .limit(1);
    return existing?.voteType || null;
  }

  async hasUserVerified(reportId: number, userId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(reportVerifications)
      .where(and(
        eq(reportVerifications.reportId, reportId),
        eq(reportVerifications.userId, userId)
      ))
      .limit(1);
    return !!existing;
  }

  async getComments(reportId: number): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.reportId, reportId))
      .orderBy(sql`${comments.createdAt} ASC`);
  }

  async createComment(comment: InsertComment & { userId: string }): Promise<Comment> {
    const [newComment] = await db.insert(comments).values(comment).returning();
    return newComment;
  }

  async createReportFlag(flag: InsertReportFlag & { userId: string; reportId: number }): Promise<ReportFlag> {
    const [newFlag] = await db.insert(reportFlags).values(flag).returning();
    return newFlag;
  }

  async getUserReportCount(userId: string, hoursAgo: number): Promise<number> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(and(
        eq(reports.userId, userId),
        sql`${reports.createdAt} > ${since}`
      ));
    return Number(result[0]?.count || 0);
  }

  async updateUserName(userId: string, firstName: string, lastName?: string): Promise<boolean> {
    const updateData: { firstName: string; lastName?: string } = { firstName };
    if (lastName !== undefined) {
      updateData.lastName = lastName;
    }
    
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
    
    return true;
  }

  // === Novas Funções de Validação ===
  
  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user;
  }

  async getUserLevel(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) return 'novo';
    
    // Verifica se deve promover o usuário
    const daysSinceCreation = user.createdAt 
      ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    if (user.userLevel === 'novo' && daysSinceCreation >= USER_LEVELS.novo.daysToNormal) {
      // Promover para normal
      await db.update(users)
        .set({ userLevel: 'normal' })
        .where(eq(users.id, userId));
      return 'normal';
    }
    
    if (user.userLevel === 'normal' && 
        daysSinceCreation >= USER_LEVELS.normal.daysToVerified &&
        (user.verifiedReportsCount || 0) >= 5) {
      // Promover para verificado
      await db.update(users)
        .set({ userLevel: 'verificado', verifiedAt: new Date() })
        .where(eq(users.id, userId));
      return 'verificado';
    }
    
    return user.userLevel || 'novo';
  }

  async getUserRateLimits(userId: string): Promise<{ maxPerDay: number; maxPerHour: number }> {
    const level = await this.getUserLevel(userId);
    const limits = USER_LEVELS[level as keyof typeof USER_LEVELS] || USER_LEVELS.novo;
    return {
      maxPerDay: limits.maxReportsPerDay,
      maxPerHour: limits.maxReportsPerHour,
    };
  }

  async getLastUserReport(userId: string): Promise<Report | undefined> {
    const [lastReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt))
      .limit(1);
    return lastReport;
  }

  async validateGeographicMovement(userId: string, newLat: number, newLng: number): Promise<{ valid: boolean; reason?: string }> {
    const lastReport = await this.getLastUserReport(userId);
    
    if (!lastReport || !lastReport.createdAt) {
      return { valid: true };
    }
    
    // Calcular distância em km (fórmula de Haversine simplificada)
    const R = 6371; // Raio da Terra em km
    const dLat = (newLat - lastReport.lat) * Math.PI / 180;
    const dLng = (newLng - lastReport.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lastReport.lat * Math.PI / 180) * Math.cos(newLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Tempo decorrido em horas
    const timeElapsedHours = (Date.now() - new Date(lastReport.createdAt).getTime()) / (1000 * 60 * 60);
    
    // Distância máxima possível baseada na velocidade máxima
    const maxPossibleDistance = timeElapsedHours * VELOCITY_MAX_KMH;
    
    if (distance > maxPossibleDistance && timeElapsedHours < 1) {
      return { 
        valid: false, 
        reason: 'deslocamento_impossivel' 
      };
    }
    
    return { valid: true };
  }

  async findDuplicateReport(lat: number, lng: number, description: string, hoursAgo: number = 24): Promise<{ isDuplicate: boolean; similarity?: number; originalId?: number }> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    // Buscar relatórios próximos (aproximadamente 500m = 0.0045 graus)
    const radiusDegrees = DUPLICATE_RADIUS_METERS / 111000; // 1 grau ≈ 111km
    
    const nearbyReports = await db
      .select()
      .from(reports)
      .where(and(
        sql`${reports.createdAt} > ${since}`,
        sql`ABS(${reports.lat} - ${lat}) < ${radiusDegrees}`,
        sql`ABS(${reports.lng} - ${lng}) < ${radiusDegrees}`
      ));
    
    for (const report of nearbyReports) {
      const similarity = this.calculateSimilarity(description, report.description);
      if (similarity > SIMILARITY_THRESHOLD) {
        return { 
          isDuplicate: true, 
          similarity,
          originalId: report.id 
        };
      }
    }
    
    return { isDuplicate: false };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // Calcular Jaccard similarity baseado em conjuntos de palavras únicas
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    
    // Calcular interseção (palavras em ambos os conjuntos)
    let intersectionCount = 0;
    words1.forEach(word => {
      if (words2.has(word)) intersectionCount++;
    });
    
    // União = palavras únicas em ambos os conjuntos
    // |A ∪ B| = |A| + |B| - |A ∩ B|
    const unionCount = words1.size + words2.size - intersectionCount;
    
    if (unionCount === 0) return 0;
    
    // Jaccard = |A ∩ B| / |A ∪ B|, sempre entre 0 e 1
    return Math.min(1, intersectionCount / unionCount);
  }

  async updateUserReputation(userId: string, action: 'report_verified' | 'report_created' | 'report_flagged'): Promise<void> {
    const scoreChanges = {
      report_verified: 5,   // Alguém verificou o relatório do usuário
      report_created: 1,    // Usuário criou um relatório
      report_flagged: -10,  // Relatório do usuário foi denunciado
    };
    
    const score = scoreChanges[action] || 0;
    
    if (action === 'report_verified') {
      await db.update(users)
        .set({ 
          reputationScore: sql`COALESCE(${users.reputationScore}, 0) + ${score}`,
          verifiedReportsCount: sql`COALESCE(${users.verifiedReportsCount}, 0) + 1`
        })
        .where(eq(users.id, userId));
    } else if (action === 'report_created') {
      await db.update(users)
        .set({ 
          reputationScore: sql`COALESCE(${users.reputationScore}, 0) + ${score}`,
          totalReportsCount: sql`COALESCE(${users.totalReportsCount}, 0) + 1`
        })
        .where(eq(users.id, userId));
    } else {
      await db.update(users)
        .set({ 
          reputationScore: sql`GREATEST(COALESCE(${users.reputationScore}, 0) + ${score}, 0)`
        })
        .where(eq(users.id, userId));
    }
  }

  async createAuditLog(log: { 
    action: string; 
    userId: string; 
    ip?: string; 
    entityType: string; 
    entityId?: number; 
    metadata?: any; 
    lat?: number; 
    lng?: number 
  }): Promise<void> {
    await db.insert(auditLogs).values({
      action: log.action,
      userIdHash: hashAnonymous(log.userId),
      ipHash: log.ip ? hashAnonymous(log.ip) : null,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      lat: log.lat,
      lng: log.lng,
    });
  }

  // === Preferências de Usuário ===
  
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    
    if (!prefs) {
      // Criar preferências padrão SEM PIN (camuflagem desativada por padrão)
      const [newPrefs] = await db
        .insert(userPreferences)
        .values({ userId })
        .returning();
      return newPrefs;
    }
    
    return prefs;
  }

  async updateUserPreferences(userId: string, data: UpdateUserPreferences): Promise<UserPreferences> {
    // Verificar se já existe
    const existing = await this.getUserPreferences(userId);
    
    // Se houver novo PIN, fazer hash antes de salvar
    const dataToSave = { ...data };
    if (data.disguisePin) {
      dataToSave.disguisePin = await bcrypt.hash(data.disguisePin, 10);
    }
    
    // Se estiver ativando camuflagem, verificar se PIN foi definido
    if (data.disguiseEnabled === true && !existing?.disguisePin && !data.disguisePin) {
      throw new Error('PIN_REQUIRED');
    }
    
    if (!existing) {
      // Criar com os dados fornecidos
      const [newPrefs] = await db
        .insert(userPreferences)
        .values({ userId, ...dataToSave })
        .returning();
      return newPrefs;
    }
    
    // Atualizar existente
    const [updated] = await db
      .update(userPreferences)
      .set({ ...dataToSave, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    
    return updated;
  }

  async verifyDisguisePin(userId: string, pin: string): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    if (!prefs || !prefs.disguisePin) return false;
    
    // Comparar PIN com hash armazenado
    return await bcrypt.compare(pin, prefs.disguisePin);
  }
}

export const storage = new DatabaseStorage();
