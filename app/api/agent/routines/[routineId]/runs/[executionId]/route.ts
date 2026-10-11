import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { getRoutineRunStatus } from "@/lib/inngest/run-routine";

type RouteContext = { params: Promise<{ routineId: string; executionId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { routineId, executionId } = await params;
  const execution = await getRoutineRunStatus({ executionId, routineId, userEmail });
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  return NextResponse.json({ execution });
}
