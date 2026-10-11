import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Tools } from "@/db/schema";
import { ComposioConfigurationError, getComposio } from "@/lib/composio/composio";
import { getActiveConnectedAccounts } from "@/lib/composio/service";

function isComposioSessionPermissionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const apiError = error as {
    status?: number;
    error?: { error?: { slug?: string } };
    details?: { slug?: string };
  };

  return (
    apiError.status === 403 &&
    (apiError.error?.error?.slug === "APIKey_InsufficientPermissions" ||
      apiError.details?.slug === "APIKey_InsufficientPermissions")
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
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
      .select({ slug: Tools.slug, isActive: Tools.isActive })
      .from(Tools)
      .where(eq(Tools.slug, toolkitSlug))
      .limit(1);

    if (!tool) {
      return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 });
    }
    if (!tool.isActive) {
      return NextResponse.json({ error: "This tool is unavailable" }, { status: 404 });
    }

    const configuredTools = Array.isArray(agent.tools)
      ? agent.tools.filter((item): item is string => typeof item === "string")
      : [];
    const toolSlugs = [...new Set([...configuredTools, tool.slug])];
    const composio = getComposio();
    const composioSession = await (async () => {
      if (agent.composioSessionId) {
        const existingSession = await composio.sessions.use(agent.composioSessionId);
        await existingSession.update({ toolkits: toolSlugs });
        return existingSession;
      }

      const connectedAccounts = await getActiveConnectedAccounts(
        session.user.email,
        configuredTools,
        composio,
      );
      return composio.sessions.create(session.user.email, {
        toolkits: toolSlugs,
        ...(Object.keys(connectedAccounts).length > 0 ? { connectedAccounts } : {}),
      });
    })();

    await db
      .update(AgentConfig)
      .set({
        tools: toolSlugs,
        composioSessionId: composioSession.sessionId,
      })
      .where(
        and(
          eq(AgentConfig.agentid, agent.agentid),
          eq(AgentConfig.userEmail, session.user.email),
        ),
      );

    const request = await composioSession.authorize(tool.slug, {
      callbackUrl: `${req.nextUrl.origin}/workspace/${encodeURIComponent(agentId)}`,
    });

    if (!request.redirectUrl) {
      return NextResponse.json(
        { error: "This tool did not provide an authorization URL" },
        { status: 502 },
      );
    }

    return NextResponse.json({ redirectUrl: request.redirectUrl });
  } catch (error) {
    if (error instanceof ComposioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (isComposioSessionPermissionError(error)) {
      return NextResponse.json(
        {
          error:
            "The Composio API key needs Session management write access. Create a new scoped key with Session management set to Write or Read and write, then update COMPOSIO_API_KEY and restart the app.",
        },
        { status: 403 },
      );
    }

    console.error("Unable to start tool connection", error);
    return NextResponse.json(
      { error: "Unable to start tool connection" },
      { status: 500 },
    );
  }
}
