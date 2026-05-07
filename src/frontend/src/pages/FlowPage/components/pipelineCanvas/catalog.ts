// Curated GTM Node Catalog. Each entry maps a GTM-domain node (Signal Engine,
// Waterfall Enrich, ICP match, Email Sequence, etc.) to either:
//  - a real Langflow component type (so Use creates a working underlying node)
//  - or a "stub" node that's visually present but not yet executable
//    (will be replaced when the corresponding Langflow component is wired).

import type { GtmKind } from "./nodeKind";

export type CatalogConnectionStatus = "connected" | "available";

export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: GtmKind;
  category: CatalogCategory;
  /**
   * The Langflow component type (display name) this node creates under the
   * hood. If unknown, the composer falls back to a generic placeholder.
   */
  langflowType?: string;
  /** Subcategory shown next to name in sidebar (e.g. "Buyer Intent"). */
  subLabel?: string;
  /** Indicates if this integration is connected (visual badge only). */
  status?: CatalogConnectionStatus;
  /**
   * Default config inserted into the new node's template / metadata.
   */
  defaults?: Record<string, any>;
  /**
   * Editable fields surfaced in the inspector drawer.
   */
  configSchema?: ConfigField[];
};

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "toggle" | "number";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  description?: string;
};

export type CatalogCategory =
  | "integrations"
  | "rules"
  | "agents"
  | "actions";

export const CATEGORY_META: Record<
  CatalogCategory,
  { title: string; description: string }
> = {
  integrations: {
    title: "INTEGRATIONS",
    description: "Connect external tools",
  },
  rules: { title: "RULES", description: "Branch + control flow" },
  agents: { title: "AGENTS", description: "AI-powered steps" },
  actions: { title: "ACTIONS", description: "Things this workflow does" },
};

// langflowType values map to **real Langflow component class names** found
// in src/lfx/src/lfx/components/. When the executor doesn't yet have a
// dedicated component for a given catalog entry, we fall back to one of
// these generic ones — the node is still runnable end-to-end:
//   - "WebhookComponent"    — accepts a payload, used as a generic trigger
//   - "APIRequest"          — generic outbound HTTP, used as integration fallback
//   - "ConditionalRouterComponent" — generic branch
//   - "AgentComponent"      — generic AI agent
const FALLBACK_API_REQUEST = "APIRequest";
const FALLBACK_WEBHOOK = "WebhookComponent";

export const CATALOG: CatalogEntry[] = [
  // ---------- INTEGRATIONS ----------
  {
    id: "predict",
    name: "Predict Data Room",
    subLabel: "Buyer Intent",
    description: "Detect high-intent companies actively researching solutions like yours",
    icon: "P",
    kind: "trigger",
    category: "integrations",
    // No bespoke component yet — webhook trigger receives the Predict event.
    langflowType: FALLBACK_WEBHOOK,
    status: "connected",
  },
  {
    id: "people-data-labs",
    name: "People Data Labs",
    subLabel: "Enrichment",
    description: "Enrich person profiles with rich firmographic + role data",
    icon: "P",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
    status: "connected",
  },
  {
    id: "zoominfo",
    name: "ZoomInfo",
    subLabel: "Enrichment",
    description: "Enterprise contact + company enrichment",
    icon: "Z",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "clearbit",
    name: "Clearbit",
    subLabel: "Enrichment",
    description: "Real-time data enrichment",
    icon: "C",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "hunter",
    name: "Hunter.io",
    subLabel: "Enrichment",
    description: "Email finder + verifier",
    icon: "H",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/hunter/hunter_email_finder.py
    langflowType: "HunterEmailFinderComponent",
    status: "connected",
  },
  {
    id: "apollo",
    name: "Apollo",
    subLabel: "Enrichment",
    description: "Apollo.io contact + company search",
    icon: "A",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/apollo/apollo_people_enrichment.py
    langflowType: "ApolloPeopleEnrichmentComponent",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    subLabel: "CRM",
    description: "Sync to HubSpot CRM",
    icon: "H",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/hubspot/hubspot_crm.py
    langflowType: "HubSpotCRMComponent",
    status: "connected",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    subLabel: "CRM",
    description: "Sync to Salesforce CRM",
    icon: "S",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/salesforce/salesforce_crm.py
    langflowType: "SalesforceCRMComponent",
  },
  {
    id: "smartlead",
    name: "Smartlead",
    subLabel: "Email",
    description: "Send personalized email sequences",
    icon: "S",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
    status: "connected",
  },
  {
    id: "slack",
    name: "Slack",
    subLabel: "Communication",
    description: "Post alerts to Slack channels",
    icon: "S",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
    status: "connected",
  },
  {
    id: "twilio",
    name: "Twilio",
    subLabel: "Communication",
    description: "SMS + voice notifications",
    icon: "T",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "zoom",
    name: "Zoom",
    subLabel: "Meeting",
    description: "Schedule Zoom meetings automatically",
    icon: "Z",
    kind: "action",
    category: "integrations",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "webhook",
    name: "Webhook",
    subLabel: "Developer",
    description: "Send data to a custom HTTP endpoint",
    icon: "W",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/input_output/webhook.py
    langflowType: "WebhookComponent",
  },
  {
    id: "rest-api",
    name: "REST API",
    subLabel: "Developer",
    description: "Call a custom REST API",
    icon: "R",
    kind: "action",
    category: "integrations",
    // Real component: src/lfx/src/lfx/components/data_source/api_request.py
    langflowType: "APIRequest",
  },

  // ---------- RULES ----------
  {
    id: "true-false-branch",
    name: "True / false branch",
    description: "Binary condition split",
    icon: "Diamond",
    kind: "branch",
    category: "rules",
    // Real component: src/lfx/src/lfx/components/flow_controls/conditional_router.py
    langflowType: "ConditionalRouterComponent",
  },
  {
    id: "multi-split-branch",
    name: "Multi-split branch",
    description: "Multiple path routing",
    icon: "Diamond",
    kind: "branch",
    category: "rules",
    langflowType: "DataConditionalRouterComponent",
  },
  {
    id: "traffic-branch",
    name: "Traffic branch",
    description: "A/B split testing",
    icon: "Diamond",
    kind: "branch",
    category: "rules",
    // No native A/B component; conditional router with random selector is the closest fit.
    langflowType: "ConditionalRouterComponent",
  },
  {
    id: "delay",
    name: "Delay",
    description: "Time-based pause",
    icon: "Clock",
    kind: "wait",
    category: "rules",
    // Loop component is the closest existing primitive for time-gated waits.
    langflowType: "LoopComponent",
    configSchema: [
      {
        key: "duration",
        label: "Duration",
        type: "select",
        options: [
          { value: "1h", label: "1 hour" },
          { value: "1d", label: "1 day" },
          { value: "3d", label: "3 days" },
          { value: "7d", label: "7 days" },
          { value: "30d", label: "30 days" },
        ],
      },
    ],
    defaults: { duration: "3d" },
  },
  {
    id: "exit",
    name: "Exit",
    description: "End workflow path",
    icon: "XCircle",
    kind: "exit",
    category: "rules",
    // ChatOutput is the canonical "stop here" terminal node.
    langflowType: "ChatOutput",
  },

  // ---------- AGENTS ----------
  {
    id: "research-with-ai",
    name: "Research with AI",
    description: "AI-powered research",
    icon: "Sparkles",
    kind: "agent",
    category: "agents",
    // Real component: src/lfx/src/lfx/components/models_and_agents/agent.py
    langflowType: "AgentComponent",
  },
  {
    id: "qualify-records",
    name: "Qualify records",
    description: "AI qualification scoring",
    icon: "Star",
    kind: "agent",
    category: "agents",
    langflowType: "AgentComponent",
  },

  // ---------- ACTIONS ----------
  {
    id: "manage-sequences",
    name: "Manage Sequences",
    description: "Email sequence management",
    icon: "Mail",
    kind: "action",
    category: "actions",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "manage-lists",
    name: "Manage lists",
    description: "List operations",
    icon: "Clock",
    kind: "action",
    category: "actions",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "manage-deals",
    name: "Manage deals",
    description: "Deal pipeline actions",
    icon: "LayoutGrid",
    kind: "action",
    category: "actions",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "enrich-data",
    name: "Enrich data",
    description: "Multi-provider enrichment",
    icon: "Database",
    kind: "action",
    category: "actions",
    langflowType: FALLBACK_API_REQUEST,
  },
  {
    id: "assign-manual-tasks",
    name: "Assign manual tasks",
    description: "Human-in-the-loop tasks",
    icon: "ClipboardList",
    kind: "action",
    category: "actions",
    // NotifyComponent fires a side-effect notification on the workflow.
    langflowType: "NotifyComponent",
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));
export const CATALOG_BY_CATEGORY: Record<CatalogCategory, CatalogEntry[]> = {
  integrations: CATALOG.filter((e) => e.category === "integrations"),
  rules: CATALOG.filter((e) => e.category === "rules"),
  agents: CATALOG.filter((e) => e.category === "agents"),
  actions: CATALOG.filter((e) => e.category === "actions"),
};
