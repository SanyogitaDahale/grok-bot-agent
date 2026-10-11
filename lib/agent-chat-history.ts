import { db } from "@/db";
import { AgentChatHistory } from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";

export const CHAT_HISTORY_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export type StoredChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  time: string;
  [key: string]: unknown;
};

export async function appendAgentChatMessages({
  agentId,
  userEmail,
  messages,
}: {
  agentId: string;
  userEmail: string;
  messages: StoredChatMessage[];
}) {
  if (messages.length === 0) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() - CHAT_HISTORY_RETENTION_MS);
  const newestMessageAt = Math.max(...messages.map((message) => new Date(message.time).getTime()));
  const expiresAt = new Date(newestMessageAt + CHAT_HISTORY_RETENTION_MS);

  await db.delete(AgentChatHistory).where(and(
    eq(AgentChatHistory.agentId, agentId),
    lte(AgentChatHistory.expiresAt, now),
  ));

  await db.insert(AgentChatHistory).values({
    agentId,
    userEmail,
    messages,
    updatedAt: now,
    expiresAt,
  }).onConflictDoUpdate({
    target: AgentChatHistory.agentId,
    set: {
      userEmail,
      messages: sql`(
        SELECT COALESCE(jsonb_agg(entry.message ORDER BY entry.message_time, entry.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (item->>'id')
            item AS message,
            (item->>'time')::timestamptz AS message_time,
            ordinality
          FROM jsonb_array_elements(${AgentChatHistory.messages} || ${JSON.stringify(messages)}::jsonb)
            WITH ORDINALITY AS entries(item, ordinality)
          WHERE (item->>'time')::timestamptz >= ${cutoff.toISOString()}::timestamptz
          ORDER BY item->>'id', ordinality DESC
        ) AS entry
      )`,
      updatedAt: now,
      expiresAt,
    },
  });
}

export function filterUnexpiredMessages(messages: StoredChatMessage[], now = new Date()) {
  const cutoff = now.getTime() - CHAT_HISTORY_RETENTION_MS;
  return messages.filter((message) => {
    const time = new Date(message.time).getTime();
    return Number.isFinite(time) && time > cutoff && time <= now.getTime() + 60_000;
  });
}

export function getChatHistoryExpiry(messages: StoredChatMessage[]) {
  const latestMessageAt = messages.reduce((latest, message) => {
    const timestamp = new Date(message.time).getTime();
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
  return new Date(latestMessageAt + CHAT_HISTORY_RETENTION_MS);
}
