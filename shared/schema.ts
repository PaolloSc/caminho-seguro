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
  userId: true,
  status: true,
  createdAt: true
});

// === TYPES ===
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type ReportFlag = typeof reportFlags.$inferSelect;
export type InsertReportFlag = z.infer<typeof insertReportFlagSchema>;
