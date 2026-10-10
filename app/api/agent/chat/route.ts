
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { executeAgentChat } from "@/lib/openai/openai-agent";
import {
  getActiveConnectedAccounts,
  getOrCreateAgentSession,
} from "@/lib/composio/service";
import {
  ComposioConfigurationError,
  getComposio,
} from "@/lib/composio/composio";
import { AgentConfigType } from "@/type/agent";
import type { AgentResponse } from "@/lib/openai/agent-response-schema";

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
    const { agentId, messages, timezone } = body;

    if (
      typeof agentId !== "string" ||
      !agentId.trim() ||
      !Array.isArray(messages) ||
      messages.length === 0 ||
      !messages.every(
        (msg: { role: "user" | "assistant" | "agent"; content: string }) =>
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

    let agentComposioTools: any[] = [];

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

    if (Array.isArray(agentConfig.tools) && agentConfig.tools.length > 0) {
      const composioSession = await getOrCreateAgentSession(
        agentConfig as unknown as AgentConfigType,
        session.user.email
      );
      agentComposioTools = await composioSession.tools();
    }

    const chatMessages = messages.map(
      (msg: { role: "user" | "assistant" | "agent"; content: string }) => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content,
      })
    );

    //ALl available tools
    const tools = await db.select().from(Tools).where(eq(Tools.isActive, true));

    const toolsCatalog = tools.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description ?? "",
    }));

    const latestUserMessage = [...messages]
      .reverse()
      .find((msg: { role: string }) => msg.role === "user");
    const latestText =
      typeof latestUserMessage?.content === "string"
        ? latestUserMessage.content.toLowerCase().replace(/[^a-z0-9]/g, "")
        : "";
    const isExplicitConnectRequest = /\b(connect|link|authorize)\b/i.test(
      latestUserMessage?.content ?? "",
    );
    const requestedTools = tools.filter((tool) => {
      const slug = tool.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = tool.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return latestText.includes(slug) || latestText.includes(name);
    });

    let response: AgentResponse;
    if (isExplicitConnectRequest && requestedTools.length > 0) {
      const toolNames = requestedTools.map((tool) => tool.name).join(" and ");
      response = {
        type: "tool_connection",
        message: `Use the cards below to connect ${toolNames}.`,
        questions: [],
        routine: null,
        suggestedTools: requestedTools.map((tool) => ({
          slug: tool.slug,
          reason: `${tool.name} needs account access to perform this task.`,
        })),
      };
    } else {
      response = await executeAgentChat(
        agentConfig.name,
        agentConfig.description ?? "",
        chatMessages,
        agentComposioTools,
        toolsCatalog,
        typeof timezone === "string" ? timezone : "UTC",
      );
    }

    const requestedSlugs = new Set([
      ...response.suggestedTools.map((tool) => tool.slug),
      ...(response.routine?.tools.map((tool) => tool.slug) ?? []),
    ]);
    const toolReasons = new Map<string, string>([
      ...response.suggestedTools.map((tool) => [tool.slug, tool.reason] as const),
      ...(response.routine?.tools.map((tool) => [tool.slug, tool.reason] as const) ?? []),
    ]);
    let connectedAccounts: Record<string, string[]> = {};
    try {
      connectedAccounts = await getActiveConnectedAccounts(
        session.user.email,
        [...requestedSlugs],
        getComposio(),
      );
    } catch {
      // Keep the chat usable when Composio has not been configured.
    }
    const toolCards = tools
      .filter((tool) => requestedSlugs.has(tool.slug))
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description ?? "",
        reason: toolReasons.get(tool.slug) ?? "",
        icon: tool.icon ?? undefined,
        isConnected: Boolean(connectedAccounts[tool.slug]?.length),
        isEnabled: tool.isActive ?? true,
      }));

    return NextResponse.json({ response, toolCards });

  } catch (error) {
    if (error instanceof ComposioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Agent chat API error:", error);

    return NextResponse.json(
      { error: "Failed to process agent message" },
      { status: 500 }
    );
  }

}
