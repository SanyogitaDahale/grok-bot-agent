import { getComposio } from "./composio";
import { AgentConfig, db } from "@/db";
import { and, eq } from "drizzle-orm";

type AgentSessionConfig = Pick<
    typeof AgentConfig.$inferSelect,
    "agentid" | "tools" | "composioSessionId"
>;

export async function getOrCreateAgentSession(agentConfig: AgentSessionConfig, userEmail: string) {
    const composio = getComposio();

    if (agentConfig.composioSessionId) {
        try {
            return await composio.sessions.use(agentConfig.composioSessionId);
        }
        catch {
            console.warn("Could not reuse Composio session; creating a new one.");
        }
    }

    const toolSlugs = Array.isArray(agentConfig.tools)
        ? agentConfig.tools.filter((tool): tool is string => typeof tool === "string")
        : [];
    const connectedAccounts = await getActiveConnectedAccounts(userEmail, toolSlugs, composio);

    const session = await composio.sessions.create(userEmail, {
        toolkits: toolSlugs.length > 0 ? toolSlugs : undefined,
        connectedAccounts: Object.keys(connectedAccounts).length > 0 ? connectedAccounts : undefined,
    });

    await db.update(AgentConfig)
        .set({ composioSessionId: session.sessionId })
        .where(and(
            eq(AgentConfig.agentid, agentConfig.agentid),
            eq(AgentConfig.userEmail, userEmail),
        ));

    return session;
}


export const getActiveConnectedAccounts = async (
    userEmail: string,
    toolSlugs: string[],
    composio = getComposio(),
) => {
    if (!toolSlugs || toolSlugs.length === 0) return {};
    try {
        const accounts = await composio.connectedAccounts.list({
            userIds: [userEmail],
            toolkitSlugs: toolSlugs,
            statuses: ["ACTIVE"],
        });

        return accounts.items.reduce((acc: Record<string, string[]>, account: any) => {
            const slug = account?.toolkit?.slug?.toLowerCase();
            if (slug) {
                if (!acc[slug]) acc[slug] = [];
                acc[slug].push(account.id);
            }
            return acc;
        }, {});
    } catch (err) {
        console.error("Error fetching accounts:", err);
        return {};
    }
};

