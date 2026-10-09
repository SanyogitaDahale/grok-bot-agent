
import { db } from "@/db";
import { AgentConfig } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { executeAgentChat } from "@/lib/openai/openai-agent";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { agentId, messages } = body;

    if (
      typeof agentId !== "string" ||
      !agentId.trim() ||
      !Array.isArray(messages) ||
      messages.length === 0 ||
      !messages.every(
        (msg) =>
          msg &&
          ["user", "assistant", "agent"].includes(msg.role) &&
          typeof msg.content === "string" &&
          msg.content.trim().length > 0
      )
    ) {
      return NextResponse.json(
        { error: "Invalid agentId or messages" },
        { status: 400 }
      );
    }

    const [agentConfig] = await db
      .select()
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentid, agentId),
          eq(AgentConfig.userEmail, session.user.email)
        )
      )
      .limit(1);

    if (!agentConfig) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const chatMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content,
      })
    );

    const response = await executeAgentChat(
      agentConfig.name,
      agentConfig.description ?? "",
      chatMessages
    );

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Agent chat API error:", error);

    return NextResponse.json(
      { error: "Failed to process agent message" },
      { status: 500 }
    );
  }
}
