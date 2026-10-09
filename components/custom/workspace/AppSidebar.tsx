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

    useEffect(() => {
        getUserAgents();
    }, [path]);

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
        <aside className="flex h-screen w-[272px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 text-slate-900">
            <Link
                href="/workspace"
                className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5"
                aria-label="Orbit home"
            >
                <img
                    src="/logo.png"
                    alt="LOGO"
                    width={45}
                    height={45}
                />

                <span className="text-2xl font-semibold tracking-tight">
                    Orbit
                </span>
            </Link>

            <Link href="/workspace/create-agent">
                <button
                    type="button"
                    className="mb-8 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    Create New Agent
                </button>
            </Link>

            <nav
                className="min-h-0 flex-1 overflow-y-auto"
                aria-label="Your agents"
            >
                <div className="mb-3 flex items-center justify-between px-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
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
                                className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition ${path === `/workspace/${agent.agentid}`
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

                                <span className="truncate">
                                    {agent.name}
                                </span>

                                <Bot
                                    className="ml-auto size-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100"
                                    aria-hidden="true"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="mt-5 border-t border-slate-100 pt-4">
                <Link
                    href="/marketplace"
                    className={`mb-3 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-slate-50 ${path === '/marketplace'
                            ? 'bg-slate-100 font-medium text-slate-950'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                >
                    <Compass
                        className="size-[18px] text-slate-700"
                        aria-hidden="true"
                    />

                    Marketplace
                </Link>

                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                    {avatar ? (
                        <img
                            src={avatar}
                            alt=""
                            className="size-9 rounded-full object-cover"
                        />
                    ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {userName.slice(0, 1).toUpperCase()}
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
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
        </aside>
    );
}

export default AppSidebar;
