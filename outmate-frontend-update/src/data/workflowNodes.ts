export interface WfNodeTag {
  label: string;
  color: "blue" | "purple" | "green" | "amber" | "gray" | "red";
}

export interface WfNodeKV {
  key: string;
  value: string;
  valueColor?: string;
}

export interface WfNodeData {
  id: string;
  step: number;
  title: string;
  provider: string;
  iconBg: string;
  iconColor: string;
  iconType: "signal" | "enrich" | "score" | "email" | "crm";
  tags: WfNodeTag[];
  kv: WfNodeKV[];
  status: "configured" | "active" | "pending";
  offsetX?: number;
}

export const WORKFLOW_NODES: WfNodeData[] = [
  {
    id: "n1",
    step: 1,
    title: "Signal Engine trigger",
    provider: "ICP match · Hiring + Funding signals",
    iconBg: "rgba(59,130,246,.15)",
    iconColor: "#60A5FA",
    iconType: "signal",
    tags: [
      { label: "ICP match", color: "blue" },
      { label: "Hiring spike", color: "amber" },
      { label: "Funding signal", color: "green" },
    ],
    kv: [
      { key: "Score threshold", value: "≥ 70 / 100" },
      { key: "Runs", value: "Every 6 hours" },
    ],
    status: "configured",
  },
  {
    id: "n2",
    step: 2,
    title: "Waterfall enrichment",
    provider: "Crustdata → BetterContact → Hunter",
    iconBg: "rgba(168,85,247,.15)",
    iconColor: "#C084FC",
    iconType: "enrich",
    tags: [
      { label: "Tier 1: Crustdata", color: "purple" },
      { label: "Tier 2: Hunter", color: "gray" },
    ],
    kv: [
      { key: "Enriches", value: "Email + Phone + LinkedIn" },
      { key: "Cost", value: "1–3 credits / lead" },
    ],
    status: "configured",
  },
  {
    id: "n3",
    step: 3,
    title: "AI lead scoring",
    provider: "Claude Sonnet · ICP matcher",
    iconBg: "rgba(245,158,11,.15)",
    iconColor: "#FCD34D",
    iconType: "score",
    tags: [
      { label: "Score 0–100", color: "amber" },
      { label: "AI Scorer", color: "purple" },
    ],
    kv: [
      { key: "Pass threshold", value: "Score ≥ 80 → continue" },
      { key: "Below threshold", value: "Log + skip 14d" },
    ],
    status: "active",
  },
  {
    id: "n4",
    step: 4,
    title: "Email sequence",
    provider: "Gmail · 5-step personalised outreach",
    iconBg: "rgba(16,185,129,.15)",
    iconColor: "#34D399",
    iconType: "email",
    tags: [
      { label: "5 emails", color: "green" },
      { label: "AI personalised", color: "blue" },
    ],
    kv: [
      { key: "Sequence", value: "Intent Outreach v2" },
      { key: "Spacing", value: "Day 1 · 3 · 7 · 14 · 21" },
    ],
    status: "configured",
    offsetX: -120,
  },
  {
    id: "n5",
    step: 5,
    title: "CRM update",
    provider: "Salesforce · Push to pipeline",
    iconBg: "rgba(239,68,68,.12)",
    iconColor: "#F87171",
    iconType: "crm",
    tags: [
      { label: "Salesforce", color: "gray" },
      { label: "Auto-fill", color: "purple" },
    ],
    kv: [
      { key: "Action", value: "Create + update deal" },
      { key: "Status", value: "Connect Salesforce", valueColor: "#FCD34D" },
    ],
    status: "pending",
    offsetX: 120,
  },
];
