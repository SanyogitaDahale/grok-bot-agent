import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { ComposioConfigurationError, getComposio } from "@/lib/composio/composio";

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
      .select({ agentid: AgentConfig.agentid })
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentid, agentId),
          eq(AgentConfig.userEmail, session.user.email),
        ),
      )
      .limit(1);

    const [tool] = await db
      .select({ slug: Tools.slug, isActive: Tools.isActive })
      .from(Tools)
      .where(eq(Tools.slug, toolkitSlug))
      .limit(1);

    if (!agent || !tool) {
      return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
    }
    if (!tool.isActive) {
      return NextResponse.json({ error: "This tool is unavailable" }, { status: 404 });
    }

    const composio = getComposio();
    const result = await composio.connectedAccounts.list({
      userIds: [session.user.email],
      toolkitSlugs: [tool.slug],
      statuses: ["ACTIVE"],
    });
    const isConnected = result.items.some(
      (account: any) => account.toolkit?.slug?.toLowerCase() === tool.slug.toLowerCase(),
    );

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
