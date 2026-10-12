import { redirect } from 'next/navigation';

export default async function LegacyAgentWorkspaceRoute({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  redirect(`/workspace/${encodeURIComponent(agentId)}`);
}
