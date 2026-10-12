import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { Sandbox } from "@e2b/desktop";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig } from "@/db/schema";
import { recordAgentVmActivity } from "@/lib/e2b/agent-desktop";

export const runtime = "nodejs";

async function getOwnedAgent(agentId: string, userEmail: string) {
  const [agent] = await db
    .select({
      agentid: AgentConfig.agentid,
      e2bSandboxId: AgentConfig.e2bSandboxId,
      e2bSandboxStatus: AgentConfig.e2bSandboxStatus,
    })
    .from(AgentConfig)
    .where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)))
    .limit(1);
  return agent;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userEmail = session.user.email;
    if (!process.env.E2B_API_KEY) {
      return NextResponse.json({ error: "E2B is not configured. Add E2B_API_KEY to the server environment." }, { status: 503 });
    }

    const { agentId, action } = await req.json();
    if (typeof agentId !== "string" || !agentId.trim() || !["activate", "pause", "activity"].includes(action)) {
      return NextResponse.json({ error: "A valid agent ID and VM action are required" }, { status: 400 });
    }

    if (action === "pause") {
      const agent = await getOwnedAgent(agentId, userEmail);
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      if (!agent.e2bSandboxId) return NextResponse.json({ status: "inactive" });
      await Sandbox.betaPause(agent.e2bSandboxId);
      await db.update(AgentConfig).set({
        e2bSandboxStatus: "paused",
        e2bPausedAt: new Date(),
      }).where(and(
        eq(AgentConfig.agentid, agentId),
        eq(AgentConfig.userEmail, userEmail),
      ));
      return NextResponse.json({ status: "paused" });
    }

    if (action === "activity") {
      const agent = await getOwnedAgent(agentId, userEmail);
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      if (agent.e2bSandboxId && agent.e2bSandboxStatus === "active") {
        await recordAgentVmActivity(agentId, userEmail);
      }
      return NextResponse.json({ status: agent.e2bSandboxStatus });
    }

    // Serialize first-time provisioning per agent so concurrent opens reuse one sandbox.
    const sandboxId = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${agentId}))`);
      const [agent] = await tx
        .select({ agentid: AgentConfig.agentid, e2bSandboxId: AgentConfig.e2bSandboxId })
        .from(AgentConfig)
        .where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)))
        .limit(1);
      if (!agent) throw new Error("AGENT_NOT_FOUND");

      if (agent.e2bSandboxId) return agent.e2bSandboxId;

      const desktop = await Sandbox.create();
      await tx
        .update(AgentConfig)
        .set({ e2bSandboxId: desktop.sandboxId })
        .where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)));
      return desktop.sandboxId;
    });

    const desktop = await Sandbox.connect(sandboxId);
    const browserProcesses = await desktop.commands.run("pgrep -x chrome || true");
    if (!browserProcesses.stdout.trim()) {
      await desktop.launch("google-chrome");
      await desktop.wait(4000);
    }

    // Old VNC/noVNC processes retain the previous password and can keep port 6080
    // occupied after a server-side reconnect. Clear both listeners before making
    // a fresh authenticated stream so its URL and password stay in sync.
    await desktop.commands.run(
      "pkill -x x11vnc >/dev/null 2>&1 || true; " +
      "pkill -f '[n]ovnc_proxy' >/dev/null 2>&1 || true; " +
      "pkill -f '[w]ebsockify.*6080' >/dev/null 2>&1 || true; " +
      "if command -v fuser >/dev/null 2>&1; then fuser -k 5900/tcp 6080/tcp >/dev/null 2>&1 || true; fi; " +
      "rm -f ~/.vnc/passwd; " +
      "for i in $(seq 1 20); do " +
      "if ! netstat -tuln | grep -Eq ':(5900|6080) '; then break; fi; sleep 0.25; done",
    );
    const stalePorts = await desktop.commands.run(
      "netstat -tuln | grep -E ':(5900|6080) ' || true",
    );
    if (stalePorts.stdout.trim()) {
      throw new Error("Could not clear the previous desktop stream ports");
    }
    await desktop.stream.start({ requireAuth: true });
    const authKey = desktop.stream.getAuthKey();
    const streamUrl = desktop.stream.getUrl(authKey ? { authKey } : undefined);
    await db.update(AgentConfig).set({
      e2bSandboxStatus: "active",
      e2bLastActiveAt: new Date(),
      e2bPausedAt: null,
    }).where(and(
      eq(AgentConfig.agentid, agentId),
      eq(AgentConfig.userEmail, userEmail),
    ));
    await recordAgentVmActivity(agentId, userEmail);

    return NextResponse.json({ sandboxId, streamUrl, status: "active" });
  } catch (error) {
    if (error instanceof Error && error.message === "AGENT_NOT_FOUND") {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    console.error("Agent VM error:", error);
    const message = error instanceof Error ? error.message : "Could not start the agent desktop";
    const safeMessage = process.env.E2B_API_KEY
      ? message.replaceAll(process.env.E2B_API_KEY, "[redacted]")
      : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
