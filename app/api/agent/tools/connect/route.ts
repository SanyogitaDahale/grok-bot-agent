import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { getComposio, ComposioConfigurationError } from "@/lib/composio/composio";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, toolSlug } = body;

    if (
      typeof agentId !== "string" ||
      !agentId.trim() ||
      typeof toolSlug !== "string" ||
      !toolSlug.trim()
    ) {
      return NextResponse.json(
        { error: "An agent ID and tool slug are required" },
        { status: 400 },
      );
    }

    const [agent] = await db
      .select({ agentid: AgentConfig.agentid })
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentid, agentId),
          eq(AgentConfig.userEmail, session.user.email),
        ),
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [tool] = await db
      .select({ slug: Tools.slug })
      .from(Tools)
      .where(and(eq(Tools.slug, toolSlug), eq(Tools.isActive, true)))
      .limit(1);

    if (!tool) {
      return NextResponse.json({ error: "Tool is unavailable" }, { status: 404 });
    }

    const composio = getComposio();
    const connectionSession = await composio.sessions.create(session.user.email, {
      toolkits: [tool.slug],
    });
    const connection = await connectionSession.authorize(tool.slug, {
      callbackUrl: `${request.nextUrl.origin}/workspace/${agentId}`,
    });

    return NextResponse.json({ redirectUrl: connection.redirectUrl });
  } catch (error) {
    if (error instanceof ComposioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Tool connection error:", error);
    return NextResponse.json(
      { error: "Could not start tool connection" },
      { status: 500 },
    );
  }
}
