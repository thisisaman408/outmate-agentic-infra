export interface ToolboxItem {
  name: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  iconType: string;
}

export const RULES_ITEMS: ToolboxItem[] = [
  { name: "True / false branch", desc: "Route based on condition", iconBg: "rgba(59,130,246,.15)", iconColor: "#60A5FA", iconType: "fork" },
  { name: "Multi-split branch", desc: "Split into 3+ paths", iconBg: "rgba(168,85,247,.15)", iconColor: "#C084FC", iconType: "split" },
  { name: "Delay", desc: "Wait before next step", iconBg: "rgba(245,158,11,.15)", iconColor: "#FCD34D", iconType: "clock" },
  { name: "Loop", desc: "Repeat until condition met", iconBg: "rgba(16,185,129,.15)", iconColor: "#34D399", iconType: "loop" },
  { name: "Exit", desc: "End workflow branch", iconBg: "rgba(239,68,68,.12)", iconColor: "#F87171", iconType: "exit" },
];

export const AGENTS_ITEMS: ToolboxItem[] = [
  { name: "Research with AI", desc: "Web research + summarise", iconBg: "rgba(168,85,247,.15)", iconColor: "#C084FC", iconType: "sparkle" },
  { name: "Qualify / score records", desc: "Score against ICP criteria", iconBg: "rgba(245,158,11,.15)", iconColor: "#FCD34D", iconType: "gauge" },
];

export const ACTIONS_ITEMS: ToolboxItem[] = [
  { name: "Enrich contact", desc: "PDL → Apollo → Hunter", iconBg: "rgba(168,85,247,.15)", iconColor: "#C084FC", iconType: "person" },
  { name: "Send email", desc: "Gmail or Instantly", iconBg: "rgba(16,185,129,.15)", iconColor: "#34D399", iconType: "envelope" },
  { name: "LinkedIn message", desc: "Via Unipile API", iconBg: "rgba(59,130,246,.15)", iconColor: "#60A5FA", iconType: "bubble" },
  { name: "Update CRM", desc: "HubSpot or Salesforce", iconBg: "rgba(239,68,68,.12)", iconColor: "#F87171", iconType: "grid" },
  { name: "Slack notify", desc: "Send channel alert", iconBg: "rgba(245,158,11,.15)", iconColor: "#FCD34D", iconType: "hash" },
  { name: "Web research", desc: "Search + extract data", iconBg: "rgba(168,85,247,.15)", iconColor: "#C084FC", iconType: "globe" },
  { name: "Manage sequences", desc: "Instantly or Smartlead", iconBg: "rgba(16,185,129,.15)", iconColor: "#34D399", iconType: "checklist" },
];
