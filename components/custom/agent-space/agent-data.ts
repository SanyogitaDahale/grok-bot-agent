import { CalendarClock, Github, Layers3, Mail, MessageSquareText } from 'lucide-react';

export type AgentConfigTab = 'settings' | 'tools' | 'schedule' | 'agent-settings';

export const AGENT_AVATAR_URL = 'https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=Orbit-Assistant';

export const CONNECTABLE_TOOLS = [
  { name: 'Gmail', detail: 'Send and organize email', icon: Mail, tint: 'bg-red-50 text-red-600' },
  { name: 'Slack', detail: 'Messages and channels', icon: MessageSquareText, tint: 'bg-violet-50 text-violet-600' },
  { name: 'Google Calendar', detail: 'Events and availability', icon: CalendarClock, tint: 'bg-blue-50 text-blue-600' },
  { name: 'Notion', detail: 'Pages and knowledge', icon: Layers3, tint: 'bg-slate-100 text-slate-800' },
  { name: 'GitHub', detail: 'Repositories and issues', icon: Github, tint: 'bg-slate-100 text-slate-800' },
];
