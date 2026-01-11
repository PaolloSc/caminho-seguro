import { pgTable, text, serial, integer, boolean, timestamp, real, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === TABLE DEFINITIONS ===
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Links to auth.users.id
  type: text("type").notNull(), // 'assedio', 'iluminacao_precaria', 'deserto', 'abrigo_seguro', 'outro'
  description: text("description").notNull(),
  reference: text("reference"), // Ponto de referência opcional (ex: "próximo ao ponto de ônibus")
  severity: integer("severity").default(1), // 1-5
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  verifiedCount: integer("verified_count").default(0),
  downvoteCount: integer("downvote_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportFlags = pgTable("report_flags", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  userId: varchar("user_id").notNull(),
  reason: text("reason").notNull(), // 'falso', 'ofensivo', 'spam', 'outro'
  description: text("description"),
  status: text("status").default("pendente"), // 'pendente', 'revisado', 'aceito', 'rejeitado'
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportVerifications = pgTable("report_verifications", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  userId: varchar("user_id").notNull(),
  voteType: text("vote_type").default("up").notNull(), // 'up' or 'down'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserReport: uniqueIndex("unique_user_report_verification").on(table.userId, table.reportId),
}));

// === PREFERÊNCIAS DE USUÁRIO ===
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  // Camuflagem (começa desativada até usuária definir PIN)
  disguiseEnabled: boolean("disguise_enabled").default(false),
  disguiseType: text("disguise_type").default("calculator"), // 'calculator', 'notes', 'weather'
  disguisePin: varchar("disguise_pin", { length: 100 }), // PIN hasheado (null até ser definido)
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===
export const insertReportSchema = createInsertSchema(reports).omit({ 
  id: true, 
  userId: true, 
  verifiedCount: true, 
  downvoteCount: true,
  createdAt: true 
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  userId: true,
  createdAt: true
});

export const insertReportFlagSchema = createInsertSchema(reportFlags).omit({
  id: true,
  reportId: true,
  userId: true,
  status: true,
  createdAt: true
});

// === SCHEMAS DE PREFERÊNCIAS ===
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserPreferencesSchema = z.object({
  disguiseEnabled: z.boolean().optional(),
  disguiseType: z.enum(['calculator', 'notes', 'weather']).optional(),
  disguisePin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
});

// === TYPES ===
export type Report = typeof reports.$inferSelect & {
  userLevel?: string; // 'novo' | 'normal' | 'verificado'
  confirmationStatus?: string; // 'pendente' | 'parcial' | 'confirmado'
};
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type ReportFlag = typeof reportFlags.$inferSelect;
export type InsertReportFlag = z.infer<typeof insertReportFlagSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;
