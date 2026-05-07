import type { FlowType } from "@/types/flow";

export type PillTone = "violet" | "green" | "amber" | "red" | "blue" | "muted";

export type ActionPill = {
  label: string;
  icon: string;
  tone: PillTone;
};

const TONE_CLASSES: Record<PillTone, string> = {
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  red: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  blue: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  muted: "bg-muted text-muted-foreground border-border/50",
};

export const pillClass = (tone: PillTone) => TONE_CLASSES[tone];

const NODE_TYPE_TO_ACTION: Array<{
  match: (t: string) => boolean;
  pill: ActionPill;
}> = [
  {
    match: (t) => /email|gmail|sendgrid|smtp/i.test(t),
    pill: { label: "Add to sequence", icon: "Mail", tone: "red" },
  },
  {
    match: (t) => /slack|notif|alert|webhook/i.test(t),
    pill: { label: "Notification", icon: "Bell", tone: "violet" },
  },
  {
    match: (t) => /enrich|apollo|crustdata|explorium|firmograph/i.test(t),
    pill: { label: "Enrich data", icon: "Database", tone: "blue" },
  },
  {
    match: (t) => /account|company|crm|salesforce|hubspot/i.test(t),
    pill: { label: "Set account field", icon: "Building2", tone: "green" },
  },
  {
    match: (t) => /list|segment|audience/i.test(t),
    pill: { label: "Add to account list", icon: "ListPlus", tone: "amber" },
  },
];

export const getActionPills = (flow: FlowType): ActionPill[] => {
  const nodes = flow.data?.nodes ?? [];
  const seen = new Set<string>();
  const pills: ActionPill[] = [];
  for (const n of nodes as any[]) {
    const t =
      n?.data?.type ??
      n?.data?.node?.display_name ??
      n?.type ??
      "";
    if (!t) continue;
    for (const rule of NODE_TYPE_TO_ACTION) {
      if (rule.match(t) && !seen.has(rule.pill.label)) {
        seen.add(rule.pill.label);
        pills.push(rule.pill);
      }
    }
  }
  return pills;
};

export type FlowStatus = "active" | "draft" | "paused";

export const getFlowStatus = (flow: FlowType): FlowStatus => {
  if (flow.locked) return "paused";
  if (flow.endpoint_name) return "active";
  return "draft";
};

export type FlowTrigger = "event" | "time" | "manual";

export const getFlowTrigger = (flow: FlowType): FlowTrigger => {
  if (flow.webhook) return "event";
  // Time-triggered detection requires a Jobs row check — placeholder for now
  return "manual";
};

export const ownerInitials = (name?: string | null): string => {
  if (!name) return "GS";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return "–";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return d.toLocaleDateString();
};
