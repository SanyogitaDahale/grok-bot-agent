import { AgentChatHistory, AgentConfig, RoutineExecutions, Routines, db } from "@/db";
import {
  appendAgentChatMessages,
  filterUnexpiredMessages,
  getChatHistoryExpiry,
} from "@/lib/agent-chat-history";
import { getComposio } from "@/lib/composio/composio";
import { createAgent, buildAgentInstructions } from "@/lib/openai/openai-agent";
import { agentResponseSchema } from "@/lib/openai/agent-response-schema";
import { run } from "@openai/agents";
import { and, eq, lte, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import {
  getNextRoutineOccurrence,
  getRoutineOccurrenceInWindow,
  isRoutineOccurrence,
  type RoutineSchedule,
} from "./routine-schedule";

const ROUTINE_EXECUTION_EVENT = "agent/routine.execute";
const ROUTINES_CHANGED_EVENT = "agent/routines.schedule";
const LOOK_AHEAD_MS = 60 * 60 * 1000;

type RoutineRunEvent = {
  executionId: string;
  scheduledFor: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function appendRoutineExecutionToChat({
  executionId,
  status,
  summary,
}: {
  executionId: string;
  status: "completed" | "failed";
  summary: string;
}) {
  const [execution] = await db
    .select({
      id: RoutineExecutions.id,
      routineId: RoutineExecutions.routineId,
      agentId: RoutineExecutions.agentId,
      userEmail: RoutineExecutions.userEmail,
      completedAt: RoutineExecutions.completedAt,
      routineName: Routines.name,
    })
    .from(RoutineExecutions)
    .innerJoin(Routines, eq(RoutineExecutions.routineId, Routines.id))
    .where(eq(RoutineExecutions.id, executionId))
    .limit(1);

  if (!execution) return;

  await appendAgentChatMessages({
    agentId: execution.agentId,
    userEmail: execution.userEmail,
    messages: [{
      id: `routine-execution:${execution.id}`,
      role: "agent",
      content: `**Routine ${status}:** ${execution.routineName}\n\n${summary}`,
      time: (execution.completedAt ?? new Date()).toISOString(),
      routineExecution: {
        routineId: execution.routineId,
        routineName: execution.routineName,
        executionId: execution.id,
        status,
      },
    }],
  });
}

function getRunEventData(event: unknown): RoutineRunEvent | null {
  if (!event || typeof event !== "object") return null;

  const outer = event as Record<string, unknown>;
  const outerData = outer.data;
  if (!outerData || typeof outerData !== "object") return null;

  // Inngest wraps the failed function's original event in `data.event`.
  const eventData = outerData as Record<string, unknown>;
  const failedEvent = eventData.event;
  const runData = failedEvent && typeof failedEvent === "object"
    ? (failedEvent as Record<string, unknown>).data
    : outerData;
  if (!runData || typeof runData !== "object") return null;

  const { executionId, scheduledFor } = runData as Record<string, unknown>;
  if (typeof executionId !== "string" || typeof scheduledFor !== "string") return null;
  return { executionId, scheduledFor };
}

type DueRoutine = {
  id: string;
  agentId: string;
  userEmail: string;
  scheduledFor: string;
};

type RoutineTool = {
  slug: string;
  name?: string;
  description?: string;
};

function parseRoutineTools(value: unknown): RoutineTool[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tool): RoutineTool[] => {
    if (!tool || typeof tool !== "object") return [];
    const record = tool as Record<string, unknown>;
    if (typeof record.slug !== "string") return [];
    return [{
      slug: record.slug,
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.description === "string" ? { description: record.description } : {}),
    }];
  });
}

function getExecutionId(routineId: string, scheduledFor: Date) {
  return `${routineId}:${scheduledFor.getTime()}`;
}

function isRoutineSchedule(value: unknown): value is RoutineSchedule {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Partial<RoutineSchedule>;
  return (
    typeof schedule.startDate === "string" &&
    typeof schedule.time === "string" &&
    typeof schedule.timezone === "string" &&
    ["once", "daily", "weekly", "monthly"].includes(schedule.frequency ?? "") &&
    Array.isArray(schedule.weekDays)
  );
}

export const scheduleRoutineExecutions = inngest.createFunction(
  {
    id: "schedule-routine-executions",
    name: "Schedule Upcoming Routine Executions",
    retries: 3,
  },
  [{ cron: "0 * * * *" }, { event: ROUTINES_CHANGED_EVENT }],
  async ({ event, step }) => {
    // Use the cron event time so retries inspect the same one-hour window.
    const windowStart = new Date(event.ts ?? Date.now());
    const windowEnd = new Date(windowStart.getTime() + LOOK_AHEAD_MS);

    const executions = await step.run("find-and-reserve-upcoming-runs", async () => {
      const routines = await db
        .select({
          id: Routines.id,
          agentId: Routines.agentId,
          userEmail: Routines.userEmail,
          schedule: Routines.schedule,
          isActive: Routines.isActive,
        })
        .from(Routines)
        .where(eq(Routines.isActive, true));

      const dueRoutines: DueRoutine[] = [];
      for (const routine of routines) {
        if (!isRoutineSchedule(routine.schedule)) {
          console.error(`Skipping routine ${routine.id}: invalid schedule data`);
          continue;
        }

        const occurrence = getRoutineOccurrenceInWindow(
          routine.schedule,
          windowStart,
          windowEnd,
        );
        await db
          .update(Routines)
          .set({
            nextRunAt: getNextRoutineOccurrence(
              routine.schedule,
              new Date(windowStart.getTime() - 1),
            ),
          })
          .where(eq(Routines.id, routine.id));
        if (occurrence) {
          dueRoutines.push({
            id: routine.id,
            agentId: routine.agentId,
            userEmail: routine.userEmail,
            scheduledFor: occurrence.toISOString(),
          });
        }
      }

      const rows = await db
        .select({
          id: RoutineExecutions.routineId,
          agentId: RoutineExecutions.agentId,
          userEmail: RoutineExecutions.userEmail,
          scheduledFor: RoutineExecutions.scheduledFor,
        })
        .from(RoutineExecutions)
        .where(and(
          eq(RoutineExecutions.status, "queued"),
          lte(RoutineExecutions.scheduledFor, windowStart),
        ));

      const pendingPastExecutions: DueRoutine[] = rows.map((row) => ({
        ...row,
        scheduledFor: row.scheduledFor.toISOString(),
      }));

      const byExecutionId = new Map<string, DueRoutine>();
      for (const due of [...dueRoutines, ...pendingPastExecutions]) {
        const scheduledFor = new Date(due.scheduledFor);
        byExecutionId.set(getExecutionId(due.id, scheduledFor), due);
      }

      const reserved: Array<{ executionId: string; scheduledFor: string }> = [];
      for (const [executionId, dueRoutine] of byExecutionId) {
        const scheduledFor = new Date(dueRoutine.scheduledFor);
        const [inserted] = await db
          .insert(RoutineExecutions)
          .values({
            id: executionId,
            routineId: dueRoutine.id,
            agentId: dueRoutine.agentId,
            userEmail: dueRoutine.userEmail,
            scheduledFor,
            runType: "scheduled",
            status: "queued",
          })
          .onConflictDoNothing({
            target: [RoutineExecutions.routineId, RoutineExecutions.scheduledFor],
          })
          .returning({ id: RoutineExecutions.id, status: RoutineExecutions.status });

        if (!inserted) {
          const [existing] = await db
            .select({ id: RoutineExecutions.id, status: RoutineExecutions.status })
            .from(RoutineExecutions)
            .where(and(
              eq(RoutineExecutions.routineId, dueRoutine.id),
              eq(RoutineExecutions.scheduledFor, scheduledFor),
            ))
            .limit(1);
          if (existing?.status !== "queued") continue;
        }

        reserved.push({ executionId, scheduledFor: scheduledFor.toISOString() });
      }

      return reserved;
    });

    if (executions.length > 0) {
      await step.sendEvent(
        "enqueue-routine-executions",
        executions.map(({ executionId, scheduledFor }) => ({
          id: `routine-execution-${executionId}`,
          name: ROUTINE_EXECUTION_EVENT,
          data: { executionId, scheduledFor },
        })),
      );
    }

    return {
      checkedAt: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      enqueued: executions.length,
    };
  },
);

export const pruneExpiredAgentChatHistory = inngest.createFunction(
  {
    id: "prune-expired-agent-chat-history",
    name: "Prune Expired Agent Chat History",
    retries: 2,
  },
  { cron: "17 * * * *" },
  async () => {
    const now = new Date();
    const histories = await db.select({
      id: AgentChatHistory.id,
      messages: AgentChatHistory.messages,
      updatedAt: AgentChatHistory.updatedAt,
    }).from(AgentChatHistory);
    let deletedCount = 0;
    let prunedMessageCount = 0;

    for (const history of histories) {
      const messages = filterUnexpiredMessages(history.messages, now);
      prunedMessageCount += history.messages.length - messages.length;
      if (messages.length === 0) {
        await db.delete(AgentChatHistory).where(and(
          eq(AgentChatHistory.id, history.id),
          eq(AgentChatHistory.updatedAt, history.updatedAt),
        ));
        deletedCount += 1;
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
    }

    return { prunedAt: now.toISOString(), deletedCount, prunedMessageCount };
  },
);

export const executeScheduledRoutine = inngest.createFunction(
  {
    id: "execute-scheduled-routine",
    name: "Execute Scheduled Routine",
    retries: 3,
    onFailure: async ({ event, error, step }) => {
      const runEvent = getRunEventData(event);
      if (!runEvent) return { status: "failure-not-recorded", reason: "missing or invalid run event" };

      await step.run("mark-routine-execution-failed", async () => {
        const [failedExecution] = await db
          .update(RoutineExecutions)
          .set({
            status: "failed",
            error: errorMessage(error).slice(0, 8000),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(RoutineExecutions.id, runEvent.executionId),
            sql`${RoutineExecutions.status} <> 'completed'`,
          ))
          .returning({ id: RoutineExecutions.id });
        if (!failedExecution) return { status: "already-completed" };

        await appendRoutineExecutionToChat({
          executionId: runEvent.executionId,
          status: "failed",
          summary: errorMessage(error).slice(0, 8000),
        });
        return { status: "failed" };
      });
      return { executionId: runEvent.executionId, status: "failed" };
    },
  },
  { event: ROUTINE_EXECUTION_EVENT },
  async ({ event, step }) => {
    const data = getRunEventData(event);
    if (!data?.executionId || !data?.scheduledFor) {
      throw new NonRetriableError("Routine execution event is missing its execution ID or scheduled time");
    }

    const executionInfo = await step.run("load-routine-execution-time", async () => {
      const [execution] = await db
        .select({ id: RoutineExecutions.id, scheduledFor: RoutineExecutions.scheduledFor, status: RoutineExecutions.status })
        .from(RoutineExecutions)
        .where(eq(RoutineExecutions.id, data.executionId))
        .limit(1);
      if (!execution) return null;
      if (execution.scheduledFor.toISOString() !== new Date(data.scheduledFor).toISOString()) {
        throw new NonRetriableError("Routine execution event time does not match its database record");
      }
      return { scheduledFor: execution.scheduledFor.toISOString(), status: execution.status };
    });

    if (!executionInfo || executionInfo.status !== "queued") {
      return { executionId: data.executionId, status: executionInfo?.status ?? "missing" };
    }

    await step.sleepUntil("wait-for-scheduled-time", executionInfo.scheduledFor);

    const claim = await step.run("claim-routine-execution", async () => db.transaction(async (tx) => {
      const [execution] = await tx
        .select()
        .from(RoutineExecutions)
        .where(eq(RoutineExecutions.id, data.executionId))
        .limit(1);
      if (!execution || execution.status !== "queued") return { claimed: false as const, status: execution?.status ?? "missing" };

      const [routine] = await tx
        .select()
        .from(Routines)
        .where(and(
          eq(Routines.id, execution.routineId),
          eq(Routines.agentId, execution.agentId),
          eq(Routines.userEmail, execution.userEmail),
        ))
        .for("update");

      const cancel = async (reason: string) => {
        await tx
          .update(RoutineExecutions)
          .set({ status: "cancelled", error: reason, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(RoutineExecutions.id, execution.id), eq(RoutineExecutions.status, "queued")));
        return { claimed: false as const, status: "cancelled" };
      };

      if (!routine) return cancel("The routine no longer exists.");
      const isManualRun = execution.runType === "manual";
      if (!routine.isActive && !isManualRun) return cancel("The routine was deactivated before its scheduled run.");
      if (!isManualRun && (!isRoutineSchedule(routine.schedule) || !isRoutineOccurrence(routine.schedule, execution.scheduledFor))) {
        return cancel("The routine schedule changed before this execution.");
      }

      const [otherRunningExecution] = await tx
        .select({ id: RoutineExecutions.id })
        .from(RoutineExecutions)
        .where(and(
          eq(RoutineExecutions.routineId, routine.id),
          eq(RoutineExecutions.status, "running"),
          sql`${RoutineExecutions.id} <> ${execution.id}`,
        ))
        .limit(1);
      if (otherRunningExecution) return cancel("Another execution of this routine is already running.");

      const [agent] = await tx
        .select({
          agentid: AgentConfig.agentid,
          userEmail: AgentConfig.userEmail,
          name: AgentConfig.name,
          description: AgentConfig.description,
          tools: AgentConfig.tools,
          composioSessionId: AgentConfig.composioSessionId,
        })
        .from(AgentConfig)
        .where(and(
          eq(AgentConfig.agentid, routine.agentId),
          eq(AgentConfig.userEmail, routine.userEmail),
        ))
        .limit(1);
      if (!agent) return cancel("The routine's agent no longer exists.");

      const routineTools = parseRoutineTools(routine.tools);

      const [updated] = await tx
        .update(RoutineExecutions)
        .set({ status: "running", startedAt: new Date(), updatedAt: new Date(), error: null })
        .where(and(
          eq(RoutineExecutions.id, execution.id),
          eq(RoutineExecutions.status, "queued"),
        ))
        .returning({ id: RoutineExecutions.id });
      if (!updated) return { claimed: false as const, status: "already-claimed" };

      await tx
        .update(Routines)
        .set({
          nextRunAt: isManualRun
            ? routine.nextRunAt
            : getNextRoutineOccurrence(routine.schedule as RoutineSchedule, execution.scheduledFor),
        })
        .where(eq(Routines.id, routine.id));

      return {
        claimed: true as const,
        executionId: execution.id,
        scheduledFor: execution.scheduledFor.toISOString(),
        routine: {
          id: routine.id,
          name: routine.name,
          goal: routine.goal,
          instructions: routine.instructions,
          schedule: routine.schedule,
          tools: routineTools,
        },
        agent,
      };
    }));

    if (!claim.claimed) return { executionId: data.executionId, status: claim.status };

    const prepared = await step.run("prepare-routine-agent", async () => {
      const requiredToolSlugs = Array.isArray(claim.routine.tools)
        ? claim.routine.tools
            .map((tool) => tool && typeof tool.slug === "string" ? tool.slug.toLowerCase() : null)
            .filter((slug): slug is string => Boolean(slug))
        : [];
      const configuredToolSlugs = Array.isArray(claim.agent.tools)
        ? claim.agent.tools.filter((slug): slug is string => typeof slug === "string").map((slug) => slug.toLowerCase())
        : [];

      let sessionId: string | null = null;
      if (requiredToolSlugs.length > 0) {
        const composio = getComposio();
        const connected = await composio.connectedAccounts.list({
          userIds: [claim.agent.userEmail],
          toolkitSlugs: requiredToolSlugs,
          statuses: ["ACTIVE"],
        });
        const connectedSlugs = new Set(
          connected.items
            .map((account: any) => account.toolkit?.slug?.toLowerCase())
            .filter((slug: unknown): slug is string => typeof slug === "string"),
        );
        const missing = requiredToolSlugs.filter((slug) => !connectedSlugs.has(slug));
        if (missing.length > 0) {
          throw new NonRetriableError(`Required tools are not connected: ${missing.join(", ")}`);
        }

        sessionId = claim.agent.composioSessionId;
        const allowedToolkits = [...new Set([...configuredToolSlugs, ...requiredToolSlugs])];
        if (!sessionId) {
          const session = await composio.sessions.create(claim.agent.userEmail, {
            toolkits: allowedToolkits,
          });
          sessionId = session.sessionId;
          await db
            .update(AgentConfig)
            .set({ composioSessionId: sessionId })
            .where(and(
              eq(AgentConfig.agentid, claim.agent.agentid),
              eq(AgentConfig.userEmail, claim.agent.userEmail),
            ));
        } else if (requiredToolSlugs.some((slug) => !configuredToolSlugs.includes(slug))) {
          const session = await composio.sessions.use(sessionId);
          await session.update({ toolkits: allowedToolkits });
        }
      }

      return {
        sessionId,
        connectedToolSlugs: requiredToolSlugs,
        availableTools: requiredToolSlugs.map((slug) => ({
          slug,
          name: claim.routine.tools.find((tool: any) => tool?.slug?.toLowerCase() === slug)?.name ?? slug,
          description: claim.routine.tools.find((tool: any) => tool?.slug?.toLowerCase() === slug)?.description ?? "",
        })),
      };
    });

    let aiTools: any[] = [];
    if (prepared.sessionId) {
      const composioSession = await getComposio().sessions.use(prepared.sessionId);
      aiTools = await composioSession.tools();
    }

    const result = await step.run("run-routine-agent-workflow", async () => {
      const schedule = claim.routine.schedule as RoutineSchedule;
      const availableTools = prepared.availableTools as Array<{ slug: string; name: string; description: string }>;
      const connectedToolSlugs = prepared.connectedToolSlugs as string[];
      const prompt = [
        `Execute the scheduled routine "${claim.routine.name}" now.`,
        `Goal: ${claim.routine.goal}`,
        `Task instructions: ${claim.routine.instructions}`,
        `This occurrence is scheduled for ${claim.scheduledFor} (${schedule.timezone}); the configured local time is ${schedule.time}.`,
        `Required tools: ${availableTools.map((tool) => tool.slug).join(", ") || "none"}.`,
        "Follow the task instructions in order. Use only the required connected tools. Wait for each tool result before taking the next action, and do not claim an action succeeded unless a tool result confirms it. Honor any requested external delivery destination from the task instructions. Do not create or modify a routine. Return a concise report of what you completed or what prevented completion; the report will also be saved to this agent's chat history so the user can review it later.",
      ].join("\n\n");
      const instructions = [
        buildAgentInstructions(
          claim.agent.name,
          claim.agent.description ?? "",
          availableTools,
          schedule.timezone,
          connectedToolSlugs,
        ),
        "Scheduled execution mode: perform the user's saved task now using the available tools. Return type=\"message\", with questions=[], suggestedTools=[], and routine=null. Do not ask for clarification; report any missing information or tool failure instead.",
      ].join("\n\n");
      const agent = createAgent(claim.agent.name, instructions, aiTools);
      const agentResult = await run(agent, prompt);
      const output = agentResponseSchema.parse(agentResult.finalOutput);
      if (output.type !== "message") {
        throw new Error(`Routine agent returned unexpected response type: ${output.type}`);
      }
      return {
        message: output.message,
        completedAt: new Date().toISOString(),
      };
    });

    await step.run("save-routine-execution-result", async () => {
      await db
        .update(RoutineExecutions)
        .set({
          status: "completed",
          result,
          error: null,
          completedAt: new Date(result.completedAt),
          updatedAt: new Date(),
        })
        .where(and(
          eq(RoutineExecutions.id, claim.executionId),
          sql`${RoutineExecutions.status} = 'running'`,
        ));
    });

    await step.run("append-routine-result-to-agent-chat", async () => {
      await appendRoutineExecutionToChat({
        executionId: claim.executionId,
        status: "completed",
        summary: result.message,
      });
    });

    return { executionId: claim.executionId, status: "completed", result };
  },
);
