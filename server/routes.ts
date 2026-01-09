import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize Auth BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Reports
  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports();
    res.json(reports);
  });

  app.post(api.reports.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.reports.create.input.parse(req.body);
      const user = req.user as any; // Replit Auth user
      const report = await storage.createReport({
        ...input,
        userId: user.claims.sub,
      });
      res.status(201).json(report);
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

  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  });

  app.post(api.reports.verify.path, isAuthenticated, async (req, res) => {
    const report = await storage.verifyReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  });

  // Comments
  app.get(api.comments.list.path, async (req, res) => {
    const comments = await storage.getComments(Number(req.params.reportId));
    res.json(comments);
  });

  app.post(api.comments.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.comments.create.input.parse(req.body);
      const user = req.user as any;
      const comment = await storage.createComment({
        ...input,
        userId: user.claims.sub,
      });
      res.status(201).json(comment);
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

  // Dados Iniciais (se vazio)
  const existing = await storage.getReports();
  if (existing.length === 0) {
    const demoUserId = "demo_user";
    // Pontos de demonstração em São Paulo
    await storage.createReport({
      userId: demoUserId,
      type: "iluminacao_precaria",
      description: "Postes de luz quebrados em todo este quarteirão.",
      severity: 3,
      lat: -23.5505,
      lng: -46.6333,
    });
    await storage.createReport({
      userId: demoUserId,
      type: "deserto",
      description: "Área muito silenciosa à noite, sem lojas abertas.",
      severity: 2,
      lat: -23.5605,
      lng: -46.6233,
    });
    await storage.createReport({
      userId: demoUserId,
      type: "assedio",
      description: "Grupos de pessoas importunando e assobiando.",
      severity: 5,
      lat: -23.5405,
      lng: -46.6433,
    });
  }

  return httpServer;
}
