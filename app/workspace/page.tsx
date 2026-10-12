'use client';

import Link from 'next/link';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { AgentConfigType } from '@/type/agent';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatCreatedDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Recently created';
  return `Created ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
}

export default function WorkspacePage() {
  const { data: session } = useSession();
  const [agents, setAgents] = useState<AgentConfigType[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await axios.get<{ agentConfig: AgentConfigType[] }>('/api/agent');
      setAgents(data.agentConfig ?? []);
    } catch {
      setError('We couldn’t load your agents. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) =>
      `${agent.name} ${agent.description ?? ''}`.toLowerCase().includes(query),
    );
  }, [agents, search]);

  const activeCount = agents.filter((agent) => agent.isActive !== false).length;
  const connectedToolCount = agents.reduce((total, agent) => {
    const toolCount = Array.isArray(agent.tools)
      ? new Set(agent.tools.filter((tool): tool is string => typeof tool === 'string').map((tool) => tool.toLowerCase())).size
      : 0;
    return total + toolCount;
  }, 0);
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-6 text-slate-900 sm:px-7 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-7xl space-y-7 sm:space-y-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700"><Sparkles className="size-3.5" /> Your workspace</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl">{getGreeting()}, {firstName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage your AI agents, connect the tools they need, and pick up where you left off.</p>
          </div>
          <Link href="/workspace/create-agent" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-900/15 transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <Plus className="size-4" /> Create an agent
          </Link>
        </header>

        <section aria-label="Workspace overview" className="grid gap-3 sm:grid-cols-3">
          <OverviewCard icon={Bot} label="Total agents" value={agents.length} detail={agents.length === 1 ? '1 assistant in your workspace' : 'Assistants in your workspace'} tone="blue" />
          <OverviewCard icon={CheckCircle2} label="Active agents" value={activeCount} detail="Ready to work when you are" tone="emerald" />
          <OverviewCard icon={Wrench} label="Connected tools" value={connectedToolCount} detail="Tool connections across agents" tone="violet" />
        </section>

        <section aria-labelledby="agents-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="agents-heading" className="text-lg font-semibold tracking-tight text-slate-950">Your agents</h2>
              <p className="mt-1 text-sm text-slate-500">Open an agent to chat, configure tools, or manage its schedule.</p>
            </div>
            {!isLoading && agents.length > 0 && <label className="relative block w-full sm:w-64">
              <span className="sr-only">Search agents</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </label>}
          </div>

          {error ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <button type="button" onClick={() => void loadAgents()} className="mt-3 text-sm font-semibold text-blue-800 underline underline-offset-4 hover:text-blue-950">Try again</button>
            </div>
          ) : isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="size-12 rounded-2xl bg-slate-100" /><div className="mt-5 h-4 w-2/5 rounded bg-slate-100" /><div className="mt-3 h-3 w-4/5 rounded bg-slate-100" /><div className="mt-2 h-3 w-3/5 rounded bg-slate-100" /></div>)}
            </div>
          ) : agents.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative px-5 py-12 text-center sm:px-10 sm:py-16">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-50/80 to-transparent" />
                <span className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-800 shadow-sm"><Bot className="size-8" /></span>
                <h3 className="relative mt-5 text-lg font-semibold text-slate-950">Your first agent is one step away</h3>
                <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create a dedicated assistant, give it a goal, and connect the apps it needs to help you.</p>
                <Link href="/workspace/create-agent" className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900"><Plus className="size-4" /> Create your first agent</Link>
              </div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <Search className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No agents match “{search}”</p>
              <button type="button" onClick={() => setSearch('')} className="mt-2 text-xs font-semibold text-blue-800 hover:text-blue-950">Clear search</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAgents.map((agent) => <AgentCard key={agent.agentid} agent={agent} />)}
              <Link href="/workspace/create-agent" className="group flex min-h-[206px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 text-center transition hover:border-blue-300 hover:bg-blue-50/60">
                <span className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:border-blue-200 group-hover:text-blue-800"><Plus className="size-5" /></span>
                <span className="mt-3 text-sm font-semibold text-slate-700 group-hover:text-blue-900">Create another agent</span>
                <span className="mt-1 text-xs text-slate-500">Give your next idea an assistant</span>
              </Link>
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Build a team of agents around the way you work.</span>
          <Link href="/workspace/create-agent" className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:text-blue-950">Get started <ArrowRight className="size-3.5" /></Link>
        </footer>
      </div>
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Bot;
  label: string;
  value: number;
  detail: string;
  tone: 'blue' | 'emerald' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  };
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.035)] sm:p-5">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight text-slate-950">{value}</span><span className="truncate text-[11px] text-slate-400">{detail}</span></div>
      </div>
    </article>
  );
}

function AgentCard({ agent }: { agent: AgentConfigType }) {
  const tools = Array.isArray(agent.tools) ? agent.tools.filter((tool): tool is string => typeof tool === 'string') : [];
  const isActive = agent.isActive !== false;
  return (
    <Link href={`/workspace/${agent.agentid}`} className="group flex min-h-[206px] flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {agent.agentImage
            ? <img src={agent.agentImage} alt="" className="size-12 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-cover" />
            : <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-semibold text-blue-800">{agent.name.slice(0, 2).toUpperCase()}</span>}
          <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-blue-900">{agent.name}</h3><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="size-3" />{formatCreatedDate(agent.createdAt)}</p></div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{isActive ? 'Active' : 'Paused'}</span>
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{agent.description || 'Your AI assistant is ready for a goal. Open the workspace to start a conversation.'}</p>
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Layers3 className="size-3.5" />{tools.length} {tools.length === 1 ? 'tool' : 'tools'} connected</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 transition group-hover:gap-2">Open agent <ArrowRight className="size-3.5" /></span>
      </div>
    </Link>
  );
}
