'use client';

import { useContext } from 'react';
import { AgentConfigContext } from '@/context/AgentConfigContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import VMDesktop from './VMDesktop';

export default function SettingsTab() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)!;
  const description = agentConfig?.description ?? '';

  return (
    <div className="space-y-2">
      <VMDesktop />
      <div className="flex items-center justify-between">
        <Label htmlFor="agent-instructions">Description &amp; Instructions</Label>
        <span className="text-xs text-muted-foreground">
          {description.length} / 2,000
        </span>
      </div>
      <Textarea
        id="agent-instructions"
        value={description}
        maxLength={2000}
        rows={5}
        className="min-h-32 resize-y text-sm"
        onChange={(event) => {
          // const name = e.target.value;

          setAgentConfig((prevConfig: any) => ({
            ...prevConfig,
            description: event.target.value

          }))
        }}
      />
      <p className="text-s leading-5 text-muted-foreground">
        Describe what this agent does and how it should respond.
      </p>
    </div>
  );
}
