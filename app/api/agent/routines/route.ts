import { db } from "@/db";
import { AgentConfig, Routines, Tools } from "@/db/schema";
import { routineSchema } from "@/lib/openai/agent-response-schema";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.agentId !== "string") {
      return NextResponse.json(
        { error: "An agent ID and routine are required" },
        { status: 400 },
      );
    }

    const parsedRoutine = routineSchema.safeParse(body.routine);
    if (!parsedRoutine.success) {
      return NextResponse.json(
        { error: "The routine details are invalid" },
        { status: 400 },
      );
    }

    const [agent] = await db
      .select({ agentid: AgentConfig.agentid })
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentid, body.agentId),
          eq(AgentConfig.userEmail, userEmail),
        ),
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const activeTools = await db
      .select({
        slug: Tools.slug,
        name: Tools.name,
        description: Tools.description,
        icon: Tools.icon,
      })
      .from(Tools)
      .where(eq(Tools.isActive, true));
    const toolsBySlug = new Map(activeTools.map((tool) => [tool.slug, tool]));
    const requestedSlugs = parsedRoutine.data.tools.map((tool) => tool.slug);

    if (new Set(requestedSlugs).size !== requestedSlugs.length) {
      return NextResponse.json(
        { error: "A tool can only be attached once" },
        { status: 400 },
      );
    }

    const missingTool = requestedSlugs.find((slug) => !toolsBySlug.has(slug));
    if (missingTool) {
      return NextResponse.json(
        { error: `Tool ${missingTool} is unavailable` },
        { status: 400 },
      );
    }

    const attachedTools = parsedRoutine.data.tools.map((suggestion) => {
      const tool = toolsBySlug.get(suggestion.slug)!;
      return {
        ...suggestion,
        name: tool.name,
        description: tool.description ?? "",
        icon: tool.icon,
      };
    });

    const [routine] = await db
      .insert(Routines)
      .values({
        id: crypto.randomUUID(),
        agentId: agent.agentid,
        userEmail,
        name: parsedRoutine.data.name,
        goal: parsedRoutine.data.goal,
        instructions: parsedRoutine.data.instructions,
        schedule: parsedRoutine.data.schedule,
        tools: attachedTools,
      })
      .returning();

    return NextResponse.json({ routine, toolCards: attachedTools }, { status: 201 });
  } catch (error) {
    console.error("Failed to create routine:", error);
    return NextResponse.json(
      { error: "Failed to create routine" },
      { status: 500 },
    );
  }
}
