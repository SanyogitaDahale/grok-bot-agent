import { db } from "@/db";
import { AgentConfig, RoutineExecutions, Routines } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

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

    const executions = await db.select({
      id: RoutineExecutions.id,
      routineId: RoutineExecutions.routineId,
      routineName: Routines.name,
      status: RoutineExecutions.status,
      runType: RoutineExecutions.runType,
      scheduledFor: RoutineExecutions.scheduledFor,
      queuedAt: RoutineExecutions.queuedAt,
      startedAt: RoutineExecutions.startedAt,
      completedAt: RoutineExecutions.completedAt,
      result: RoutineExecutions.result,
      error: RoutineExecutions.error,
    }).from(RoutineExecutions)
      .innerJoin(Routines, eq(RoutineExecutions.routineId, Routines.id))
      .where(and(
        eq(RoutineExecutions.agentId, agentId),
        eq(RoutineExecutions.userEmail, userEmail),
      ))
      .orderBy(desc(RoutineExecutions.queuedAt))
      .limit(100);

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("Failed to load routine execution history:", error);
    return NextResponse.json({ error: "Failed to load routine execution history" }, { status: 500 });
  }
}
