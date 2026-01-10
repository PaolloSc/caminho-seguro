import { db } from "./db";
import {
  reports,
  comments,
  reportFlags,
  reportVerifications,
  type Report,
  type InsertReport,
  type Comment,
  type InsertComment,
  type ReportFlag,
  type InsertReportFlag
} from "@shared/schema";
import { eq, sql, lt, and } from "drizzle-orm";

export interface IStorage {
  getReports(delayMinutes?: number): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(report: InsertReport & { userId: string }): Promise<Report>;
  verifyReport(id: number, userId: string): Promise<Report | undefined>;
  hasUserVerified(reportId: number, userId: string): Promise<boolean>;
  
  getComments(reportId: number): Promise<Comment[]>;
  createComment(comment: InsertComment & { userId: string }): Promise<Comment>;
  
  createReportFlag(flag: InsertReportFlag & { userId: string; reportId: number }): Promise<ReportFlag>;
  getUserReportCount(userId: string, hoursAgo: number): Promise<number>;
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
    // Verifica se usuário já verificou este relatório (persistido no banco)
    if (await this.hasUserVerified(id, userId)) {
      return await this.getReport(id);
    }
    
    try {
      // Registra verificação no banco de dados (índice único previne duplicatas)
      await db.insert(reportVerifications).values({
        reportId: id,
        userId,
      });
      
      const [updated] = await db
        .update(reports)
        .set({ verifiedCount: sql`${reports.verifiedCount} + 1` })
        .where(eq(reports.id, id))
        .returning();
      return updated;
    } catch (error: any) {
      // Se for erro de duplicata (race condition), retorna relatório atual
      if (error.code === '23505') { // unique_violation
        return await this.getReport(id);
      }
      throw error;
    }
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
}

export const storage = new DatabaseStorage();
