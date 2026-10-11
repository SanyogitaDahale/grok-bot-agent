import { db } from "@/db";
import { RoutineExecutions, Routines, Tools } from "@/db/schema";
import { routineSchema } from "@/lib/openai/agent-response-schema";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { FALLBACK_TOOLKITS } from "@/lib/composio/tool-catalog";
import { getNextRoutineOccurrence, type RoutineSchedule } from "@/lib/inngest/routine-schedule";
import { inngest } from "@/lib/inngest/client";

type RouteContext = { params: Promise<{ routineId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { routineId } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.agentId !== "string") {
      return NextResponse.json({ error: "An agent ID is required" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: Routines.id, schedule: Routines.schedule, isActive: Routines.isActive })
      .from(Routines)
      .where(and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, body.agentId),
        eq(Routines.userEmail, userEmail),
      ))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    if (typeof body.isActive === "boolean" && body.routine === undefined) {
      const [routine] = await db
        .update(Routines)
        .set({
          isActive: body.isActive,
          nextRunAt: body.isActive
            ? getNextRoutineOccurrence(existing.schedule as RoutineSchedule, new Date())
            : null,
        })
        .where(and(eq(Routines.id, routineId), eq(Routines.agentId, body.agentId), eq(Routines.userEmail, userEmail)))
        .returning();
      if (!body.isActive) {
        await db
          .update(RoutineExecutions)
          .set({ status: "cancelled", error: "The routine was deactivated.", completedAt: new Date(), updatedAt: new Date() })
          .where(and(
            eq(RoutineExecutions.routineId, routineId),
            eq(RoutineExecutions.status, "queued"),
          ));
      } else {
        await inngest.send({
          id: `schedule-routine-${routine.id}-${crypto.randomUUID()}`,
          name: "agent/routines.schedule",
          data: { agentId: routine.agentId },
        }).catch((error) => {
          console.error("Failed to trigger routine scheduling scan:", error);
        });
      }
      return NextResponse.json({ routine });
    }

    const parsedRoutine = routineSchema.safeParse(body.routine);
    if (!parsedRoutine.success) {
      return NextResponse.json({ error: "The routine details are invalid" }, { status: 400 });
    }
    if (parsedRoutine.data.schedule.frequency === "weekly" && parsedRoutine.data.schedule.weekDays.length === 0) {
      return NextResponse.json({ error: "Select at least one day for a weekly routine" }, { status: 400 });
    }

    const activeTools = await db
      .select({ slug: Tools.slug, name: Tools.name, description: Tools.description, icon: Tools.icon })
      .from(Tools)
      .where(eq(Tools.isActive, true));
    const toolsBySlug = new Map<string, { slug: string; name: string; description: string | null; icon: string }>(
      activeTools.map((tool) => [tool.slug.toLowerCase(), tool]),
    );
    for (const tool of FALLBACK_TOOLKITS) {
      if (!toolsBySlug.has(tool.slug)) {
        toolsBySlug.set(tool.slug, {
          slug: tool.slug,
          name: tool.name,
          description: tool.description,
          icon: tool.icon ?? "",
        });
      }
    }
    const requestedSlugs = parsedRoutine.data.tools.map((tool) => tool.slug);
    if (new Set(requestedSlugs).size !== requestedSlugs.length) {
      return NextResponse.json({ error: "A tool can only be attached once" }, { status: 400 });
    }

    const missingTool = requestedSlugs.find((slug) => !toolsBySlug.has(slug.toLowerCase()));
    if (missingTool) {
      return NextResponse.json({ error: `Tool ${missingTool} is unavailable` }, { status: 400 });
    }

    const attachedTools = parsedRoutine.data.tools.map((suggestion) => {
      const tool = toolsBySlug.get(suggestion.slug.toLowerCase())!;
      return { ...suggestion, name: tool.name, description: tool.description ?? "", icon: tool.icon };
    });

    const [routine] = await db
      .update(Routines)
      .set({
        name: parsedRoutine.data.name,
        goal: parsedRoutine.data.goal,
        instructions: parsedRoutine.data.instructions,
        schedule: parsedRoutine.data.schedule,
        tools: attachedTools,
        nextRunAt: existing.isActive
          ? getNextRoutineOccurrence(parsedRoutine.data.schedule, new Date())
          : null,
      })
      .where(and(eq(Routines.id, routineId), eq(Routines.agentId, body.agentId), eq(Routines.userEmail, userEmail)))
      .returning();

    await db
      .update(RoutineExecutions)
      .set({ status: "cancelled", error: "The routine schedule was updated.", completedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(RoutineExecutions.routineId, routineId),
        eq(RoutineExecutions.status, "queued"),
      ));

    if (existing.isActive) {
      await inngest.send({
        id: `schedule-routine-${routine.id}-${crypto.randomUUID()}`,
        name: "agent/routines.schedule",
        data: { agentId: routine.agentId },
      }).catch((error) => {
        console.error("Failed to trigger routine scheduling scan:", error);
      });
    }

    return NextResponse.json({ routine });
  } catch (error) {
    console.error("Failed to update routine:", error);
    return NextResponse.json({ error: "Failed to update routine" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { routineId } = await params;
    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json({ error: "An agent ID is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(Routines)
      .where(and(eq(Routines.id, routineId), eq(Routines.agentId, agentId), eq(Routines.userEmail, userEmail)))
      .returning({ id: Routines.id });
    if (!deleted) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete routine:", error);
    return NextResponse.json({ error: "Failed to delete routine" }, { status: 500 });
  }
}
