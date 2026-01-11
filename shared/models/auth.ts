import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, text, real, serial } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // === Campos de Reputação ===
  reputationScore: integer("reputation_score").default(0), // Pontuação de reputação
  userLevel: text("user_level").default("novo"), // 'novo', 'normal', 'verificado'
  verifiedReportsCount: integer("verified_reports_count").default(0), // Relatos que foram verificados por outros
  totalReportsCount: integer("total_reports_count").default(0), // Total de relatos criados
  verifiedAt: timestamp("verified_at"), // Data em que se tornou usuário verificado
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de Auditoria LGPD
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // 'report_created', 'report_verified', 'report_flagged', etc
  userIdHash: varchar("user_id_hash").notNull(), // Hash anônimo do userId
  ipHash: varchar("ip_hash"), // Hash do IP
  entityType: text("entity_type").notNull(), // 'report', 'comment', 'flag'
  entityId: integer("entity_id"),
  metadata: jsonb("metadata"), // Dados adicionais (validações aplicadas, score, etc)
  lat: real("lat"), // Localização aproximada (para validação geográfica)
  lng: real("lng"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
