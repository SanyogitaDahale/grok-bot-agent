export type FallbackToolkit = {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  isActive: boolean;
};

export const FALLBACK_TOOLKITS: FallbackToolkit[] = [
  { slug: "gmail", name: "Gmail", description: "Read incoming emails, search threads, and draft or send replies", isActive: true },
  { slug: "googledocs", name: "Google Docs", description: "Create, read, and append content to Google Documents", isActive: true },
  { slug: "googlecalendar", name: "Google Calendar", description: "Create and manage calendar events and availability", isActive: true },
  { slug: "googledrive", name: "Google Drive", description: "Search, create, download, and organize files and folders", isActive: true },
  { slug: "googlesheets", name: "Google Sheets", description: "Read, create, and update spreadsheet data", isActive: true },
  { slug: "slack", name: "Slack", description: "Send messages, read channels, and manage team notifications", isActive: true },
  { slug: "notion", name: "Notion", description: "Create and manage pages and knowledge", isActive: true },
  { slug: "github", name: "GitHub", description: "Work with repositories, issues, and pull requests", isActive: true },
  { slug: "jira", name: "Jira", description: "Create, search, and manage project issues", isActive: true },
  { slug: "trello", name: "Trello", description: "Manage boards, lists, and task cards", isActive: true },
];

export function getFallbackToolkit(slug: string) {
  return FALLBACK_TOOLKITS.find((toolkit) => toolkit.slug === slug.trim().toLowerCase());
}
