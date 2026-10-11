import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { ComposioConfigurationError, getComposio } from "@/lib/composio/composio";

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

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [tool] = await db
      .select({ slug: Tools.slug })
      .from(Tools)
      .where(eq(Tools.slug, toolkitSlug))
      .limit(1);
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const composio = getComposio();
    const result = await composio.connectedAccounts.list({
      userIds: [session.user.email],
      toolkitSlugs: [tool.slug],
      statuses: ["ACTIVE"],
    });
    const ownedAccounts = result.items.filter(
      (account: any) => account.toolkit?.slug?.toLowerCase() === tool.slug.toLowerCase(),
    );

    await Promise.all(
      ownedAccounts.map((account: any) => composio.connectedAccounts.revoke(account.id)),
    );

    const configuredTools = Array.isArray(agent.tools)
      ? agent.tools.filter((item): item is string => typeof item === "string")
      : [];
    const remainingTools = configuredTools.filter((slug) => slug !== tool.slug);

    if (agent.composioSessionId) {
      const composioSession = await composio.sessions.use(agent.composioSessionId);
      await composioSession.update({ toolkits: remainingTools });
    }

    await db
      .update(AgentConfig)
      .set({
        tools: remainingTools,
      })
      .where(
        and(
          eq(AgentConfig.agentid, agent.agentid),
          eq(AgentConfig.userEmail, session.user.email),
        ),
      );

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
