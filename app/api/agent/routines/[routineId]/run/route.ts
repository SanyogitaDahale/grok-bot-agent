import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { RoutineRunError, runRoutineImmediately } from "@/lib/inngest/run-routine";

type RouteContext = { params: Promise<{ routineId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { routineId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.agentId !== "string") {
    return NextResponse.json({ error: "An agent ID is required" }, { status: 400 });
  }

  try {
    const execution = await runRoutineImmediately({ routineId, agentId: body.agentId, userEmail });
    return NextResponse.json({ execution }, { status: 202 });
  } catch (error) {
    if (error instanceof RoutineRunError) {
      const status = error.code === "not_found" ? 404 : error.code === "already_running" ? 409 : 503;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Failed to start routine immediately:", error);
    return NextResponse.json({ error: "Could not start this routine" }, { status: 500 });
  }
}
