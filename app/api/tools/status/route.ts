import { and, eq, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { ComposioConfigurationError, getComposio } from "@/lib/composio/composio";
import { getFallbackToolkit } from "@/lib/composio/tool-catalog";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get("agentId");
    const toolkitSlug = req.nextUrl.searchParams.get("toolkitSlug");
    if (!agentId?.trim() || !toolkitSlug?.trim()) {
      return NextResponse.json(
        { error: "An agent ID and valid toolkit slug are required" },
        { status: 400 },
      );
    }

    const [agent] = await db
      .select({
        agentid: AgentConfig.agentid,
        tools: AgentConfig.tools,
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

    const [registeredTool] = await db
      .select({ slug: Tools.slug, isActive: Tools.isActive })
      .from(Tools)
      .where(sql`lower(${Tools.slug}) = lower(${toolkitSlug})`)
      .limit(1);

    const fallbackTool = getFallbackToolkit(toolkitSlug);
    if (!agent || (!registeredTool && !fallbackTool)) {
      return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
    }
    if (registeredTool && !registeredTool.isActive) {
      return NextResponse.json({ error: "This tool is unavailable" }, { status: 404 });
    }
    const toolSlug = (registeredTool?.slug ?? fallbackTool!.slug).toLowerCase();

    const composio = getComposio();
    const result = await composio.connectedAccounts.list({
      userIds: [session.user.email],
      toolkitSlugs: [toolSlug],
      statuses: ["ACTIVE"],
    });
    const isConnected = result.items.some(
      (account: any) => account.toolkit?.slug?.toLowerCase() === toolSlug.toLowerCase(),
    );

    const configuredTools = Array.isArray(agent.tools)
      ? agent.tools.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
      : [];
    if (isConnected && !configuredTools.includes(toolSlug)) {
      await db
        .update(AgentConfig)
        .set({
          tools: sql`CASE
            WHEN COALESCE(${AgentConfig.tools}, '[]'::jsonb) @> ${JSON.stringify([toolSlug])}::jsonb
              THEN COALESCE(${AgentConfig.tools}, '[]'::jsonb)
            ELSE COALESCE(${AgentConfig.tools}, '[]'::jsonb) || ${JSON.stringify([toolSlug])}::jsonb
          END`,
        })
        .where(
          and(
            eq(AgentConfig.agentid, agent.agentid),
            eq(AgentConfig.userEmail, session.user.email),
          ),
        );

      if (agent.composioSessionId) {
        try {
          const [updatedAgent] = await db
            .select({ tools: AgentConfig.tools })
            .from(AgentConfig)
            .where(eq(AgentConfig.agentid, agent.agentid))
            .limit(1);
          const toolSlugs = Array.isArray(updatedAgent?.tools)
            ? updatedAgent.tools.filter((item): item is string => typeof item === "string")
            : [toolSlug];
          const composioSession = await composio.sessions.use(agent.composioSessionId);
          await composioSession.update({ toolkits: toolSlugs });
        } catch (error) {
          console.error("Could not sync connected tool to Composio session:", error);
        }
      }
    }

    return NextResponse.json({ isConnected });
  } catch (error) {
    if (error instanceof ComposioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Tool connection status error:", error);
    return NextResponse.json(
      { error: "Could not load tool connection status" },
      { status: 500 },
    );
  }
}
