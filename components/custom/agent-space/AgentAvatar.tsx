'use client';

import { useContext, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AgentConfigContext } from '@/context/AgentConfigContext';
import { AGENT_AVATAR_URL } from './agent-data';
import type { AgentConfigType } from '@/type/agent';

export default function AgentAvatar() {
  const context = useContext(AgentConfigContext);
  const [avatarIndex, setAvatarIndex] = useState(0);

  if (!context) {
    throw new Error(
      'AgentAvatar must be used within AgentConfigContext.Provider'
    );
  }

  const { agentConfig, setAgentConfig } = context;

  const avatars = [
    AGENT_AVATAR_URL,
    '/avatars/avatar-1.png',
    '/avatars/avatar-2.png',
    '/avatars/avatar-3.png',
  ];
 
  const shuffleAvatar = () => {
  const avatarSeed = Math.random().toString(36).substring(2, 10);

  const newAvatarUrl =
    `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

  setAgentConfig((prev: AgentConfigType | null) =>
    prev ? { ...prev, agentImage: newAvatarUrl } : prev
  );
};


  return (
    <div className="border-b border-blue-200 bg-white/90 px-6 pb-5 pt-5">
      <div className="flex items-center gap-3.5">
        <img
          src={agentConfig?.agentImage || AGENT_AVATAR_URL}
          alt="Agent Avatar"
          className="size-[58px] rounded-2xl border border-blue-200 bg-blue-50 object-cover ring-4 ring-blue-50"
        />

        <div>
          <p className="text-sm font-semibold text-slate-700">
            Agent Avatar
          </p>

          <button
            type="button"
            onClick={shuffleAvatar}
            className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[13px] font-medium text-blue-900 transition hover:bg-blue-100"
          >
            <RefreshCw className="size-3" />
            Shuffle Avatar
          </button>
        </div>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Agent Name
        </span>

        <input
          value={agentConfig?.name ?? ''}
          onChange={(event) => {
            // const name = e.target.value;

            setAgentConfig((prevConfig: any) => ({
              ...prevConfig,
              name:event.target.value

            }))
          }}
          placeholder="Enter agent name"
          className="h-9 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
    </div>
  );
}
