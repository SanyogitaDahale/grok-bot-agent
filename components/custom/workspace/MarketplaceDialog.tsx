'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Blocks, Check, LoaderCircle, PlugZap, Unplug, Wrench } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CONNECTABLE_TOOLS } from '@/components/custom/agent-space/agent-data';
import { connectToolInPopup } from '@/components/custom/agent-space/tool-connection';
import type { AgentConfigType } from '@/type/agent';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentConfigType[];
  currentAgentId?: string;
};

type MarketplaceTool = { slug: string; name: string; description: string; category?: string };

export default function MarketplaceDialog({ open, onOpenChange, agents, currentAgentId }: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [catalog, setCatalog] = useState<MarketplaceTool[]>(CONNECTABLE_TOOLS.map((tool) => ({ slug: tool.slug, name: tool.name, description: tool.detail })));
  const [loading, setLoading] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    const nextAgentId = currentAgentId && agents.some((agent) => agent.agentid === currentAgentId)
      ? currentAgentId
      : agents[0]?.agentid ?? '';
    setSelectedAgentId(nextAgentId);
  }, [agents, currentAgentId]);

  useEffect(() => {
    if (!open || !selectedAgentId) {
      setConnections({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    const loadConnections = async () => {
      try {
        const { data } = await axios.get<{ tools: MarketplaceTool[] }>('/api/tools/catalog');
        const tools = data.tools;
        const results = await Promise.all(tools.map(async (tool) => {
          try {
            const { data: status } = await axios.get<{ isConnected: boolean }>('/api/tools/status', {
              params: { agentId: selectedAgentId, toolkitSlug: tool.slug },
            });
            return [tool.slug, status.isConnected] as const;
          } catch {
            return [tool.slug, false] as const;
          }
        }));
        if (!cancelled) {
          setCatalog(tools);
          setConnections(Object.fromEntries(results));
        }
      } catch {
        if (!cancelled) setConnections({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadConnections();

    return () => { cancelled = true; };
  }, [open, selectedAgentId]);

  const connectedTools = useMemo(() => catalog.filter((tool) => connections[tool.slug]), [catalog, connections]);
  const availableTools = useMemo(() => catalog.filter((tool) => !connections[tool.slug]), [catalog, connections]);

  const toggleConnection = async (slug: string, isConnected: boolean) => {
    if (!selectedAgentId || busySlug) return;
    setBusySlug(slug);
    try {
      if (isConnected) {
        await axios.post('/api/tools/disconnect', { agentId: selectedAgentId, toolkitSlug: slug });
        setConnections((current) => ({ ...current, [slug]: false }));
        toast.add({ title: 'Tool disconnected', description: 'The integration has been disconnected.', type: 'success' });
      } else {
        const connected = await connectToolInPopup(selectedAgentId, slug);
        if (connected) {
          setConnections((current) => ({ ...current, [slug]: true }));
          toast.add({ title: 'Tool connected', description: 'The integration is ready to use.', type: 'success' });
        } else {
          toast.add({ title: 'Connection not completed', description: 'Finish signing in to connect this tool.', type: 'info' });
        }
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error ?? error.message
        : error instanceof Error ? error.message : 'Please try again.';
      toast.add({ title: 'Could not update connection', description: message, type: 'error' });
    } finally {
      setBusySlug(null);
    }
  };

  const renderCards = (tools: MarketplaceTool[], connected: boolean) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tools.map(({ slug, name, description, category }) => {
        const busy = busySlug === slug;
        const iconMeta = CONNECTABLE_TOOLS.find((tool) => tool.slug === slug);
        const Icon = iconMeta?.icon ?? Blocks;
        const tint = iconMeta?.tint ?? 'bg-blue-50 text-blue-700';
        return (
          <article key={slug} className="group flex min-h-[176px] flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:min-h-[184px]">
            <div className="flex items-center justify-between gap-2">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ring-1 ring-black/[0.03] ${tint}`}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {connected
                ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><Check className="size-3" /> Connected</span>
                : <span className="inline-flex max-w-[95px] items-center gap-1 truncate rounded-full bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500"><Wrench className="size-3 shrink-0" />{category ?? 'Integration'}</span>}
            </div>
            <div className="mt-3 min-w-0 flex-1">
              <h3 className="line-clamp-1 break-words text-[15px] font-semibold tracking-[-0.01em] text-slate-900" title={name}>{name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-slate-500">{description}</p>
            </div>
            <div className="mt-3">
              <button type="button" disabled={!selectedAgentId || busy || loading} onClick={() => void toggleConnection(slug, connected)} className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${connected ? 'border border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : 'bg-blue-800 text-white shadow-sm shadow-blue-900/10 hover:bg-blue-900'}`}>
                {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : connected ? <Unplug className="size-3.5" /> : <PlugZap className="size-3.5" />}
                {busy ? 'Working…' : connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[min(1200px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-[24px] border-slate-200 bg-slate-50 p-0 font-sans shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-w-none">
        <DialogHeader className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-5 pr-14 sm:px-7 sm:py-6">
          <DialogTitle className="text-[21px] font-semibold tracking-[-0.025em] text-slate-950">Tool marketplace</DialogTitle>
          <DialogDescription className="mt-1 max-w-xl text-[13px] leading-5 text-slate-500">Connect the apps your agent can use to get work done.</DialogDescription>
          {agents.length > 0 && <div className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="marketplace-agent" className="text-xs font-semibold text-slate-600">Connect tools to</label>
            <select id="marketplace-agent" value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-auto sm:min-w-[190px]">
              {agents.map((agent) => <option key={agent.agentid} value={agent.agentid}>{agent.name}</option>)}
            </select>
          </div>}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {!agents.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <PlugZap className="mx-auto size-8 text-slate-400" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">Create an agent to connect tools</h3>
              <p className="mt-1 text-xs text-slate-500">Tool connections are managed from an agent workspace.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Checking your connections…</div>
          ) : (
            <>
              <section aria-labelledby="connected-tools-heading">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h2 id="connected-tools-heading" className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Connected tools</h2><p className="mt-1 text-xs text-slate-500">Apps authorized for your account</p></div>
                  <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{connectedTools.length} connected</span>
                </div>
                {connectedTools.length ? renderCards(connectedTools, true) : <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">No tools connected yet. Choose an app below to get started.</div>}
              </section>
              <section aria-labelledby="available-tools-heading" className="mt-8 border-t border-slate-200/80 pt-6">
                <div className="mb-4"><h2 id="available-tools-heading" className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Available tools</h2><p className="mt-1 text-xs text-slate-500">Connect an app to add its capabilities to this agent</p></div>
                {availableTools.length ? renderCards(availableTools, false) : <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">All available tools are connected.</div>}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
