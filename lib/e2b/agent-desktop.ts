import { Sandbox } from "@e2b/desktop";
import { and, eq, sql } from "drizzle-orm";
import { AgentConfig, db } from "@/db";
import { inngest } from "@/lib/inngest/client";

const SANDBOX_TIMEOUT_MS = 60 * 60 * 1000;
export const VM_IDLE_PAUSE_EVENT = "agent/vm.pause-if-idle";

export async function connectAgentDesktop(agentId: string, userEmail: string) {
  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B is not configured. Add E2B_API_KEY to the server environment.");
  }

  const sandboxId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${agentId}))`);
    const [agent] = await tx
      .select({ e2bSandboxId: AgentConfig.e2bSandboxId })
      .from(AgentConfig)
      .where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)))
      .limit(1);

    if (!agent) throw new Error("AGENT_NOT_FOUND");
    if (agent.e2bSandboxId) return agent.e2bSandboxId;

    const sandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });
    await tx
      .update(AgentConfig)
      .set({ e2bSandboxId: sandbox.sandboxId })
      .where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)));
    return sandbox.sandboxId;
  });

  // E2B.connect resumes a paused sandbox in place, preserving the browser profile,
  // cookies, and open desktop session under this agent's stable sandbox ID.
  const desktop = await Sandbox.connect(sandboxId, { timeoutMs: SANDBOX_TIMEOUT_MS });
  await db.update(AgentConfig).set({
    e2bSandboxStatus: "active",
    e2bLastActiveAt: new Date(),
    e2bPausedAt: null,
  }).where(and(eq(AgentConfig.agentid, agentId), eq(AgentConfig.userEmail, userEmail)));

  return { desktop, sandboxId };
}

export async function ensureDesktopBrowser(desktop: Sandbox) {
  const browserProcesses = await desktop.commands.run("pgrep -x chrome || true");
  if (!browserProcesses.stdout.trim()) {
    await desktop.launch("google-chrome");
    await desktop.wait(4000);
  }
}

export async function recordAgentVmActivity(agentId: string, userEmail: string) {
  const now = new Date();
  const [agent] = await db.update(AgentConfig)
    .set({ e2bLastActiveAt: now, e2bSandboxStatus: "active", e2bPausedAt: null })
    .where(and(
      eq(AgentConfig.agentid, agentId),
      eq(AgentConfig.userEmail, userEmail),
      sql`${AgentConfig.e2bSandboxId} IS NOT NULL`,
    ))
    .returning({ e2bSandboxId: AgentConfig.e2bSandboxId });

  if (!agent?.e2bSandboxId) return;
  try {
    await inngest.send({
      name: VM_IDLE_PAUSE_EVENT,
      data: { agentId, userEmail, lastActiveAt: now.toISOString() },
    });
  } catch (error) {
    // A temporarily unavailable Inngest endpoint should not block desktop work.
    console.error("Could not schedule the agent VM idle pause:", error);
  }
}
