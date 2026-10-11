import { db } from "@/db";
import { AgentConfig } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { appendAgentChatMessages } from "@/lib/agent-chat-history";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.agentId !== "string" || typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "An agent ID and message are required" }, { status: 400 });
    }

    const [agent] = await db.select({ agentid: AgentConfig.agentid }).from(AgentConfig).where(and(
      eq(AgentConfig.agentid, body.agentId),
      eq(AgentConfig.userEmail, userEmail),
    )).limit(1);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const message = {
      ...(body.details && typeof body.details === "object" ? body.details : {}),
      id: typeof body.id === "string" && body.id.trim() ? body.id : crypto.randomUUID(),
      role: "agent" as const,
      content: body.content.trim(),
      time: new Date().toISOString(),
    };
    await appendAgentChatMessages({
      agentId: body.agentId,
      userEmail,
      messages: [message],
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to save agent chat log:", error);
    return NextResponse.json({ error: "Failed to save chat log" }, { status: 500 });
  }
}
