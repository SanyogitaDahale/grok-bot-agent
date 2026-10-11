import { db } from "@/db";
import { RoutineExecutions, Routines } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import { and, eq, lte, or } from "drizzle-orm";

export class RoutineRunError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "already_running" | "queue_failed",
  ) {
    super(message);
    this.name = "RoutineRunError";
  }
}

export async function runRoutineImmediately({
  routineId,
  agentId,
  userEmail,
}: {
  routineId: string;
  agentId: string;
  userEmail: string;
}) {
  const scheduledFor = new Date();
  const executionId = `${routineId}:${scheduledFor.getTime()}`;

  const reservation = await db.transaction(async (tx) => {
    const [routine] = await tx
      .select({ id: Routines.id, name: Routines.name })
      .from(Routines)
      .where(and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, userEmail),
      ))
      .for("update");

    if (!routine) return { kind: "not_found" as const };

    const [activeExecution] = await tx
      .select({ id: RoutineExecutions.id })
      .from(RoutineExecutions)
      .where(and(
        eq(RoutineExecutions.routineId, routine.id),
        or(
          eq(RoutineExecutions.status, "running"),
          and(
            eq(RoutineExecutions.status, "queued"),
            lte(RoutineExecutions.scheduledFor, scheduledFor),
          ),
        ),
      ))
      .limit(1);

    if (activeExecution) return { kind: "already_running" as const };

    await tx.insert(RoutineExecutions).values({
      id: executionId,
      routineId: routine.id,
      agentId,
      userEmail,
      scheduledFor,
      runType: "manual",
      status: "queued",
    });

    return { kind: "queued" as const, routineName: routine.name };
  });

  if (reservation.kind === "not_found") {
    throw new RoutineRunError("Routine not found", "not_found");
  }
  if (reservation.kind === "already_running") {
    throw new RoutineRunError("This routine is already running", "already_running");
  }

  try {
    await inngest.send({
      id: `routine-manual-${executionId}`,
      name: "agent/routine.execute",
      data: { executionId, scheduledFor: scheduledFor.toISOString() },
    });
  } catch (error) {
    await db
      .update(RoutineExecutions)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 8000) : String(error).slice(0, 8000),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(RoutineExecutions.id, executionId),
        eq(RoutineExecutions.status, "queued"),
      ));
    throw new RoutineRunError("Could not start this routine. Please try again.", "queue_failed");
  }

  return {
    routineId,
    routineName: reservation.routineName,
    executionId,
    status: "queued" as const,
  };
}

export async function getRoutineRunStatus({
  executionId,
  routineId,
  userEmail,
}: {
  executionId: string;
  routineId: string;
  userEmail: string;
}) {
  const [execution] = await db
    .select({
      id: RoutineExecutions.id,
      status: RoutineExecutions.status,
      result: RoutineExecutions.result,
      error: RoutineExecutions.error,
      runType: RoutineExecutions.runType,
    })
    .from(RoutineExecutions)
    .where(and(
      eq(RoutineExecutions.id, executionId),
      eq(RoutineExecutions.routineId, routineId),
      eq(RoutineExecutions.userEmail, userEmail),
    ))
    .limit(1);

  return execution ?? null;
}
