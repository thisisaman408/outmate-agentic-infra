import type { WfNode } from "./types";

export const initialNodes: WfNode[] = [
  {
    id: "trigger-1", type: "trigger", title: "Signal Engine", subtitle: "Multi-source intent detection pipeline",
    icon: "signal",
    chips: [
      { label: "Daily 8AM", active: true }, { label: "Funding alert", active: true },
      { label: "Hiring signal", active: true }, { label: "Visitor ID", active: true },
      { label: "LinkedIn signal", active: false }, { label: "Predict Data Room", active: true },
    ],
  },
  {
    id: "enrich-1", type: "action", title: "Waterfall Enrich", subtitle: "Tier 1→2→3 enrichment cascade",
    tag: "PDL + Hunter + Clearbit", icon: "enrich", loopBadge: true,
  },
  {
    id: "cond-1", type: "condition", title: "ICP match check",
    conditionSubtitle: "Company size · Industry · Region · Role seniority",
    icon: "condition",
    yesLabel: "Yes — ICP match", noLabel: "No — not ICP",
    yesBranch: [
      { id: "leadscore-0", type: "action", title: "Lead Scoring", subtitle: "Score contacts 0–100", tag: "AI Model", icon: "score" },
      {
        id: "score-1", type: "condition", title: "Score threshold",
        conditionSubtitle: "Lead score threshold", icon: "condition",
        yesLabel: "Score ≥80", noLabel: "Score <80",
        yesBranch: [
          { id: "email-1", type: "action", title: "Email Sequence", subtitle: "5-step AI personalised cadence", tag: "Smartlead", icon: "email" },
          { id: "wait-1", type: "wait", title: "Wait 3 days", icon: "wait", waitDays: 3, waitBizHours: true },
          { id: "crm-1", type: "action", title: "CRM Push", subtitle: "Create deal in pipeline", tag: "HubSpot", icon: "crm" },
        ],
        noBranch: [
          { id: "wait-2", type: "wait", title: "Wait 7 days", icon: "wait", waitDays: 7 },
          { id: "linkedin-1", type: "action", title: "LinkedIn Connect", subtitle: "Send connection request", icon: "linkedin" },
        ],
      },
    ],
    noBranch: [
      { id: "wait-3", type: "wait", title: "Wait 30 days", icon: "wait", waitDays: 30 },
      { id: "recheck-1", type: "action", title: "Re-check ICP", subtitle: "Re-evaluate against updated ICP", icon: "enrich" },
      { id: "exit-disq", type: "end", title: "Exit — disqualified", icon: "end", endVariant: "disqualified" },
    ],
  },
  {
    id: "cond-2", type: "condition", title: "Reply / open / click detected?",
    conditionSubtitle: "Email reply · link click · open rate >0",
    icon: "condition",
    yesLabel: "Yes — replied", noLabel: "No — no reply",
    yesBranch: [
      { id: "classify-1", type: "action", title: "AI Classify Reply", subtitle: "Positive · Negative · Question", tag: "AI", icon: "ai" },
      { id: "update-crm", type: "action", title: "Update CRM", subtitle: "Move deal stage", tag: "HubSpot", icon: "crm" },
      { id: "slack-1", type: "action", title: "Slack Alert", subtitle: "#sales-alerts channel", icon: "slack" },
      { id: "exit-conv", type: "end", title: "Exit — converted", icon: "end", endVariant: "converted" },
    ],
    noBranch: [
      { id: "wait-4", type: "wait", title: "Wait 3 days", icon: "wait", waitDays: 3 },
      { id: "voice-1", type: "action", title: "Voice AI Call", subtitle: "Conversational AI fallback", icon: "voice" },
      { id: "exit-noresp", type: "end", title: "Exit — no response", icon: "end", endVariant: "no-response" },
    ],
  },
];

export const TOOLBOX_SECTIONS = [
  { title: "Rules", items: [
    { label: "True / false branch", desc: "Binary condition split", iconType: "condition", iconBg: "rgba(184,134,11,.1)" },
    { label: "Multi-split branch", desc: "Multiple path routing", iconType: "condition", iconBg: "rgba(184,134,11,.1)" },
    { label: "Traffic branch", desc: "A/B split testing", iconType: "condition", iconBg: "rgba(184,134,11,.1)" },
    { label: "Delay", desc: "Time-based pause", iconType: "wait", iconBg: "rgba(184,134,11,.08)" },
    { label: "Exit", desc: "End workflow path", iconType: "end", iconBg: "rgba(248,113,113,.06)" },
  ]},
  { title: "Agents", badge: "New", items: [
    { label: "Research with AI", desc: "AI-powered research", iconType: "ai", iconBg: "rgba(192,132,252,.08)" },
    { label: "Qualify records", desc: "AI qualification scoring", iconType: "score", iconBg: "rgba(192,132,252,.08)" },
  ]},
  { title: "Actions", items: [
    { label: "Integrations", desc: "Connect external tools", iconType: "crm", iconBg: "rgba(59,130,246,.08)", hasLogos: true },
    { label: "Manage Sequences", desc: "Email sequence management", iconType: "email", iconBg: "rgba(52,211,153,.06)" },
    { label: "Manage lists", desc: "List operations", iconType: "enrich", iconBg: "rgba(59,130,246,.06)" },
    { label: "Manage deals", desc: "Deal pipeline actions", iconType: "crm", iconBg: "rgba(59,130,246,.08)" },
    { label: "Enrich data", desc: "Multi-provider enrichment", iconType: "enrich", iconBg: "rgba(52,211,153,.06)" },
    { label: "Assign manual tasks", desc: "Human-in-the-loop tasks", iconType: "slack", iconBg: "rgba(251,191,36,.06)" },
    { label: "Update contact/account", desc: "CRM record updates", iconType: "crm", iconBg: "rgba(59,130,246,.08)" },
    { label: "Send Notifications", desc: "Slack, email alerts", iconType: "slack", iconBg: "rgba(251,191,36,.06)" },
  ]},
];

export const INTEGRATIONS = [
  { name: "Predict Data Room", category: "Buyer Intent", iconBg: "#534AB7", iconLetter: "P", connected: true, featured: true },
  { name: "People Data Labs", category: "Enrichment", iconBg: "#2563EB", iconLetter: "P", connected: true },
  { name: "ZoomInfo", category: "Enrichment", iconBg: "#00A3E0", iconLetter: "Z", connected: false },
  { name: "Clearbit", category: "Enrichment", iconBg: "#4F46E5", iconLetter: "C", connected: false },
  { name: "Hunter.io", category: "Enrichment", iconBg: "#F59E0B", iconLetter: "H", connected: true },
  { name: "Apollo", category: "Enrichment", iconBg: "#6366F1", iconLetter: "A", connected: false },
  { name: "HubSpot", category: "CRM", iconBg: "#FF5C35", iconLetter: "H", connected: true },
  { name: "Salesforce", category: "CRM", iconBg: "#00A1E0", iconLetter: "S", connected: false },
  { name: "Smartlead", category: "Email", iconBg: "#6366F1", iconLetter: "S", connected: true },
  { name: "Slack", category: "Communication", iconBg: "#E01E5A", iconLetter: "S", connected: true },
  { name: "Twilio", category: "Communication", iconBg: "#F22F46", iconLetter: "T", connected: false },
  { name: "Zoom", category: "Meeting", iconBg: "#2D8CFF", iconLetter: "Z", connected: false },
  { name: "Webhook", category: "Developer", iconBg: "#6B7280", iconLetter: "W", connected: false },
  { name: "REST API", category: "Developer", iconBg: "#374151", iconLetter: "R", connected: false },
];
