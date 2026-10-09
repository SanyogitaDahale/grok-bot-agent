'use client';

import ChatPanel from '@/components/custom/agent-space/ChatPanel';
import ConfigurationPanel from '@/components/custom/agent-space/ConfigurationPanel';
import type { AgentConfigTab } from '@/components/custom/agent-space/agent-data';
import { toast } from '@/components/ui/toast';
import { AgentConfigContext } from '@/context/AgentConfigContext';
import { AgentConfigType } from '@/type/agent';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AgentSpacePage() {
  const { agentId } = useParams();

  const [activeTab, setActiveTab] =
    useState<AgentConfigTab>('settings');

  const [agentConfig, setAgentConfig] =
    useState<AgentConfigType | null>(null);

  useEffect(() => {
    if (agentId) {
      GetAgentConfig();
    }
  }, [agentId]);

  const GetAgentConfig = async () => {
    try {
      const result = await axios.get(
        `/api/agent?agentId=${agentId}`
      );

      console.log(result.data);
      setAgentConfig(result.data);
    } catch (error) {
      console.error('Error getting agent config:', error);
    }
  };



  return (
    <AgentConfigContext.Provider
      value={{ agentConfig, setAgentConfig }}
    >
      <div className="flex h-screen min-h-[680px] min-w-0 overflow-hidden bg-white text-slate-900">
        <ChatPanel />
        <ConfigurationPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </AgentConfigContext.Provider>
  );
}
