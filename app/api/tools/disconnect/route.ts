import { and, eq, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { ComposioConfigurationError, getComposio } from "@/lib/composio/composio";
import { getFallbackToolkit } from "@/lib/composio/tool-catalog";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, toolkitSlug } = body;
    if (
      typeof agentId !== "string" ||
      !agentId.trim() ||
      typeof toolkitSlug !== "string" ||
      !toolkitSlug.trim()
    ) {
      return NextResponse.json(
        { error: "A valid agent ID and toolkit slug are required" },
        { status: 400 },
      );
    }

    const [agent] = await db
      .select({
        agentid: AgentConfig.agentid,
        composioSessionId: AgentConfig.composioSessionId,
      })
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

    const [registeredTool] = await db
      .select({ slug: Tools.slug })
      .from(Tools)
      .where(sql`lower(${Tools.slug}) = lower(${toolkitSlug})`)
      .limit(1);
    const fallbackTool = getFallbackToolkit(toolkitSlug);
    if (!registeredTool && !fallbackTool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    const toolSlug = (registeredTool?.slug ?? fallbackTool!.slug).toLowerCase();

    const composio = getComposio();
    const result = await composio.connectedAccounts.list({
      userIds: [session.user.email],
      toolkitSlugs: [toolSlug],
      statuses: ["ACTIVE"],
    });
    const ownedAccounts = result.items.filter(
      (account: any) => account.toolkit?.slug?.toLowerCase() === toolSlug.toLowerCase(),
    );

    await Promise.all(
      ownedAccounts.map((account: any) => composio.connectedAccounts.revoke(account.id)),
    );

    await db
      .update(AgentConfig)
      .set({
        tools: sql`COALESCE(${AgentConfig.tools}, '[]'::jsonb) - ${toolSlug}`,
      })
      .where(
        and(
          eq(AgentConfig.agentid, agent.agentid),
          eq(AgentConfig.userEmail, session.user.email),
        ),
      );

    if (agent.composioSessionId) {
      const [updatedAgent] = await db
        .select({ tools: AgentConfig.tools })
        .from(AgentConfig)
        .where(eq(AgentConfig.agentid, agent.agentid))
        .limit(1);
      const remainingTools = Array.isArray(updatedAgent?.tools)
        ? updatedAgent.tools.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
        : [];
      const composioSession = await composio.sessions.use(agent.composioSessionId);
      await composioSession.update({ toolkits: remainingTools });
    }

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    if (error instanceof ComposioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Tool disconnection error:", error);
    return NextResponse.json(
      { error: "Could not disconnect tool" },
      { status: 500 },
    );
  }
}
