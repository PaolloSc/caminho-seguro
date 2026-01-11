import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import { sendNewReportNotification } from "./email";

// Email do administrador para receber notificações (configurado via variável de ambiente)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// === SEGURANÇA: Rate Limiters ===
const createReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 relatórios por hora por IP
  message: { message: "Limite de relatórios atingido. Tente novamente em 1 hora.", field: "rate_limit" },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 verificações por hora
  message: { message: "Limite de verificações atingido. Tente novamente mais tarde.", field: "rate_limit" },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por 15 min
  message: { message: "Muitas requisições. Aguarde um momento.", field: "rate_limit" },
  standardHeaders: true,
  legacyHeaders: false,
});

// === SEGURANÇA: Funções de Sanitização ===
function sanitizeDescription(text: string): string {
  // Remove HTML e limita tamanho
  const clean = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return clean.slice(0, 1000); // Máximo 1000 caracteres
}

// === SEGURANÇA: Ofuscação de Localização (±50m) ===
function obfuscateLocation(lat: number, lng: number): { lat: number; lng: number } {
  const offset = 0.0005; // Aproximadamente 50 metros
  return {
    lat: lat + (Math.random() - 0.5) * offset * 2,
    lng: lng + (Math.random() - 0.5) * offset * 2,
  };
}

// === SEGURANÇA: Validação de Tipos Permitidos ===
const ALLOWED_TYPES = ['assedio', 'iluminacao_precaria', 'deserto', 'abrigo_seguro', 'outro'];
const ALLOWED_FLAG_REASONS = ['falso', 'ofensivo', 'spam', 'outro'];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Rate limiter geral
  app.use('/api/', generalLimiter);
  
  // Initialize Auth BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // === RELATÓRIOS ===
  
  // Lista de relatórios (delay desativado para testes)
  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports(10); // delay de 10ms
    
    // Buscar nível do usuário para cada relatório (para badge de verificado)
    const safeReports = await Promise.all(reports.map(async (r) => {
      let userLevel = 'novo';
      if (r.userId) {
        userLevel = await storage.getUserLevel(r.userId);
      }
      
      // Determinar status de confirmação
      const confirmationStatus = r.verifiedCount && r.verifiedCount >= 3 
        ? 'confirmado' 
        : r.verifiedCount && r.verifiedCount >= 1 
          ? 'parcial' 
          : 'pendente';
      
      return {
        ...r,
        userId: undefined, // Não expor userId
        userLevel, // Nível do autor (para badge)
        confirmationStatus, // Status de confirmação comunitária
      };
    }));
    
    res.json(safeReports);
  });

  // Criar relatório (com rate limiting, validação geográfica e sanitização)
  app.post(api.reports.create.path, isAuthenticated, createReportLimiter, async (req, res) => {
    try {
      const input = api.reports.create.input.parse(req.body);
      const user = req.user as any;
      const userId = user.claims.sub;
      const clientIp = req.ip || req.headers['x-forwarded-for'] as string;
      
      // Validar tipo
      if (!ALLOWED_TYPES.includes(input.type)) {
        return res.status(400).json({
          message: "Tipo de relatório inválido",
          field: "type",
        });
      }
      
      // === VALIDAÇÃO 1: Rate limiting baseado no nível do usuário ===
      const userLimits = await storage.getUserRateLimits(userId);
      const dailyCount = await storage.getUserReportCount(userId, 24);
      const hourlyCount = await storage.getUserReportCount(userId, 1);
      
      if (dailyCount >= userLimits.maxPerDay) {
        return res.status(429).json({
          message: `Você atingiu o limite de ${userLimits.maxPerDay} relatórios por dia`,
          field: "rate_limit",
        });
      }
      
      if (hourlyCount >= userLimits.maxPerHour) {
        return res.status(429).json({
          message: `Você atingiu o limite de ${userLimits.maxPerHour} relatórios por hora. Aguarde um pouco.`,
          field: "rate_limit",
        });
      }
      
      // === VALIDAÇÃO 2: Verificar deslocamento geográfico ===
      const geoValidation = await storage.validateGeographicMovement(userId, input.lat, input.lng);
      if (!geoValidation.valid) {
        await storage.createAuditLog({
          action: 'report_blocked_geo',
          userId,
          ip: clientIp,
          entityType: 'report',
          metadata: { reason: geoValidation.reason, lat: input.lat, lng: input.lng },
        });
        return res.status(400).json({
          message: "Deslocamento muito rápido detectado. Aguarde alguns minutos antes de reportar de outra localização.",
          field: "location",
        });
      }
      
      // Sanitizar descrição
      const sanitizedDescription = sanitizeDescription(input.description);
      if (sanitizedDescription.length < 10) {
        return res.status(400).json({
          message: "Descrição muito curta. Mínimo 10 caracteres.",
          field: "description",
        });
      }
      
      // === VALIDAÇÃO 3: Verificar duplicatas ===
      const duplicateCheck = await storage.findDuplicateReport(input.lat, input.lng, sanitizedDescription);
      if (duplicateCheck.isDuplicate) {
        await storage.createAuditLog({
          action: 'report_blocked_duplicate',
          userId,
          ip: clientIp,
          entityType: 'report',
          metadata: { similarity: duplicateCheck.similarity, originalId: duplicateCheck.originalId },
        });
        return res.status(400).json({
          message: "Um relato muito similar já existe nesta área. Você pode verificar o relato existente.",
          field: "duplicate",
        });
      }
      
      // Ofuscar localização para privacidade
      const obfuscated = obfuscateLocation(input.lat, input.lng);
      
      const report = await storage.createReport({
        ...input,
        description: sanitizedDescription,
        lat: obfuscated.lat,
        lng: obfuscated.lng,
        userId,
      });
      
      // Atualizar reputação do usuário
      await storage.updateUserReputation(userId, 'report_created');
      
      // Criar log de auditoria LGPD
      await storage.createAuditLog({
        action: 'report_created',
        userId,
        ip: clientIp,
        entityType: 'report',
        entityId: report.id,
        metadata: { 
          type: input.type, 
          severity: input.severity,
          validations: ['geo_check', 'duplicate_check', 'rate_limit_check']
        },
        lat: obfuscated.lat,
        lng: obfuscated.lng,
      });
      
      // Enviar notificação por email para o administrador (se configurado)
      if (ADMIN_EMAIL) {
        sendNewReportNotification(ADMIN_EMAIL, {
          type: input.type,
          description: sanitizedDescription,
          severity: input.severity || 1,
          lat: obfuscated.lat,
          lng: obfuscated.lng,
        }).catch(err => console.error('Email notification failed:', err));
      }
      
      res.status(201).json({
        ...report,
        userId: undefined, // Não retornar userId
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Obter relatório específico
  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    res.json({
      ...report,
      userId: undefined, // Não expor userId
    });
  });

  // Verificar relatório (upvote)
  app.post(api.reports.verify.path, isAuthenticated, verifyLimiter, async (req, res) => {
    const user = req.user as any;
    const reportId = Number(req.params.id);
    
    const report = await storage.verifyReport(reportId, user.claims.sub);
    if (!report) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    res.json({
      ...report,
      userId: undefined,
    });
  });

  // Downvote relatório
  app.post(api.reports.downvote.path, isAuthenticated, verifyLimiter, async (req, res) => {
    const user = req.user as any;
    const reportId = Number(req.params.id);
    
    const report = await storage.downvoteReport(reportId, user.claims.sub);
    if (!report) {
      return res.status(404).json({ message: 'Relatório não encontrado' });
    }
    res.json({
      ...report,
      userId: undefined,
    });
  });

  // === DENÚNCIAS ===
  app.post(api.flags.create.path, isAuthenticated, async (req, res) => {
    try {
      const reportId = Number(req.params.id);
      const user = req.user as any;
      
      // Verificar se relatório existe
      const report = await storage.getReport(reportId);
      if (!report) {
        return res.status(404).json({ message: 'Relatório não encontrado' });
      }
      
      const input = api.flags.create.input.parse(req.body);
      
      // Validar razão
      if (!ALLOWED_FLAG_REASONS.includes(input.reason)) {
        return res.status(400).json({
          message: "Razão de denúncia inválida",
          field: "reason",
        });
      }
      
      const flag = await storage.createReportFlag({
        ...input,
        reportId,
        userId: user.claims.sub,
        description: input.description ? sanitizeDescription(input.description) : null,
      });
      
      res.status(201).json(flag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === COMENTÁRIOS ===
  app.get(api.comments.list.path, async (req, res) => {
    const comments = await storage.getComments(Number(req.params.reportId));
    // Remover userId para anonimato
    const safeComments = comments.map(c => ({
      ...c,
      userId: undefined,
    }));
    res.json(safeComments);
  });

  app.post(api.comments.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.comments.create.input.parse(req.body);
      const user = req.user as any;
      
      // Sanitizar conteúdo
      const sanitizedContent = sanitizeDescription(input.content);
      if (sanitizedContent.length < 5) {
        return res.status(400).json({
          message: "Comentário muito curto",
          field: "content",
        });
      }
      
      const comment = await storage.createComment({
        ...input,
        content: sanitizedContent,
        userId: user.claims.sub,
      });
      
      res.status(201).json({
        ...comment,
        userId: undefined,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === USUÁRIO ===
  app.patch(api.user.updateName.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.user.updateName.input.parse(req.body);
      const user = req.user as any;
      
      await storage.updateUserName(user.claims.sub, input.firstName, input.lastName);
      
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === DADOS INICIAIS (desenvolvimento) ===
  const existing = await storage.getReports(0); // Sem delay para seed
  if (existing.length === 0) {
    const demoUserId = "demo_user";
    await storage.createReport({
      userId: demoUserId,
      type: "iluminacao_precaria",
      description: "Postes de luz quebrados em todo este quarteirão. Muito escuro à noite.",
      severity: 3,
      lat: -23.5505,
      lng: -46.6333,
    });
    await storage.createReport({
      userId: demoUserId,
      type: "deserto",
      description: "Área muito silenciosa à noite, sem lojas abertas. Poucas pessoas passam por aqui.",
      severity: 2,
      lat: -23.5605,
      lng: -46.6233,
    });
    await storage.createReport({
      userId: demoUserId,
      type: "assedio",
      description: "Grupos de pessoas importunando e assobiando para mulheres que passam.",
      severity: 5,
      lat: -23.5405,
      lng: -46.6433,
    });
  }

  return httpServer;
}
