import { pgTable, varchar, serial, text, integer, timestamp, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
// import { boolean } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer('credits').default(5),
});

export const AgentConfig = pgTable('agentConfig', {
  id: serial("id").primaryKey(),
  agentid: varchar('agentId').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  agentImage: text('agentImage'),
  isActive: boolean('is_active').notNull().default(true),
  tools: jsonb('tools'),
  composioSessionId: varchar("composioSessionId"),
  e2bSandboxId: varchar("e2bSandboxId"),
  e2bSandboxStatus: varchar("e2bSandboxStatus", { length: 20 }).notNull().default("inactive"),
  e2bLastActiveAt: timestamp("e2b_last_active_at", { withTimezone: true }),
  e2bPausedAt: timestamp("e2b_paused_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userEmail: text('userEmail').notNull().references(() => users.email)

})

export const Tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  icon: text("icon").notNull(),
  category: varchar("category", { length: 100 }).default("General"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Routine Table
export const Routines = pgTable("routines", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => AgentConfig.agentid),
  userEmail: text("user_email").notNull().references(() => users.email),
  name: varchar("name").notNull(),
  goal: text("goal").notNull(),
  instructions: text("instructions").notNull(),
  schedule: jsonb("schedule").notNull(),
  tools: jsonb("tools").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const RoutineExecutions = pgTable("routine_executions", {
  id: varchar("id").primaryKey(),
  routineId: varchar("routine_id").notNull().references(() => Routines.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => AgentConfig.agentid, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  runType: varchar("run_type", { length: 20 }).notNull().default("scheduled"),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  result: jsonb("result"),
  error: text("error"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  routineScheduledUnique: uniqueIndex("routine_executions_routine_scheduled_unique").on(table.routineId, table.scheduledFor),
  statusScheduledIndex: index("routine_executions_status_scheduled_idx").on(table.status, table.scheduledFor),
}));

export const AgentChatHistory = pgTable("agent_chat_history", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => AgentConfig.agentid, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<Array<{
    id: string;
    role: "user" | "agent";
    content: string;
    time: string;
    [key: string]: unknown;
  }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  agentUnique: uniqueIndex("agent_chat_history_agent_id_unique").on(table.agentId),
  expiryIndex: index("agent_chat_history_expiry_idx").on(table.expiresAt),
}));




export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

