// Social Agent (Lead Discovery & Outreach) — types, parser, storage helpers.
//
// The underlying agent in src/lfx/.../lead_discovery_outreach_agent.py emits a
// deterministic Markdown payload via _phase_format_output().  This module
// converts that Markdown into structured Lead objects so the UI can render
// rich cards instead of a wall of text.

export const SOCIAL_AGENT_FLOW_ID = "3539ab22-a44b-4550-ab21-56cfe2a93a97"
export const SOCIAL_AGENT_NODE_ID = "Agent-0vMrI"

export type MessageType =
  | "Connection Request (300 chars)"
  | "InMail"
  | "Follow-Up Message"

export type Tone =
  | "Professional"
  | "Casual & Friendly"
  | "Thought Leadership"
  | "Bold & Direct"

export interface SocialAgentRunInput {
  topic: string
  max_leads: number
  client_company: string
  client_description: string
  sender_name: string
  message_type: MessageType
  tone: Tone
  prospect_data?: string
  system_prompt?: string
}

export interface Lead {
  name: string
  title: string
  company: string
  email: string
  emailUnverified: boolean
  linkedin: string
  postUrl: string
  postSnippet: string
  bestHook: string
  message: string
  charCount: number
  charLimit: number
  messageType: string
  tone: string
}

export interface SocialAgentRun {
  id: string
  createdAt: number // epoch ms
  input: SocialAgentRunInput
  status: "success" | "error" | "running"
  rawOutput?: string
  leads: Lead[]
  upgradeTips: string[]
  errorMessage?: string
  durationMs?: number
}

// ---------------------------------------------------------------------------
// Markdown parser — turns the agent's _phase_format_output() output into Leads
// ---------------------------------------------------------------------------

export function parseAgentOutput(markdown: string): {
  leads: Lead[]
  upgradeTips: string[]
} {
  if (!markdown || typeof markdown !== "string") {
    return { leads: [], upgradeTips: [] }
  }

  // Pull off the Upgrade Tips block at the bottom (if present).
  const tipsMatch = markdown.match(/\n---\n### Upgrade Tips\n([\s\S]*?)$/)
  const upgradeTips: string[] = []
  let body = markdown
  if (tipsMatch) {
    body = markdown.slice(0, tipsMatch.index)
    for (const line of tipsMatch[1].split("\n")) {
      const trimmed = line.replace(/^-\s*/, "").trim()
      if (trimmed) upgradeTips.push(trimmed)
    }
  }

  // Each lead block starts with `## Lead Profile: <name>` and is delimited by
  // `---` lines.  We split on the heading rather than `---` because `---` also
  // appears inside snippets.
  const blocks = body
    .split(/\n?---\n## Lead Profile:/)
    .map((b, i) => (i === 0 ? b.replace(/^---\n## Lead Profile:/, "") : b))
    .filter((b) => b.trim().length > 0 && b.includes("**Title:**"))

  const leads: Lead[] = []
  for (const block of blocks) {
    const lead = parseLeadBlock(block)
    if (lead) leads.push(lead)
  }
  return { leads, upgradeTips }
}

function parseLeadBlock(block: string): Lead | null {
  // The block starts with the name on the first line (everything up to \n).
  const firstNl = block.indexOf("\n")
  if (firstNl < 0) return null
  const name = block.slice(0, firstNl).trim()
  if (!name) return null

  const titleLine = matchLine(block, /\*\*Title:\*\*\s*(.+)/)
  let title = ""
  let company = ""
  if (titleLine) {
    const at = titleLine.lastIndexOf(" at ")
    if (at > 0) {
      title = titleLine.slice(0, at).trim()
      company = titleLine.slice(at + 4).trim()
    } else {
      title = titleLine.trim()
    }
  }

  const emailRaw = matchLine(block, /\*\*Email:\*\*\s*(.+)/) ?? ""
  const emailUnverified = /\(unverified\)/i.test(emailRaw)
  const email = emailRaw
    .replace(/\(unverified\)/i, "")
    .replace(/^not found$/i, "")
    .trim()

  const linkedin = (matchLine(block, /\*\*LinkedIn:\*\*\s*(.+)/) ?? "").trim()

  // Recent post: `1. [<text>](<url>) — "<content>" — Today`
  let postUrl = ""
  let postSnippet = ""
  const postMatch = block.match(
    /### Recent Posts:\n1\.\s*\[([^\]]*)\]\(([^)]*)\)\s*—\s*"([^"]*)"/,
  )
  if (postMatch) {
    postUrl = postMatch[2].trim()
    postSnippet = postMatch[3].trim() || postMatch[1].trim()
  }

  const bestHook = (matchLine(block, /### Best Hook:\n-\s*(.+)/) ?? "").trim()

  // Message body: starts after `**Message:**\n` and ends at `\n\n**Character Count:`
  let message = ""
  const msgMatch = block.match(/\*\*Message:\*\*\n([\s\S]*?)\n\n\*\*Character Count:/)
  if (msgMatch) message = msgMatch[1].trim()

  let charCount = message.length
  let charLimit = 300
  const ccMatch = block.match(/\*\*Character Count:\*\*\s*(\d+)\s*\/\s*(\d+)/)
  if (ccMatch) {
    charCount = parseInt(ccMatch[1], 10)
    charLimit = parseInt(ccMatch[2], 10)
  }

  const typeToneLine = matchLine(block, /\*\*Type:\*\*\s*(.+)/) ?? ""
  const messageType = typeToneLine.split("|")[0]?.trim() ?? ""
  const toneLine = typeToneLine.match(/\*\*Tone:\*\*\s*(.+)/)
  const tone = toneLine ? toneLine[1].trim() : ""

  return {
    name,
    title,
    company,
    email,
    emailUnverified,
    linkedin,
    postUrl,
    postSnippet,
    bestHook,
    message,
    charCount,
    charLimit,
    messageType,
    tone,
  }
}

function matchLine(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// Backend API client — talks to /api/v1/agents/social-listening/* on the
// Outmate Backend (proxied via Next.js rewrite to NEXT_PUBLIC_API_URL).
//
// Auth header is auto-attached by AuthProvider's window.fetch patch.
// User isolation is enforced server-side: every read returns ONLY rows
// belonging to the current Outmate user.
// ---------------------------------------------------------------------------

const API_BASE = "/api/v1/agents/social-listening"

interface BackendLead {
  name: string
  title?: string
  company?: string
  email?: string
  email_unverified?: boolean
  linkedin?: string
  post_url?: string
  post_snippet?: string
  best_hook?: string
  message?: string
  char_count?: number
  char_limit?: number
  message_type?: string
  tone?: string
}

interface BackendAgentRun {
  id: string
  agent_type: string
  status: "running" | "success" | "error"
  input: SocialAgentRunInput & Record<string, unknown>
  leads?: BackendLead[]
  upgrade_tips?: string[]
  output_text?: string | null
  error_message?: string | null
  duration_ms?: number | null
  created_at: string
  finished_at?: string | null
}

function backendLeadToLead(b: BackendLead): Lead {
  return {
    name: b.name ?? "",
    title: b.title ?? "",
    company: b.company ?? "",
    email: b.email ?? "",
    emailUnverified: !!b.email_unverified,
    linkedin: b.linkedin ?? "",
    postUrl: b.post_url ?? "",
    postSnippet: b.post_snippet ?? "",
    bestHook: b.best_hook ?? "",
    message: b.message ?? "",
    charCount: b.char_count ?? 0,
    charLimit: b.char_limit ?? 300,
    messageType: b.message_type ?? "",
    tone: b.tone ?? "",
  }
}

function backendRunToRun(b: BackendAgentRun): SocialAgentRun {
  return {
    id: b.id,
    createdAt: new Date(b.created_at).getTime(),
    input: b.input,
    status: b.status,
    rawOutput: b.output_text ?? undefined,
    leads: (b.leads ?? []).map(backendLeadToLead),
    upgradeTips: b.upgrade_tips ?? [],
    errorMessage: b.error_message ?? undefined,
    durationMs: b.duration_ms ?? undefined,
  }
}

async function readJsonOrThrow(res: Response): Promise<any> {
  const text = await res.text()
  let parsed: any = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }
  if (!res.ok) {
    const detail =
      (parsed && (parsed.detail || parsed.error || parsed.message)) ||
      `HTTP ${res.status}`
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
  }
  return parsed
}

/** POST a new social-listening run.  Resolves with the persisted run row. */
export async function apiRunSocialAgent(
  input: SocialAgentRunInput,
): Promise<SocialAgentRun> {
  const res = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await readJsonOrThrow(res)) as BackendAgentRun
  return backendRunToRun(data)
}

/** Fetch the current user's most recent runs. */
export async function apiListRuns(limit = 20): Promise<SocialAgentRun[]> {
  const res = await fetch(`${API_BASE}/runs?limit=${limit}`, { method: "GET" })
  const data = (await readJsonOrThrow(res)) as BackendAgentRun[]
  return Array.isArray(data) ? data.map(backendRunToRun) : []
}

/** Delete a single run by id (server enforces ownership). */
export async function apiDeleteRun(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok && res.status !== 204) {
    await readJsonOrThrow(res) // throws with parsed error
  }
}

export function newRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Defaults pulled from the canonical flow stored in the agentic infra so
// the user does not need to retype them every time.
// ---------------------------------------------------------------------------

export const DEFAULT_INPUT: SocialAgentRunInput = {
  topic: "",
  max_leads: 5,
  client_company: "Bigstep Technologies",
  client_description:
    "AI-driven, cloud-native software engineering and product development company. We help startups and enterprises ship intelligent, scalable digital products.",
  sender_name: "Aman",
  message_type: "Connection Request (300 chars)",
  tone: "Casual & Friendly",
}

export const MESSAGE_TYPE_OPTIONS: MessageType[] = [
  "Connection Request (300 chars)",
  "InMail",
  "Follow-Up Message",
]

export const TONE_OPTIONS: Tone[] = [
  "Professional",
  "Casual & Friendly",
  "Thought Leadership",
  "Bold & Direct",
]
