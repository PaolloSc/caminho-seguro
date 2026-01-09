import { db } from "./db";
import {
  reports,
  comments,
  type Report,
  type InsertReport,
  type Comment,
  type InsertComment
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getReports(): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(report: InsertReport & { userId: string }): Promise<Report>;
  verifyReport(id: number): Promise<Report | undefined>;
  
  getComments(reportId: number): Promise<Comment[]>;
  createComment(comment: InsertComment & { userId: string }): Promise<Comment>;
}

export class DatabaseStorage implements IStorage {
  async getReports(): Promise<Report[]> {
    return await db.select().from(reports).orderBy(sql`${reports.createdAt} DESC`);
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async createReport(report: InsertReport & { userId: string }): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async verifyReport(id: number): Promise<Report | undefined> {
    const [updated] = await db
      .update(reports)
      .set({ verifiedCount: sql`${reports.verifiedCount} + 1` })
      .where(eq(reports.id, id))
      .returning();
    return updated;
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
}

export const storage = new DatabaseStorage();
