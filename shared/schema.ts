import { pgTable, text, serial, integer, boolean, timestamp, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === TABLE DEFINITIONS ===
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Links to auth.users.id
  type: text("type").notNull(), // 'harassment', 'poor_lighting', 'deserted', 'safe_haven', 'other'
  description: text("description").notNull(),
  severity: integer("severity").default(1), // 1-5
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  verifiedCount: integer("verified_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===
export const insertReportSchema = createInsertSchema(reports).omit({ 
  id: true, 
  userId: true, 
  verifiedCount: true, 
  createdAt: true 
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  userId: true,
  createdAt: true
});

// === TYPES ===
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
