/* Shared colour tokens and data types for Agent Studio */

export const C = {
  bg: "#0B0B0E",
  panel: "#111115",
  node: "#17171D",
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  text: "#ffffff",
  text70: "rgba(255,255,255,.7)",
  text40: "rgba(255,255,255,.4)",
  text35: "rgba(255,255,255,.35)",
  text30: "rgba(255,255,255,.3)",
  text25: "rgba(255,255,255,.25)",
  border: "rgba(255,255,255,.1)",
  border07: "rgba(255,255,255,.07)",
  border08: "rgba(255,255,255,.08)",
  border12: "rgba(255,255,255,.12)",
} as const;

export const TAG: Record<string, { bg: string; text: string }> = {
  blue: { bg: "rgba(59,130,246,.15)", text: "#60A5FA" },
  purple: { bg: "rgba(168,85,247,.15)", text: "#C084FC" },
  green: { bg: "rgba(16,185,129,.15)", text: "#34D399" },
  amber: { bg: "rgba(245,158,11,.15)", text: "#FCD34D" },
  gray: { bg: "rgba(255,255,255,.07)", text: "rgba(255,255,255,.4)" },
  red: { bg: "rgba(239,68,68,.12)", text: "#F87171" },
};

export interface NodeData {
  id: number;
  title: string;
  provider: string;
  iconBg: string;
  iconColor: string;
  iconType: string;
  tags: { label: string; color: string }[];
  kv: { key: string; value: string }[];
  status: "configured" | "running" | "building" | "pending";
  creditBadge: string;
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  chips?: string[];
}

export const INITIAL_NODES: NodeData[] = [
  {
    id: 1, title: "Signal Engine trigger", provider: "ICP match · Hiring + Funding",
    iconBg: "rgba(59,130,246,.15)", iconColor: "#60A5FA", iconType: "signal",
    tags: [{ label: "ICP ≥ 70", color: "blue" }, { label: "Hiring spike", color: "amber" }, { label: "Funding signal", color: "green" }],
    kv: [{ key: "Runs", value: "Every 6 hours" }],
    status: "configured", creditBadge: "0 credits · free trigger",
  },
  {
    id: 2, title: "Waterfall enrichment", provider: "Crustdata → BetterContact → Hunter",
    iconBg: "rgba(168,85,247,.15)", iconColor: "#C084FC", iconType: "enrich",
    tags: [{ label: "Tier 1", color: "purple" }, { label: "Tier 2", color: "gray" }, { label: "Tier 3", color: "gray" }],
    kv: [{ key: "Enriches", value: "Email + Phone + LinkedIn" }],
    status: "running", creditBadge: "1–3 credits per lead",
  },
  {
    id: 3, title: "AI lead scoring", provider: "Claude · ICP matcher",
    iconBg: "rgba(245,158,11,.15)", iconColor: "#FCD34D", iconType: "score",
    tags: [{ label: "Score 0–100", color: "amber" }, { label: "AI", color: "purple" }],
    kv: [{ key: "Threshold", value: "≥ 80 → continue" }],
    status: "building", creditBadge: "2 credits per score",
  },
];
