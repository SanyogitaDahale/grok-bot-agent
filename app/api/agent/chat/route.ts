
import { db } from "@/db";
import { AgentChatHistory, AgentConfig, Routines, Tools } from "@/db/schema";
import { and, asc, eq, gt, lt } from "drizzle-orm";
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
import { routineSchema } from "@/lib/openai/agent-response-schema";
import { FALLBACK_TOOLKITS } from "@/lib/composio/tool-catalog";
import { runRoutineImmediately, RoutineRunError } from "@/lib/inngest/run-routine";
import { createAgentVmTaskTool } from "@/lib/e2b/agent-task-tool";
import {
  appendAgentChatMessages,
  filterUnexpiredMessages,
  getChatHistoryExpiry,
} from "@/lib/agent-chat-history";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "An agent ID is required" }, { status: 400 });

    const [agent] = await db.select({ agentid: AgentConfig.agentid }).from(AgentConfig).where(and(
      eq(AgentConfig.agentid, agentId),
      eq(AgentConfig.userEmail, userEmail),
    )).limit(1);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const now = new Date();
    await db.delete(AgentChatHistory).where(lt(AgentChatHistory.expiresAt, now));
    const [history] = await db.select().from(AgentChatHistory).where(and(
      eq(AgentChatHistory.agentId, agentId),
      eq(AgentChatHistory.userEmail, userEmail),
      gt(AgentChatHistory.expiresAt, now),
    )).limit(1);

    if (!history) return NextResponse.json({ messages: [] });

    const messages = filterUnexpiredMessages(history.messages, now);
    if (messages.length === 0) {
      await db.delete(AgentChatHistory).where(and(
        eq(AgentChatHistory.id, history.id),
        eq(AgentChatHistory.updatedAt, history.updatedAt),
      ));
    } else if (messages.length !== history.messages.length) {
      await db.update(AgentChatHistory).set({
        messages,
        updatedAt: now,
        expiresAt: getChatHistoryExpiry(messages),
      }).where(and(
        eq(AgentChatHistory.id, history.id),
        eq(AgentChatHistory.updatedAt, history.updatedAt),
      ));
    }

    const afterId = req.nextUrl.searchParams.get("afterId");
    const afterIndex = afterId ? messages.findIndex((message) => message.id === afterId) : -1;
    const visibleMessages = afterIndex >= 0 ? messages.slice(afterIndex + 1) : messages;
    return NextResponse.json({ messages: visibleMessages });
  } catch (error) {
    console.error("Failed to load agent chat history:", error);
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId?.trim()) return NextResponse.json({ error: "An agent ID is required" }, { status: 400 });

    const [agent] = await db.select({ agentid: AgentConfig.agentid }).from(AgentConfig).where(and(
      eq(AgentConfig.agentid, agentId),
      eq(AgentConfig.userEmail, userEmail),
    )).limit(1);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    await db.delete(AgentChatHistory).where(and(
      eq(AgentChatHistory.agentId, agentId),
      eq(AgentChatHistory.userEmail, userEmail),
    ));
    return NextResponse.json({ reset: true });
  } catch (error) {
    console.error("Failed to reset agent chat history:", error);
    return NextResponse.json({ error: "Could not reset this agent's conversation" }, { status: 500 });
  }
}

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
    const { agentId, messages, timezone, routineEditId } = body;

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

    const latestUserMessage = [...messages]
      .reverse()
      .find((msg: { role: string }) => msg.role === "user");
    const chatNow = new Date();
    await db.delete(AgentChatHistory).where(lt(AgentChatHistory.expiresAt, chatNow));
    const incomingId = typeof latestUserMessage?.id === "string" ? latestUserMessage.id : crypto.randomUUID();
    if (latestUserMessage) {
      await appendAgentChatMessages({
        agentId,
        userEmail: session.user.email,
        messages: [{
          id: incomingId,
          role: "user",
          content: latestUserMessage.content,
          time: chatNow.toISOString(),
        }],
      });
    }
    const saveAssistantMessage = async (
      response: AgentResponse,
      toolCards: unknown[] = [],
      details: Record<string, unknown> = {},
    ) => {
      const messageId = crypto.randomUUID();
      await appendAgentChatMessages({
        agentId,
        userEmail: session.user!.email!,
        messages: [{
          id: messageId,
          role: "agent",
          content: response.message,
          time: new Date().toISOString(),
          response,
          toolCards,
          ...details,
        }],
      });
      return messageId;
    };

    let routineEditInstructions = "";
    if (typeof routineEditId === "string" && routineEditId) {
      const [savedRoutine] = await db
        .select()
        .from(Routines)
        .where(and(
          eq(Routines.id, routineEditId),
          eq(Routines.agentId, agentId),
          eq(Routines.userEmail, session.user.email),
        ))
        .limit(1);

      if (!savedRoutine) {
        return NextResponse.json({ error: "Routine not found" }, { status: 404 });
      }

      const currentRoutine = routineSchema.safeParse({
        name: savedRoutine.name,
        goal: savedRoutine.goal,
        instructions: savedRoutine.instructions,
        schedule: savedRoutine.schedule,
        tools: savedRoutine.tools,
      });
      if (!currentRoutine.success) {
        return NextResponse.json({ error: "Saved routine data is invalid" }, { status: 409 });
      }

      routineEditInstructions = `
Routine edit mode is active for the existing saved routine below. Current routine data: ${JSON.stringify(currentRoutine.data)}
The user is changing this routine, not creating a second one. Preserve all fields the user did not ask to change. If a required detail for the requested change is missing, respond with type="clarification" and ask a concise question; use the full conversation history after the user answers. Once you have enough information, respond with type="routine" and return the complete updated routine, including its task-specific instructions, schedule, and tools. Do not ask the user to repeat any current value that can be preserved from the saved routine.
`.trim();
    }

    const chatMessages = messages.map(
      (msg: { role: "user" | "assistant" | "agent"; content: string }) => ({
        role: msg.role === "agent" ? "assistant" : msg.role,
        content: msg.content,
      })
    );

    //ALl available tools
    const registeredTools = await db.select().from(Tools).where(eq(Tools.isActive, true));
    const toolsBySlug = new Map<string, {
      slug: string;
      name: string;
      description: string;
      icon?: string;
      isActive: boolean;
    }>(
      registeredTools.map((tool) => [tool.slug.toLowerCase(), {
        slug: tool.slug,
        name: tool.name,
        description: tool.description ?? "",
        icon: tool.icon,
        isActive: true,
      }]),
    );
    for (const tool of FALLBACK_TOOLKITS) {
      if (!toolsBySlug.has(tool.slug)) toolsBySlug.set(tool.slug, tool);
    }
    const tools = [...toolsBySlug.values()];

    const toolsCatalog = tools.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
    }));

    const configuredToolSlugs = Array.isArray(agentConfig.tools)
      ? agentConfig.tools.filter((tool): tool is string => typeof tool === "string")
      : [];
    let connectedAccountsForAgent: Record<string, string[]> = {};
    if (configuredToolSlugs.length > 0) {
      try {
        connectedAccountsForAgent = await getActiveConnectedAccounts(
          session.user.email,
          configuredToolSlugs,
          getComposio(),
        );
      } catch {
        // Keep chat available when Composio has not been configured.
      }
    }
    const connectedToolSlugs = Object.keys(connectedAccountsForAgent);

    const previousAgentMessage = [...messages]
      .reverse()
      .find((msg: { role: string; content?: string }) => msg.role !== "user");
    const latestUserText = typeof latestUserMessage?.content === "string"
      ? latestUserMessage.content
      : "";
    const asksHowToRun = /\bhow\s+(do|can|would|should)\b/i.test(latestUserText);
    const awaitingRoutineChoice = /which routine should i run/i.test(previousAgentMessage?.content ?? "");
    const wantsImmediateRun = !asksHowToRun && (
      /\b(run|execute|start|trigger|perform)\b/i.test(latestUserText) || awaitingRoutineChoice
    );
    if (wantsImmediateRun && !routineEditInstructions) {
      const savedRoutines = await db
        .select({ id: Routines.id, name: Routines.name, goal: Routines.goal })
        .from(Routines)
        .where(and(
          eq(Routines.agentId, agentId),
          eq(Routines.userEmail, session.user.email),
        ))
        .orderBy(asc(Routines.name));

      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const words = normalize(latestUserText).split(/\s+/).filter(Boolean);
      const matches = savedRoutines.map((routine) => {
        const title = normalize(routine.name);
        const titleWords = title.split(" ").filter((word) => word.length > 2 && !["daily", "weekly", "routine", "task"].includes(word));
        const matchingWords = titleWords.filter((word) => words.includes(word)).length;
        const exactTitle = Boolean(title && normalize(latestUserText).includes(title));
        const requiredWords = Math.min(2, titleWords.length);
        return { routine, score: exactTitle ? 100 : matchingWords, matched: exactTitle || (requiredWords > 0 && matchingWords >= requiredWords) };
      }).filter((match) => match.matched);

      const asksForFutureRun = /\b(tomorrow|later|tonight|next\s+(day|week|month)|at\s+\d|every\s+)\b/i.test(latestUserText);
      const ordinal = /\b(first|1st|one|1)\b/i.test(latestUserText) ? 0
        : /\b(second|2nd|two|2)\b/i.test(latestUserText) ? 1
          : /\b(third|3rd|three|3)\b/i.test(latestUserText) ? 2
            : -1;
      const immediateWording = awaitingRoutineChoice || (!asksForFutureRun && (
        /\b(now|immediately|right away|right now)\b/i.test(latestUserText) || /\broutine\b/i.test(latestUserText)
      ));
      const explicitlyNamedRoutine = !asksForFutureRun && matches.some((match) => match.score >= 100);
      let selectedRoutine = immediateWording || explicitlyNamedRoutine
        ? matches.length === 1 ? matches[0].routine : null
        : null;
      if (!selectedRoutine && matches.length > 1) {
        const highestScore = Math.max(...matches.map((match) => match.score));
        const bestMatches = matches.filter((match) => match.score === highestScore);
        if (bestMatches.length === 1 && highestScore >= 100) selectedRoutine = bestMatches[0].routine;
      }
      if (!selectedRoutine && savedRoutines.length === 1 && immediateWording) {
        selectedRoutine = savedRoutines[0];
      }
      if (!selectedRoutine && awaitingRoutineChoice && ordinal >= 0 && ordinal < savedRoutines.length) {
        selectedRoutine = savedRoutines[ordinal];
      }

      if (!selectedRoutine && (immediateWording || explicitlyNamedRoutine)) {
        const message = savedRoutines.length === 0
          ? "There are no saved routines for this agent yet. Create a routine first, then I can run it."
          : `Which routine should I run? ${savedRoutines.map((routine, index) => `${index + 1}. ${routine.name}`).join(" ")}`;
        const response: AgentResponse = { type: "message", message, questions: [], suggestedTools: [], routine: null };
        const historyMessageId = await saveAssistantMessage(response);
        return NextResponse.json({ response, toolCards: [], historyMessageId });
      }

      if (selectedRoutine) {
        try {
          const execution = await runRoutineImmediately({
            routineId: selectedRoutine.id,
            agentId,
            userEmail: session.user.email,
          });
          const response: AgentResponse = {
              type: "message",
              message: `I started **${selectedRoutine.name}**. I’ll let you know when it finishes.`,
              questions: [],
              suggestedTools: [],
              routine: null,
            };
          const routineExecution = {
            routineId: execution.routineId,
            routineName: execution.routineName,
            executionId: execution.executionId,
          };
          const historyMessageId = await saveAssistantMessage(response, [], { routineExecution });
          return NextResponse.json({
            response,
            toolCards: [],
            routineExecution,
            historyMessageId,
          });
        } catch (error) {
          if (!(error instanceof RoutineRunError)) throw error;
          const response: AgentResponse = {
              type: "message",
              message: error.message,
              questions: [],
              suggestedTools: [],
              routine: null,
            };
          const historyMessageId = await saveAssistantMessage(response);
          return NextResponse.json({ response, toolCards: [], historyMessageId });
        }
      }
    }

    if (Array.isArray(agentConfig.tools) && agentConfig.tools.length > 0) {
      const composioSession = await getOrCreateAgentSession(
        agentConfig as unknown as AgentConfigType,
        session.user.email
      );
      agentComposioTools = await composioSession.tools();
    }

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
      const connectedToolSet = new Set(connectedToolSlugs);
      const toolsToConnect = requestedTools.filter(
        (tool) => !connectedToolSet.has(tool.slug.toLowerCase()),
      );

      if (toolsToConnect.length === 0) {
        const toolNames = requestedTools.map((tool) => tool.name).join(" and ");
        response = {
          type: "message",
          message: `${toolNames} ${requestedTools.length === 1 ? "is" : "are"} already connected to this agent.`,
          questions: [],
          suggestedTools: [],
          routine: null,
        };
      } else {
        const toolNames = toolsToConnect.map((tool) => tool.name).join(" and ");
        response = {
          type: "tool_connection",
          message: `Use the cards below to connect ${toolNames}.`,
          questions: [],
          routine: null,
          suggestedTools: toolsToConnect.map((tool) => ({
            slug: tool.slug,
            reason: `${tool.name} needs account access to perform this task.`,
          })),
        };
      }
    } else {
      response = await executeAgentChat(
        agentConfig.name,
        [agentConfig.description ?? "", routineEditInstructions].filter(Boolean).join("\n\n"),
        chatMessages,
        [...agentComposioTools, createAgentVmTaskTool(agentId, session.user.email)],
        toolsCatalog,
        typeof timezone === "string" ? timezone : "UTC",
        connectedToolSlugs,
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

    const historyMessageId = await saveAssistantMessage(response, toolCards);
    return NextResponse.json({ response, toolCards, historyMessageId });

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
