'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Bot,
    Compass,
    Plus,
    Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { AgentConfigType } from '@/type/agent';
import MarketplaceDialog from './MarketplaceDialog';
import { AGENT_CONFIG_UPDATED_EVENT } from '@/components/custom/agent-space/agent-data';

function AppSidebar() {
    const path = usePathname();
    const { data: session } = useSession();

    const userName =
        session?.user?.name ||
        session?.user?.email?.split('@')[0] ||
        'Your account';

    const userEmail =
        session?.user?.email || 'Your account';

    const avatar = session?.user?.image;

    const [agents, setAgents] = useState<AgentConfigType[]>([]);
    const [marketplaceOpen, setMarketplaceOpen] = useState(false);

    useEffect(() => {
        getUserAgents();
    }, [path]);

    useEffect(() => {
        const syncUpdatedAgent = (event: Event) => {
            const updatedAgent = (event as CustomEvent<Partial<AgentConfigType>>).detail;
            if (!updatedAgent?.agentid) return;
            setAgents((current) => current.map((agent) => agent.agentid === updatedAgent.agentid
                ? { ...agent, ...updatedAgent }
                : agent));
        };

        window.addEventListener(AGENT_CONFIG_UPDATED_EVENT, syncUpdatedAgent);
        return () => window.removeEventListener(AGENT_CONFIG_UPDATED_EVENT, syncUpdatedAgent);
    }, []);

    const getUserAgents = async () => {
        try {
            const result = await axios.get('/api/agent');

            console.log(result.data);

            setAgents(result.data.agentConfig || []);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        }
    };

    return (
        <aside className="flex h-dvh w-[68px] shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-4 text-slate-900 sm:w-[76px] sm:px-2.5 lg:w-[272px] lg:px-4 lg:py-5">
            <Link
                href="/workspace"
                className="mb-3 flex items-center justify-center gap-2 rounded-lg px-0 py-1.5 lg:justify-start lg:px-2"
                aria-label="Orbit home"
            >
                <img
                    src="/logo.png"
                    alt="LOGO"
                    width={40}
                    height={40}
                    className="size-9 lg:size-[45px]"
                />

                <span className="hidden text-2xl font-semibold tracking-tight lg:inline">
                    Orbit
                </span>
            </Link>

            <Link href="/workspace/create-agent">
                <button
                    type="button"
                    aria-label="Create new agent"
                    className="mb-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue-800 bg-gradient-to-r from-blue-700 to-blue-900 px-1 text-sm font-medium text-white shadow-sm shadow-blue-900/15 transition hover:from-blue-800 hover:to-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:mb-8 lg:px-4"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="hidden lg:inline">Create New Agent</span>
                </button>
            </Link>

            <nav
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
                aria-label="Your agents"
            >
                <div className="mb-3 flex items-center justify-center px-0 lg:justify-between lg:px-2">
                    <h2 className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 lg:block">
                        Your Agents
                    </h2>

                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                        {agents.length}
                    </span>
                </div>

                <ul className="space-y-1">
                    {agents.map((agent) => (
                        <li key={agent.agentid}>
                            <Link
                                href={`/workspace/${agent.agentid}`}
                                title={agent.name}
                                className={`group flex items-center justify-center gap-3 rounded-lg px-1 py-2.5 transition lg:justify-start lg:px-2.5 ${path === `/workspace/${agent.agentid}`
                                        ? 'bg-slate-100 font-medium text-slate-950'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                    }`}
                            >
                                {agent.agentImage ? (
                                    <img
                                        src={agent.agentImage}
                                        alt=""
                                        className="size-8 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-600">
                                        {agent.name.slice(0, 2).toUpperCase()}
                                    </span>
                                )}

                                <span className="hidden truncate lg:inline">
                                    {agent.name}
                                </span>

                                <Bot
                                    className="ml-auto hidden size-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 lg:block"
                                    aria-hidden="true"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="mt-5 border-t border-slate-100 pt-4">
                <button
                    type="button"
                    title="Marketplace"
                    aria-haspopup="dialog"
                    aria-expanded={marketplaceOpen}
                    onClick={() => setMarketplaceOpen(true)}
                    className={`mb-3 flex w-full items-center justify-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 lg:justify-start lg:px-2.5 ${marketplaceOpen
                            ? 'bg-slate-100 font-medium text-slate-950'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                >
                    <Compass
                        className="size-[18px] text-slate-700"
                        aria-hidden="true"
                    />

                    <span className="hidden lg:inline">Marketplace</span>
                </button>

                <div className="flex items-center justify-center gap-3 rounded-lg px-0 py-2 lg:justify-start lg:px-2">
                    {avatar ? (
                        <img
                            src={avatar}
                            alt=""
                            className="size-8 rounded-full object-cover lg:size-9"
                        />
                    ) : (
                        <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 lg:size-9">
                            {userName.slice(0, 1).toUpperCase()}
                        </span>
                    )}

                    <div className="hidden min-w-0 flex-1 lg:block">
                        <p className="truncate text-sm font-medium text-slate-800">
                            {userName}
                        </p>

                        <p className="flex items-center gap-1 truncate text-xs text-slate-600">
                            <Sparkles className="size-3 shrink-0" />
                            {userEmail}
                        </p>
                    </div>
                </div>
            </div>
            <MarketplaceDialog
                open={marketplaceOpen}
                onOpenChange={setMarketplaceOpen}
                agents={agents}
                currentAgentId={path.match(/^\/workspace\/([^/]+)/)?.[1]}
            />
        </aside>
    );
}

export default AppSidebar;
