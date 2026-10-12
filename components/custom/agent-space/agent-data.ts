import {
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Github,
  HardDrive,
  History,
  Layers3,
  Mail,
  MessageSquareText,
  PanelsTopLeft,
} from 'lucide-react';

export type AgentConfigTab = 'settings' | 'tools' | 'schedule' | 'agent-settings' | 'execution-history';

export const AGENT_CONFIG_UPDATED_EVENT = 'orbit:agent-config-updated';
export const AGENT_CHAT_RESET_EVENT = 'orbit:agent-chat-reset';

export const AGENT_AVATAR_URL = 'https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=Orbit-Assistant';

export const CONNECTABLE_TOOLS = [
  { slug: 'gmail', name: 'Gmail', detail: 'Send and organize email', icon: Mail, tint: 'bg-red-50 text-red-600' },
  { slug: 'slack', name: 'Slack', detail: 'Messages and channels', icon: MessageSquareText, tint: 'bg-violet-50 text-violet-600' },
  { slug: 'googlecalendar', name: 'Google Calendar', detail: 'Events and availability', icon: CalendarClock, tint: 'bg-blue-50 text-blue-600' },
  { slug: 'googledrive', name: 'Google Drive', detail: 'Files and shared folders', icon: HardDrive, tint: 'bg-emerald-50 text-emerald-600' },
  { slug: 'googledocs', name: 'Google Docs', detail: 'Create and manage documents', icon: FileText, tint: 'bg-sky-50 text-sky-600' },
  { slug: 'googlesheets', name: 'Google Sheets', detail: 'Spreadsheets and data', icon: FileSpreadsheet, tint: 'bg-green-50 text-green-700' },
  { slug: 'notion', name: 'Notion', detail: 'Pages and knowledge', icon: Layers3, tint: 'bg-slate-100 text-slate-800' },
  { slug: 'github', name: 'GitHub', detail: 'Repositories and issues', icon: Github, tint: 'bg-slate-100 text-slate-800' },
  { slug: 'jira', name: 'Jira', detail: 'Projects and issues', icon: ClipboardList, tint: 'bg-blue-50 text-blue-700' },
  { slug: 'trello', name: 'Trello', detail: 'Boards and task cards', icon: PanelsTopLeft, tint: 'bg-indigo-50 text-indigo-700' },
];
