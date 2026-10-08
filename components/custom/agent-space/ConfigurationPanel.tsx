import { CalendarClock, Check, Layers3, Settings2, SlidersHorizontal, Sparkles } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSettingsTab from './AgentSettingsTab';
import ScheduleTab from './ScheduleTab';
import SettingsTab from './SettingsTab';
import ToolsTab from './ToolsTab';
import type { AgentConfigTab } from './agent-data';

type Props = { activeTab: AgentConfigTab; onTabChange: (tab: AgentConfigTab) => void };

const tabs: { id: AgentConfigTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'tools', label: 'Tools', icon: Layers3 },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'agent-settings', label: 'Agent settings', icon: SlidersHorizontal },
];

export default function ConfigurationPanel({ activeTab, onTabChange }: Props) {
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-blue-200 bg-gradient-to-b from-blue-50/80 via-slate-50 to-slate-100/80 xl:w-[440px]">
      <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-blue-200 bg-gradient-to-r from-white via-blue-50 to-slate-100 px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-blue-950"><span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-950 text-white shadow-sm"><Sparkles className="size-3.5" /></span>Agent Configuration</h2>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-800 to-blue-950 px-3 text-sm font-medium text-white shadow-sm shadow-blue-200 transition hover:from-blue-900 hover:to-slate-950"><Check className="size-3.5" />Save</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentAvatar />
        <div className="border-b border-blue-200 bg-white/90 px-6 pt-3">
          <div role="tablist" aria-label="Agent configuration sections" className="flex items-center gap-1">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-label={label} aria-selected={activeTab === id} title={label} onClick={() => onTabChange(id)} className={`relative flex size-10 items-center justify-center rounded-t-lg transition ${activeTab === id ? 'text-blue-900 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-blue-800' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-900'}`}><Icon className="size-[17px]" /></button>)}
          </div>
        </div>
        <div className="px-6 py-5">
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'tools' && <ToolsTab />}
          {activeTab === 'schedule' && <ScheduleTab />}
          {activeTab === 'agent-settings' && <AgentSettingsTab />}
        </div>
      </div>
    </aside>
  );
}
