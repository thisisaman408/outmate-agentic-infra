// Workflows API client — talks to /api/v1/workflows/*
// Auth header is auto-attached by AuthProvider's window.fetch patch.

const API = "/api/v1/workflows"

// ---------- Types ----------

export interface WorkflowNode {
  id: string
  type: string // signal_engine, waterfall_enrich, icp_match, lead_scoring, email_sequence, etc.
  name: string
  config: Record<string, any>
  position?: { x: number; y: number }
}

export interface WorkflowSettings {
  timezone: string
  business_hours_only: boolean
  skip_weekends: boolean
  max_runs_per_record: string // "Unlimited" | "1" | "3" | "5"
  re_enrollment_rule: string // "Once per 30 days" | "Once" | "Always"
  notify_owner_on_exit: boolean
  slack_alerts: boolean
  email_notifications: boolean
  error_alerts: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: "draft" | "active" | "paused"
  trigger_type: "event_triggered" | "time_triggered" | "manual"
  target_object: "People" | "Companies"
  nodes: WorkflowNode[]
  settings: WorkflowSettings
  owner_name: string
  folder: string | null
  created_at: string
  updated_at: string
  last_run_at: string | null
  next_run_at: string | null
  runs_total: number
  runs_completed: number
  runs_in_progress: number
  runs_failed: number
  credit_usage: number
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: "running" | "completed" | "failed"
  credits_used: number
  duration_ms: number | null
  created_at: string
  finished_at: string | null
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  nodes: string[]
  stats: { leads_per_month: string; conv_rate: string; use_case: string }
  category: string
}

// ---------- API functions ----------

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Workflows API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function fetchWorkflows(status?: string): Promise<Workflow[]> {
  const params = status ? `?status=${status}` : ""
  const data = await apiFetch<{ workflows: Workflow[] }>(params)
  return data.workflows
}

export async function createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
  return apiFetch<Workflow>("", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getWorkflow(id: string): Promise<Workflow> {
  return apiFetch<Workflow>(`/${id}`)
}

export async function updateWorkflow(id: string, data: Partial<Workflow>): Promise<Workflow> {
  return apiFetch<Workflow>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiFetch<void>(`/${id}`, { method: "DELETE" })
}

export async function activateWorkflow(id: string): Promise<Workflow> {
  return apiFetch<Workflow>(`/${id}/activate`, { method: "POST" })
}

export async function pauseWorkflow(id: string): Promise<Workflow> {
  return apiFetch<Workflow>(`/${id}/pause`, { method: "POST" })
}

export async function runWorkflow(id: string): Promise<WorkflowExecution> {
  return apiFetch<WorkflowExecution>(`/${id}/run`, { method: "POST" })
}

export async function getWorkflowRuns(id: string): Promise<WorkflowExecution[]> {
  const data = await apiFetch<{ runs: WorkflowExecution[] }>(`/${id}/runs`)
  return data.runs
}

export async function fetchTemplates(): Promise<WorkflowTemplate[]> {
  const data = await apiFetch<{ templates: WorkflowTemplate[] }>("/templates")
  return data.templates
}

// ---------- Constants ----------

export const TEMPLATE_CATEGORIES = [
  "All Templates",
  "Outbound",
  "Inbound",
  "Enrichment",
  "Scoring & Routing",
  "Signal-Based",
  "AI-Powered",
  "Multi-Channel",
]

export const NODE_TYPES: Record<string, { label: string; icon: string; color: string; description: string }> = {
  signal_engine: {
    label: "Signal Engine",
    icon: "Zap",
    color: "#F59E0B",
    description: "Detect buying signals from multiple sources",
  },
  waterfall_enrich: {
    label: "Waterfall Enrich",
    icon: "Database",
    color: "#3B82F6",
    description: "Enrich records across multiple data providers",
  },
  icp_match: {
    label: "ICP Match",
    icon: "Target",
    color: "#8B5CF6",
    description: "Score records against your ideal customer profile",
  },
  lead_scoring: {
    label: "Lead Scoring",
    icon: "BarChart3",
    color: "#10B981",
    description: "AI-powered lead scoring and prioritization",
  },
  email_sequence: {
    label: "Email Sequence",
    icon: "Mail",
    color: "#EC4899",
    description: "Multi-step email outreach with personalization",
  },
  ai_personalize: {
    label: "AI Personalize",
    icon: "Sparkles",
    color: "#6366F1",
    description: "Generate personalized messaging with AI",
  },
  crm_sync: {
    label: "CRM Sync",
    icon: "RefreshCw",
    color: "#14B8A6",
    description: "Sync data to HubSpot, Salesforce, or other CRMs",
  },
  slack_notify: {
    label: "Slack Notify",
    icon: "MessageSquare",
    color: "#E11D48",
    description: "Send alerts and notifications to Slack channels",
  },
  delay: {
    label: "Delay",
    icon: "Clock",
    color: "#6B7280",
    description: "Wait for a specified duration before continuing",
  },
  condition: {
    label: "Condition",
    icon: "GitBranch",
    color: "#F97316",
    description: "Branch workflow based on conditions",
  },
  webhook: {
    label: "Webhook",
    icon: "Globe",
    color: "#0EA5E9",
    description: "Send or receive data via webhooks",
  },
  voice_call: {
    label: "Voice Call",
    icon: "Phone",
    color: "#7C3AED",
    description: "Trigger AI voice calls to prospects",
  },
}
