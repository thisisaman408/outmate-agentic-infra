"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Search, Sparkles, Users, Loader2, Plus, MessageSquare, Library, Copy, Download, Zap, Mail, ExternalLink, Send, Check, CheckCircle2 } from "lucide-react"
import { CompaniesResultsTable } from "@/components/leads/companies/companies-results-table"
import type { CompanyData } from "@/components/leads/companies/companies-results-table"
import { ProspectsResultsTable } from "@/components/leads/prospects/prospects-results-table"
import type { ProspectProfile, EmployerItem } from "@/lib/services/prospectService"

type WorkflowStep = {
  title: string
  tool: string
  endpoint: string
  input: any
  output: any
}

type PromptLibraryItem = {
  id: string
  useCase: "Build Lead Lists" | "Find Contact Info" | "Personalize Your Outreach" | "Meeting Prep" | "Recruiting"
  title: string
  description: string
  prompt: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  createdAt: string
}

type ChatSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  query: string
  intent: "business" | "prospect"
  results: any[]
  tamPreview: { count: number; cost: number }
  clarification: string
  workflowSteps: WorkflowStep[]
  hasSearched: boolean
  clarificationStep: "pending" | "clarifying" | "confirmed" | "searching" | "completed"
  extractedFilters: Record<string, any>
  suggestedPrompts: string[]
}

const CHAT_STORAGE_KEY = "nlp_enrichment_chats_v3"

const PROMPT_LIBRARY: PromptLibraryItem[] = [
  {
    id: "build-1",
    useCase: "Build Lead Lists",
    title: "Marketing decision makers at small digital agencies in TX and FL",
    description: "Find marketing decision makers at digital agencies with 1-50 employees in Texas and Florida.",
    prompt: "Find Marketing decision makers at digital agencies with 1 to 50 employees in Texas and Florida.",
  },
  {
    id: "contact-1",
    useCase: "Find Contact Info",
    title: "Data decision makers at mid-size Snowflake users",
    description: "Find data leaders at companies with 100-1000 employees using Snowflake and include verified emails only.",
    prompt: "Find data decision makers at companies with 100 to 1000 employees that use Snowflake, only with verified emails.",
  },
  {
    id: "personalize-1",
    useCase: "Personalize Your Outreach",
    title: "Executive outreach using recent company signals",
    description: "Find target executives and include recent activity context for personalized outreach.",
    prompt: "Find VP/Head level marketing leaders in fintech companies in the US and include recent company signals for personalized outreach.",
  },
  {
    id: "meeting-1",
    useCase: "Meeting Prep",
    title: "Company overview with competitors and likely pain points",
    description: "Get target companies and context useful for prep before outbound meetings.",
    prompt: "Find B2B SaaS companies in the US with 200 to 1000 employees and include data useful for competitor and pain-point analysis.",
  },
  {
    id: "recruiting-1",
    useCase: "Recruiting",
    title: "Texas DevOps or platform engineers in security",
    description: "Source DevOps/platform engineering prospects in information security companies in Texas.",
    prompt: "Find DevOps or Platform Engineers in information security companies in Texas with at least 18 months in role.",
  },
]

export default function DatabaseFinderPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [intent, setIntent] = useState<"business" | "prospect">("business")
  const [tamPreview, setTamPreview] = useState({ count: 0, cost: 0 })
  const [hasSearched, setHasSearched] = useState(false)
  const [clarification, setClarification] = useState("")
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [latestExtractedFilters, setLatestExtractedFilters] = useState<Record<string, any>>({})
  const [queryRelevant, setQueryRelevant] = useState(true)
  const [queryReason, setQueryReason] = useState("")
  const [activePanel, setActivePanel] = useState<"chats" | "library">("chats")
  const [selectedUseCase, setSelectedUseCase] = useState<"All" | PromptLibraryItem["useCase"]>("All")
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [detectedSignals, setDetectedSignals] = useState<any[]>([])
  const [isDetectingSignals, setIsDetectingSignals] = useState(false)
  const [showSignals, setShowSignals] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [campaignDraft, setCampaignDraft] = useState<{
    subject: string
    email_body: string
    linkedin_message: string
    recipients: Array<{
      name: string
      first_name?: string
      email?: string
      linkedin_url?: string
      job_title?: string
      company?: string
      domain?: string
    }>
  } | null>(null)
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false)
  const [campaignApproved, setCampaignApproved] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState<Set<number>>(new Set())
  const [sentRecipients, setSentRecipients] = useState<Record<number, "email" | "linkedin" | "both">>({})
  const [sendingRecipients, setSendingRecipients] = useState<Record<number, "email" | "linkedin">>({})
  const [sendErrors, setSendErrors] = useState<Record<number, string>>({})
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [linkedinConnected, setLinkedinConnected] = useState(false)

  // Agent conversation state
  const [agentMessages, setAgentMessages] = useState<Array<{role: "user" | "assistant", content: string}>>([])
  const [isAgentResponding, setIsAgentResponding] = useState(false)

  const queryInputRef = useRef<HTMLTextAreaElement>(null)
  const agentMessagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll agent conversation when new messages appear
  useEffect(() => {
    agentMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentMessages, isAgentResponding])

  // Check Gmail & LinkedIn connection status on mount
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

    // Check if redirected back from Gmail OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get("gmail_connected") === "true") {
      setGmailConnected(true)
      setGmailEmail(params.get("gmail_email") || "")
      setClarification(`Gmail connected as ${params.get("gmail_email")}! You can now send emails directly.`)
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname)
    }

    // Check Gmail status
    fetch(`${API}/api/campaigns/gmail/status`).then(r => r.json()).then(data => {
      if (data.connected) {
        setGmailConnected(true)
        setGmailEmail(data.email || "")
      }
    }).catch(() => {})

    // Check LinkedIn (Unipile) status
    fetch(`${API}/api/campaigns/linkedin/status`).then(r => r.json()).then(data => {
      if (data.connected) setLinkedinConnected(true)
    }).catch(() => {})
  }, [])

  const handleConnectGmail = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${API}/api/campaigns/gmail/auth-url`)
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (e) {
      console.error("Gmail auth error:", e)
      setClarification("Failed to start Gmail authentication. Please try again.")
    }
  }

  const handleSendEmail = async (recipientIdx: number, toEmail: string, subject: string, body: string) => {
    setSendingRecipients(prev => ({ ...prev, [recipientIdx]: "email" }))
    setSendErrors(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${API}/api/campaigns/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: toEmail, subject, body }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients(prev => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "linkedin" ? "both" : "email"
      }))
    } catch (e: any) {
      setSendErrors(prev => ({ ...prev, [recipientIdx]: e.message || "Email send failed" }))
    } finally {
      setSendingRecipients(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    }
  }

  const handleSendLinkedIn = async (recipientIdx: number, linkedinUrl: string, message: string) => {
    setSendingRecipients(prev => ({ ...prev, [recipientIdx]: "linkedin" }))
    setSendErrors(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${API}/api/campaigns/send-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: linkedinUrl, message }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients(prev => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "email" ? "both" : "linkedin"
      }))
    } catch (e: any) {
      setSendErrors(prev => ({ ...prev, [recipientIdx]: e.message || "LinkedIn send failed" }))
    } finally {
      setSendingRecipients(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    }
  }

  const toPrettyJson = (obj: any) => JSON.stringify(obj, null, 2)

  const parseConnectionCount = (...values: any[]): number => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
      if (typeof value === "string" && value.trim()) {
        const digits = value.replace(/[^0-9]/g, "")
        if (digits) {
          const parsed = Number(digits)
          if (Number.isFinite(parsed)) return parsed
        }
      }
    }
    return 0
  }

  const sumEmployerYears = (...employerLists: any[]): number => {
    let total = 0
    for (const list of employerLists) {
      if (!Array.isArray(list)) continue
      for (const emp of list) {
        const raw = Number(emp?.years_at_company_raw ?? emp?.yearsAtCompanyRaw ?? 0)
        if (Number.isFinite(raw) && raw > 0) total += raw
      }
    }
    return total
  }

  const formatYearsExperience = (label: any, rawYears: any, expList?: any[]): string => {
    if (typeof label === "string" && label.trim()) return label.trim()
    const n = Number(rawYears)
    if (Number.isFinite(n) && n > 0) return n === 1 ? "1 year" : `${Math.floor(n)} years`
    if (Array.isArray(expList) && expList.length > 0) return `${expList.length}+ roles`
    return "N/A"
  }

  const createSessionTitle = (query: string) => {
    const cleaned = query.trim()
    if (!cleaned) return "New Chat"
    const words = cleaned.split(/\s+/).slice(0, 8).join(" ")
    return words.length < cleaned.length ? `${words}...` : words
  }

  const createEmptySession = (): ChatSession => {
    const now = new Date().toISOString()
    return {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: "New Chat",
      createdAt: now,
      updatedAt: now,
      messages: [],
      query: "",
      intent: "business",
      results: [],
      tamPreview: { count: 0, cost: 0 },
      clarification: "",
      workflowSteps: [],
      hasSearched: false,
      clarificationStep: "pending",
      extractedFilters: {},
      suggestedPrompts: []
    }
  }

  const applySessionToView = (session: ChatSession) => {
    const normalizeLinkedinUrl = (value: any) => {
      if (typeof value !== "string" || !value.trim()) return ""
      const v = value.trim()
      return v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`
    }

    const normalizeEmployer = (src: any): EmployerItem => ({
      name: src?.name || src?.company_name || src?.company || "",
      linkedin_id: src?.linkedin_id || src?.company_linkedin_id || "",
      company_id: Number(src?.company_id || 0),
      company_linkedin_id: src?.company_linkedin_id || "",
      company_website_domain: src?.company_website_domain || src?.company_domain || "",
      position_id: Number(src?.position_id || 0),
      title: src?.title || "",
      description: src?.description || "",
      location: src?.location || "",
      start_date: src?.start_date || "",
      end_date: src?.end_date || undefined,
      employer_is_default: Boolean(src?.employer_is_default),
      seniority_level: src?.seniority_level || src?.seniority || "",
      function_category: src?.function_category || src?.job_function || "",
      years_at_company: src?.years_at_company || "",
      years_at_company_raw: Number(src?.years_at_company_raw || 0),
      company_headquarters_country: src?.company_headquarters_country || "",
      company_hq_location: src?.company_hq_location || src?.headquarter || "",
      company_hq_location_address_components: Array.isArray(src?.company_hq_location_address_components)
        ? src.company_hq_location_address_components
        : [],
      company_headcount_range: src?.company_headcount_range || src?.company_size || "",
      company_industries: Array.isArray(src?.company_industries) ? src.company_industries : [],
      company_linkedin_industry: src?.company_linkedin_industry || src?.industry || "",
      company_type: src?.company_type || "",
      company_headcount_latest: Number(src?.company_headcount_latest || src?.size || 0),
      company_website: src?.company_website || src?.website || "",
      company_linkedin_profile_url: src?.company_linkedin_profile_url || src?.linkedin_url || "",
      business_email_verified: Boolean(src?.business_email_verified),
    })

    const normalizeProspect = (item: any): ProspectProfile => {
      const raw = (item?.raw_data && typeof item.raw_data === "object")
        ? item.raw_data
        : ((item?.rawData && typeof item.rawData === "object") ? item.rawData : {})

      const currentEmployersArr = (Array.isArray(item?.current_employers) && item.current_employers.length > 0
        ? item.current_employers
        : null) ||
        (Array.isArray(item?.employer) && item.employer.length > 0 ? item.employer : null) ||
        (Array.isArray(raw?.current_employers) && raw.current_employers.length > 0 ? raw.current_employers : null) ||
        (Array.isArray(raw?.employer) && raw.employer.length > 0 ? raw.employer : null) ||
        (item?.companyName || item?.company || raw?.company_name
          ? [
            {
              name: item?.companyName || item?.company || raw?.company_name,
              title: item?.title || raw?.title || item?.headline || raw?.headline || "",
              company_linkedin_industry: item?.industry || raw?.industry || "",
            },
          ]
          : [])

      const currentEmployerRaw = currentEmployersArr[0] || null

      const pastEmployersArr = (Array.isArray(item?.past_employers) ? item.past_employers : null) ||
        (Array.isArray(raw?.past_employers) ? raw.past_employers : null) ||
        []

      const computedYears = sumEmployerYears(
        item?.current_employers,
        item?.past_employers,
        item?.employer,
        raw?.current_employers,
        raw?.past_employers,
        raw?.employer
      )

      const email = (Array.isArray(item?.emails) &&
        item.emails.find((e: any) => typeof e === "string" && e.includes("@"))) ||
        (typeof item?.email === "string" && item.email.includes("@") ? item.email : "") ||
        (typeof raw?.email === "string" && raw.email.includes("@") ? raw.email : "")

      const locationCountry = item?.location_details?.country ||
        raw?.location_details?.country ||
        item?.region ||
        item?.location ||
        raw?.region ||
        raw?.location ||
        ""

      return {
        person_id: Number(item?.person_id || item?.prospect_id || raw?.person_id || 0),
        name: item?.name || item?.full_name || item?.contactName || raw?.name || raw?.full_name || "Unknown",
        first_name: item?.first_name || raw?.first_name || "",
        last_name: item?.last_name || raw?.last_name || "",
        region: (typeof item?.region === "string" ? item.region : "") ||
          (typeof item?.location === "string" ? item.location : "") ||
          "",
        region_address_components: Array.isArray(item?.region_address_components) ? item.region_address_components : [],
        headline: item?.headline || item?.title || raw?.headline || raw?.title || currentEmployerRaw?.title || "",
        summary: item?.summary || raw?.summary || "",
        skills: Array.isArray(item?.skills) ? item.skills : (Array.isArray(raw?.skills) ? raw.skills : []),
        languages: Array.isArray(item?.languages) ? item.languages : (Array.isArray(raw?.languages) ? raw.languages : []),
        linkedin_profile_url: normalizeLinkedinUrl(item?.linkedin_profile_url || item?.flagship_profile_url || item?.linkedin_url || item?.linkedin || raw?.linkedin_profile_url || raw?.flagship_profile_url || raw?.linkedin_url),
        flagship_profile_url: normalizeLinkedinUrl(item?.flagship_profile_url || item?.linkedin_profile_url || item?.linkedin_url || item?.linkedin || raw?.flagship_profile_url || raw?.linkedin_profile_url || raw?.linkedin_url),
        emails: email ? [email] : [],
        profile_picture_url: item?.profile_picture_url || raw?.profile_picture_url || "",
        profile_picture_permalink: item?.profile_picture_permalink || raw?.profile_picture_permalink || "",
        twitter_handle: item?.twitter_handle || raw?.twitter_handle || "",
        num_of_connections: parseConnectionCount(
          item?.num_of_connections,
          item?.connections,
          item?.connection_count,
          item?.linkedin_connections,
          raw?.num_of_connections,
          raw?.connections,
          raw?.connection_count,
          raw?.linkedin_connections
        ),
        education_background: Array.isArray(item?.education_background) ? item.education_background : [],
        honors: Array.isArray(item?.honors) ? item.honors : [],
        certifications: Array.isArray(item?.certifications) ? item.certifications : [],
        current_employers: currentEmployersArr.map(normalizeEmployer),
        past_employers: pastEmployersArr.map(normalizeEmployer),
        last_updated: item?.last_updated || item?.updated_at || raw?.last_updated || raw?.updated_at || "",
        recently_changed_jobs: Boolean(item?.recently_changed_jobs || raw?.recently_changed_jobs),
        years_of_experience: formatYearsExperience(
          item?.years_of_experience || raw?.years_of_experience,
          item?.years_of_experience_raw ??
          raw?.years_of_experience_raw ??
          item?.experience_years ??
          raw?.experience_years ??
          item?.total_experience_years ??
          raw?.total_experience_years ??
          computedYears,
          Array.isArray(item?.experience) ? item.experience : (Array.isArray(raw?.experience) ? raw.experience : [])
        ),
        years_of_experience_raw: Number(
          item?.years_of_experience_raw ??
          raw?.years_of_experience_raw ??
          item?.experience_years ??
          raw?.experience_years ??
          item?.total_experience_years ??
          raw?.total_experience_years ??
          computedYears ??
          0
        ),
        all_employers: Array.isArray(item?.all_employers)
          ? item.all_employers.map(normalizeEmployer)
          : [...currentEmployersArr, ...pastEmployersArr].map(normalizeEmployer),
        updated_at: item?.updated_at || raw?.updated_at || "",
        location_details: {
          city: item?.location_details?.city || raw?.location_details?.city || "",
          state: item?.location_details?.state || raw?.location_details?.state || "",
          country: locationCountry || "N/A",
          continent: item?.location_details?.continent || raw?.location_details?.continent || "",
        },
      }
    }

    setNaturalLanguageQuery(session.query || "")
    setIntent(session.intent)
    setResults(
      session.intent === "prospect"
        ? (Array.isArray(session.results) ? session.results.map(normalizeProspect) : [])
        : (session.results || [])
    )
    setTamPreview(session.tamPreview || { count: 0, cost: 0 })
    setClarification(session.clarification || "")
    setWorkflowSteps(session.workflowSteps || [])
    setHasSearched(Boolean(session.hasSearched))
    // Load suggested prompts from saved session
    setSuggestedPrompts(session.suggestedPrompts || [])
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : []
      if (parsed.length > 0) {
        const ordered = [...parsed].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        setChats(ordered)
        setActiveChatId(ordered[0].id)
        applySessionToView(ordered[0])
      }
    } catch (e) {
      console.warn("Failed to load NLP chats", e)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
    } catch (e) {
      console.warn("Failed to persist NLP chats", e)
    }
  }, [chats])

  const startNewChat = () => {
    const session = createEmptySession()
    setChats((prev) => [session, ...prev])
    setActiveChatId(session.id)
    applySessionToView(session)
    setAgentMessages([])
  }

  const openChat = (chatId: string) => {
    const found = chats.find((c) => c.id === chatId)
    if (!found) return
    setActiveChatId(found.id)
    setDetectedSignals([])  // Clear detected signals when switching chats
    setSuggestedPrompts([])  // Clear suggested prompts when switching chats
    setAgentMessages([])
    applySessionToView(found)
  }

  // Generate suggested prompts based on current search context
  const generateSuggestedPrompts = (query: string, searchIntent: "business" | "prospect", filters: Record<string, any>) => {
    const suggestions: string[] = []
    const industry = filters?.industry?.[0] || ""
    const location = filters?.location?.[0] || ""

    if (searchIntent === "business") {
      // Company search - suggest related actions
      if (industry) {
        suggestions.push(`Find decision makers at ${industry} companies in ${location || "the US"} with recent funding`)
        suggestions.push(`Get recent news and signals for ${industry} companies in ${location || "the US"}`)
      }
      suggestions.push(`Find similar companies to the ones found`)
      suggestions.push(`Enrich the found companies with technographic data`)
    } else {
      // Prospect search - suggest related actions
      if (industry) {
        suggestions.push(`Find ${industry} decision makers who recently changed jobs`)
        suggestions.push(`Get contact information for ${industry} leaders in ${location || "the US"}`)
      }
      suggestions.push(`Find prospects with AI expertise`)
      suggestions.push(`Search for prospects who posted on LinkedIn recently`)
    }

    // Always add some general suggestions
    suggestions.push(`Detect signals for personalized outreach`)
    suggestions.push(`Create an email campaign for these leads`)

    setSuggestedPrompts(suggestions)
  }

  const persistCurrentChat = (payload: Partial<ChatSession> & { userPrompt?: string; assistantMessage?: string }) => {
    const now = new Date().toISOString()
    const baseSession = chats.find((c) => c.id === activeChatId) || (activeChatId ? undefined : createEmptySession())
    const workingSession = baseSession || createEmptySession()

    const nextMessages = [...workingSession.messages]
    if (payload.userPrompt) {
      nextMessages.push({ role: "user", content: payload.userPrompt, createdAt: now })
    }
    if (payload.assistantMessage) {
      nextMessages.push({ role: "assistant", content: payload.assistantMessage, createdAt: now })
    }

    const nextSession: ChatSession = {
      ...workingSession,
      ...payload,
      id: workingSession.id,
      title: payload.query ? createSessionTitle(payload.query) : workingSession.title,
      updatedAt: now,
      messages: nextMessages,
    }

    setActiveChatId(nextSession.id)
    setChats((prev) => {
      const exists = prev.some((c) => c.id === nextSession.id)
      const merged = exists
        ? prev.map((c) => (c.id === nextSession.id ? nextSession : c))
        : [nextSession, ...prev]
      return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    })
  }

  const buildExamples = (query: string) => {
    const endpoint = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/explorium/search`
    const payload = { query }
    return {
      curl: `curl -X POST "${endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(payload)}'`,
      python: `import requests\n\nurl = "${endpoint}"\npayload = ${toPrettyJson(payload)}\n\nres = requests.post(url, json=payload, timeout=90)\nprint(res.json())`,
      javascript: `const url = "${endpoint}";\nconst payload = ${toPrettyJson(payload)};\n\nconst res = await fetch(url, {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(payload),\n});\nconsole.log(await res.json());`,
    }
  }

  const mapCompanyResults = (rawList: any[]): CompanyData[] => {
    return (Array.isArray(rawList) ? rawList : []).map((item: any) => {
      const raw = (item?.raw_data && typeof item.raw_data === "object")
        ? item.raw_data
        : ((item?.rawData && typeof item.rawData === "object") ? item.rawData : {})

      const parseLocationParts = (value?: string) => {
        if (!value || typeof value !== "string") return { city: undefined, state: undefined, country: undefined }
        const parts = value.split(",").map((p) => p.trim()).filter(Boolean)
        if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[2] }
        if (parts.length === 2) return { city: parts[0], state: undefined, country: parts[1] }
        return { city: parts[0], state: undefined, country: undefined }
      }

      const parsedLocation = parseLocationParts(
        item.location_display || item.location || item.headquarters_address || raw.location_display || raw.location || raw.headquarter
      )

      const employeesExact = item.employee_count_exact ?? item.linkedin_headcount ?? item.size ?? raw.employee_count_exact ?? raw.size
      const employeesRange = item.employee_count_range ?? item.employee_range ?? item.number_of_employees_range ?? item.company_size ?? item.size_range ?? raw.employee_count_range ?? raw.number_of_employees_range

      return {
        id: String(item.id ?? item.business_id ?? item.domain ?? ""),
        name: item.name ?? item.business_name ?? item.company_name ?? "",
        domain: item.domain ?? item.website ?? "",
        website: item.website,
        logo_url: item.logo_url ?? item.linkedin_logo_url ?? item.business_logo ?? item.logo ?? (item.domain ? `https://logo.clearbit.com/${item.domain}` : undefined),
        description: item.description ?? item.company_description ?? item.business_description,
        industry: item.industry ?? item.linkedin_industry_category ?? item.primary_industry,
        sub_industry: item.sub_industry,
        linkedin_industry_category: item.linkedin_industry_category,
        company_type: item.company_type ?? item.business_type ?? item.type ?? raw.company_type ?? raw.type,
        founded_year: item.founded_year ?? item.year_founded ?? item.founded_at ?? raw.founded_year ?? raw.year_founded ?? raw.founded_at,
        employee_count_exact: employeesExact,
        employee_count_range: employeesRange,
        revenue_exact: item.revenue_exact ?? item.yearly_revenue_exact ?? item.yearly_revenue ?? item.yearly_revenue_usd ?? item.revenue_usd ?? item.annual_revenue_usd ?? raw.revenue_exact ?? raw.yearly_revenue_exact ?? raw.revenue,
        revenue_range: item.revenue_range ?? item.yearly_revenue_range ?? item.estimated_revenue_range ?? raw.revenue_range ?? raw.yearly_revenue_range,
        funding_stage: item.funding_stage ?? item.last_funding_round_type ?? item.last_funding_stage,
        funding_total: item.funding_total ?? item.known_funding_total_value ?? item.total_funding_usd,
        last_funding_date: item.last_funding_date ?? item.last_funding_round_date ?? item.first_funding_round_date,
        has_recent_funding: item.has_recent_funding,
        investors: (Array.isArray(item.investors) && item.investors.length > 0)
          ? item.investors
          : ((Array.isArray(raw.investors) && raw.investors.length > 0) ? raw.investors : (item.investor_list ?? [])),
        investors_count: item.investors_count ?? raw.investors_count ?? (Array.isArray(item.investors) && item.investors.length > 0 ? item.investors.length : undefined),
        headquarters_country: item.headquarters_country ?? item.country_name ?? item.country ?? raw.headquarters_country ?? raw.country ?? parsedLocation.country,
        headquarters_state: item.headquarters_state ?? item.region_name ?? item.state ?? raw.headquarters_state ?? raw.state ?? parsedLocation.state,
        headquarters_city: item.headquarters_city ?? item.city_name ?? item.city ?? raw.headquarters_city ?? raw.city ?? parsedLocation.city,
        street: item.street,
        zip_code: item.zip_code ?? item.zip ?? raw.zip_code ?? raw.zip,
        locations: Array.isArray(item.locations) && item.locations.length > 0 ? item.locations : [],
        headquarters_address: item.headquarters_address ?? item.hq_address ?? item.location_display ?? item.location ?? raw.headquarter ?? raw.headquarters_address,
        location_display: item.location_display ?? item.location ?? raw.location_display ?? raw.location ?? raw.headquarter,
        phone: Array.isArray(item.phone) ? item.phone.join(", ") : item.phone,
        email: Array.isArray(item.email) ? item.email.join(", ") : item.email,
        personal_email: item.personal_email,
        work_email: item.work_email,
        linkedin_url: item.linkedin_url ?? item.linkedin_profile ?? item.company_linkedin_url ?? item.li_vanity ?? raw.linkedin_url ?? raw.li_vanity,
        twitter_url: item.twitter_url,
        facebook_url: item.facebook_url,
        instagram_url: item.instagram_url,
        follower_count: item.follower_count ?? item.linkedin_followers,
        technologies: (Array.isArray(item.technologies) && item.technologies.length > 0)
          ? item.technologies
          : ((Array.isArray(raw.technologies) && raw.technologies.length > 0) ? raw.technologies : (item.full_tech_stack ?? item.technologies_used)),
        is_tech_heavy: item.is_tech_heavy,
        employee_growth_6m: item.employee_growth_6m,
        employee_growth_12m: item.employee_growth_12m,
        employee_growth_6m_percent: item.employee_growth_6m_percent,
        employee_growth_12m_percent: item.employee_growth_12m_percent,
        growth_category: item.growth_category,
        job_openings_count: item.job_openings_count,
        web_traffic: item.web_traffic,
        seo_score: item.seo_score,
        decision_makers_count: item.decision_makers_count,
        locations_distribution_count: item.locations_distribution_count || (Array.isArray(item.locations) ? item.locations.length : 0),
        acquisition_status: item.acquisition_status,
        data_quality_score: item.data_quality_score ?? item.quality_score ?? raw.data_quality_score ?? raw.quality_score,
        provider_source: item.provider_source,
        enriched: item.enriched ?? item.contactout_enriched ?? raw.enriched ?? false,
        ticker: item.ticker,
        stock_symbol: item.stock_symbol,
        naics: item.naics ?? item.naics_code,
        naics_description: item.naics_description,
        sic_code: item.sic_code,
        sic_code_description: item.sic_code_description,
        last_enriched_at: item.last_enriched_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        last_raised_amount: item.last_raised_amount,
        market_cap: item.market_cap,
        fiscal_year_end: item.fiscal_year_end,
        number_of_locations: item.number_of_locations,
        alexa_rank: item.alexa_rank,
        social_insights: item.social_insights,
      }
    })
  }

  const handleRefineSearch = () => {
    setHasSearched(false)
    queryInputRef.current?.focus()
  }

  const handlePullAllCompanies = async () => {
    if (isSearching || intent !== "business") return

    const filters = latestExtractedFilters || {}
    if (!filters || Object.keys(filters).length === 0) return

    setIsSearching(true)
    try {
      const targetLimit = Math.min(Math.max(results.length, 25), 100)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/leads/search/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters,
          options: {
            limit: targetLimit,
            page: 1,
            enrich: true,
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to pull companies")

      const payload = await response.json()
      const rawCompanies = payload?.data?.companies || []
      const mapped = mapCompanyResults(rawCompanies)

      setResults(mapped)
      setTamPreview((prev) => ({
        ...prev,
        count: payload?.data?.total_count || mapped.length || prev.count,
        cost: mapped.length * 0.1,
      }))
    } catch (e) {
      console.error("Pull all companies failed:", e)
    } finally {
      setIsSearching(false)
    }
  }

  const generateClarificationMessage = (query: string, intent: string, filters: Record<string, any>): string => {
    const intentText = intent === "prospect" ? "people/prospects" : "companies"
    const filterList = []

    if (filters.industry && filters.industry.length > 0) {
      filterList.push(`Industry: ${filters.industry.join(", ")}`)
    }
    if (filters.location && filters.location.length > 0) {
      filterList.push(`Location: ${filters.location.join(", ")}`)
    }
    if (filters.company_size && filters.company_size.length > 0) {
      filterList.push(`Company Size: ${filters.company_size.join(", ")}`)
    }
    if (filters.current_title && filters.current_title.length > 0) {
      filterList.push(`Job Titles: ${filters.current_title.join(", ")}`)
    }
    if (filters.keywords && filters.keywords.length > 0) {
      filterList.push(`Keywords: ${filters.keywords.join(", ")}`)
    }

    const filtersText = filterList.length > 0
      ? `Based on your query, I've identified the following filters:\n\n${filterList.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n`
      : "I've analyzed your query and will search for relevant data based on the context.\n\n"

    return `I'll help you find ${intentText} for your query: "${query}"\n\n${filtersText}Please review the filters above and confirm if you'd like me to proceed with the search, or let me know if you'd like to modify any filters.`
  }

  const detectIntent = (query: string): "business" | "prospect" => {
    const queryLower = query.toLowerCase()
    const prospectKeywords = [
      'people', 'prospects', 'person', 'contacts', 'vp', 'ceo', 'cto', 'head of', 'manager',
      'engineer', 'decision makers', 'directors', 'founders', 'who is', 'who are', 'who works',
      'profiles', 'emails', 'phones'
    ]

    // If ANY prospect keyword or signal is found, it's a prospect search
    const hasProspectKeyword = prospectKeywords.some(kw => queryLower.includes(kw))
    const hasStrongContactSignal = /\b(email|phone|contact|profile|linkedin)\b/i.test(queryLower)

    return (hasProspectKeyword || hasStrongContactSignal) ? "prospect" : "business"
  }

  const extractFiltersFromQuery = (query: string): Record<string, any> => {
    const queryLower = query.toLowerCase()
    const extractedFilters: Record<string, any> = {}

    // 1. Extract location
    const locationPatterns = [
      // North America & Regions
      { pattern: /\b(north america|na)\b/i, values: ['United States', 'Canada', 'Mexico'] },
      { pattern: /\b(europe|eu)\b/i, values: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy'] },
      { pattern: /\b(asia|apac)\b/i, values: ['India', 'China', 'Singapore', 'Japan', 'Australia'] },

      // Individual Countries
      { pattern: /\b(usa|us|united states|america)\b/i, values: ['United States'] },
      { pattern: /\bcanada\b/i, values: ['Canada'] },
      { pattern: /\bmexico\b/i, values: ['Mexico'] },
      { pattern: /\b(uk|united kingdom|britain)\b/i, values: ['United Kingdom'] },
      { pattern: /\bindia\b/i, values: ['India'] },
      { pattern: /\bgermany\b/i, values: ['Germany'] },
      { pattern: /\bfrance\b/i, values: ['France'] },

      // US States
      { pattern: /\b(texas|tx)\b/i, values: ['Texas'] },
      { pattern: /\b(california|ca)\b/i, values: ['California'] },
      { pattern: /\b(new york|ny)\b/i, values: ['New York'] },
      { pattern: /\b(florida|fl)\b/i, values: ['Florida'] },
      { pattern: /\b(illinois|il)\b/i, values: ['Illinois'] },
    ]

    const extractedLocations: string[] = []
    for (const { pattern, values } of locationPatterns) {
      if (queryLower.match(pattern)) {
        values.forEach(v => {
          if (!extractedLocations.includes(v)) extractedLocations.push(v)
        })
      }
    }
    if (extractedLocations.length > 0) {
      extractedFilters.location = extractedLocations
    }

    // 2. Extract industry
    const industryPatterns = [
      { pattern: /\b(b2b\s+)?(saas|software as a service)\b/i, values: ['Software'] },
      { pattern: /\bfintech\b/i, values: ['Financial Services', 'Fintech'] },
      { pattern: /\bhealthcare\b/i, values: ['Healthcare', 'Medical'] },
      { pattern: /\btechnology|tech\b/i, values: ['Technology', 'Software'] },
      { pattern: /\bmarketing\b/i, values: ['Marketing', 'Advertising', 'Advertising Services', 'Marketing Services'] },
      { pattern: /\be-commerce|ecommerce\b/i, values: ['E-commerce', 'Retail'] },
      { pattern: /\bai|artificial intelligence\b/i, values: ['Artificial Intelligence'] },
      { pattern: /\breal estate\b/i, values: ['Real Estate'] },
      { pattern: /\bvc|venture capital\b/i, values: ['Venture Capital'] },
      { pattern: /\bconsulting\b/i, values: ['Consulting'] },
      { pattern: /\bmanufacturing\b/i, values: ['Manufacturing'] },
    ]

    const extractedIndustries: string[] = []
    for (const { pattern, values } of industryPatterns) {
      if (queryLower.match(pattern)) {
        values.forEach(v => {
          if (!extractedIndustries.includes(v)) extractedIndustries.push(v)
        })
      }
    }
    if (extractedIndustries.length > 0) {
      extractedFilters.industry = extractedIndustries
    }

    // 3. Extract company type
    if (/\bb2b\b/i.test(queryLower)) {
      extractedFilters.company_type = ['B2B']
    } else if (/\bb2c\b/i.test(queryLower)) {
      extractedFilters.company_type = ['B2C']
    }

    // 4. Extract company size
    const sizePatterns = [
      { pattern: /(\d+)\s*-\s*(\d+)/i, range: true },
      { pattern: /(\d+)\s+to\s+(\d+)/i, range: true },
      { pattern: /\b(small|startup)\b/i, values: ['1-50'] },
      { pattern: /\b(mid-size|medium)\b/i, values: ['51-200', '201-500'] },
      { pattern: /\b(large|enterprise)\b/i, values: ['501-1000', '1001-5000', '5001+'] },
    ]

    for (const { pattern, range, values } of sizePatterns as any[]) {
      const match = queryLower.match(pattern)
      if (match && range) {
        extractedFilters.company_size = [`${match[1]}-${match[2]}`]
        break
      } else if (match && values) {
        extractedFilters.company_size = values
        break
      }
    }

    // 5. Extract Job Titles (for prospect searches)
    const titleKeywords = [
      'marketing', 'sales', 'ceo', 'cto', 'vpo', 'vp', 'executive', 'founder',
      'developer', 'engineer', 'manager', 'director', 'head of', 'product',
      'operations', 'finance', 'hr', 'recruiter', 'legal'
    ]
    const extractedTitles: string[] = []
    for (const tk of titleKeywords) {
      if (queryLower.includes(tk)) {
        extractedTitles.push(tk.charAt(0).toUpperCase() + tk.slice(1))
      }
    }
    if (extractedTitles.length > 0) {
      extractedFilters.current_title = extractedTitles
    }

    // 6. Extract keywords (Collective plural 'keywords' as expected by ExploriumService)
    const keywordList = []
    if (/\bsaas\b/i.test(queryLower)) keywordList.push('SaaS')
    if (/\bb2b\b/i.test(queryLower)) keywordList.push('B2B')
    if (/\bai\b/i.test(queryLower)) keywordList.push('AI')
    if (/\bcloud\b/i.test(queryLower)) keywordList.push('cloud')
    if (/\bfunding|raised\b/i.test(queryLower)) keywordList.push('funding')

    // Also check for common persona keywords if it's discovery
    const discoveryKeywords = ['digital agency', 'digital agencies', 'software', 'platform', 'marketplace', 'fintech']
    for (const dk of discoveryKeywords) {
      if (queryLower.includes(dk) && !keywordList.includes(dk)) {
        keywordList.push(dk)
      }
    }

    if (keywordList.length > 0) {
      extractedFilters.keywords = keywordList
    }

    return extractedFilters
  }

  const handleClarifyFilters = async () => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    setHasSearched(false)
    setResults([])
    setTamPreview({ count: 0, cost: 0 })
    setClarification("")
    setWorkflowSteps([])
    setQueryRelevant(true)
    setQueryReason("")
    console.log('[AI Search] Parsing query with LLM:', trimmedQuery)

    // Use LLM to extract intent + filters, with client-side as fallback
    let searchIntent: "business" | "prospect" = detectIntent(trimmedQuery)
    let extractedFilters = extractFiltersFromQuery(trimmedQuery)

    try {
      const parseRes = await fetch(`${API}/api/chat/parse-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery })
      })
      if (parseRes.ok) {
        const parsed = await parseRes.json()
        console.log('[AI Search] LLM parsed:', parsed)
        // Use LLM results
        searchIntent = parsed.intent === "company" ? "business" : "prospect"
        const llmFilters = parsed.filters || {}
        // Merge LLM filters (prefer LLM, keep any client-side extras)
        extractedFilters = {
          ...extractedFilters,
          ...Object.fromEntries(
            Object.entries(llmFilters).filter(([_, v]) => Array.isArray(v) && (v as any[]).length > 0)
          )
        }
        if (!parsed.is_relevant) {
          setQueryRelevant(false)
          setQueryReason(parsed.reason || "Query may not be relevant to B2B search.")
        }
      } else {
        console.warn('[AI Search] LLM parse failed, using client-side fallback')
      }
    } catch (e) {
      console.warn('[AI Search] LLM parse error, using client-side fallback:', e)
    }

    setIntent(searchIntent)
    setLatestExtractedFilters(extractedFilters)

    const clarificationMessage = generateClarificationMessage(trimmedQuery, searchIntent, extractedFilters)
    setClarification(clarificationMessage)

    const now = new Date().toISOString()
    const baseSession = chats.find((c) => c.id === activeChatId) || createEmptySession()
    const nextSession: ChatSession = {
      ...baseSession,
      query: trimmedQuery,
      intent: searchIntent,
      clarification: clarificationMessage,
      extractedFilters: extractedFilters,
      clarificationStep: "clarifying",
      updatedAt: now,
      messages: [
        ...baseSession.messages,
        { role: "user", content: trimmedQuery, createdAt: now },
        { role: "assistant", content: clarificationMessage, createdAt: now }
      ]
    }

    setActiveChatId(nextSession.id)
    setChats((prev) => {
      const exists = prev.some((c) => c.id === nextSession.id)
      const merged = exists
        ? prev.map((c) => (c.id === nextSession.id ? nextSession : c))
        : [nextSession, ...prev]
      return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    })

    const examples = buildExamples(trimmedQuery)
    setWorkflowSteps([
      { title: "Categorizing Intent", tool: "LLM (Claude)", endpoint: "/api/chat/parse-query", input: { query: trimmedQuery }, output: { intent: searchIntent, extracted_filters: extractedFilters } },
      { title: "Filter Clarification", tool: "Filter Parser", endpoint: "client-side", input: { query: trimmedQuery, filters: extractedFilters }, output: { clarification_message: clarificationMessage, user_confirmation_required: true } },
    ])

    setIsSearching(false)
  }

  const handleConfirmFilters = async () => {
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    try {
      setClarification("Starting search with your confirmed filters...")
      const currentIntent = detectIntent(trimmedQuery)

      // Use shared extraction logic
      const extractedFilters = extractFiltersFromQuery(trimmedQuery)
      setLatestExtractedFilters(extractedFilters)

      console.log('DEBUG: Final extractedFilters:', extractedFilters)


      // Debug: Log current filters
      console.log('=== DEBUG: handleConfirmFilters ===')
      console.log('latestExtractedFilters:', latestExtractedFilters)
      console.log('Intent:', intent)
      console.log('Query:', trimmedQuery)

      // Follow-up queries are now handled by handleNaturalSearch → handleAgentChat
      // This function only runs for confirmed new searches

      let response;

      {
        // Use different endpoints based on currentIntent
        const endpoint = currentIntent === "prospect"
          ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/prospects/search`
          : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/leads/search/companies`;

        console.log('Calling endpoint:', endpoint);
        console.log('Request body:', JSON.stringify(
          currentIntent === "prospect"
            ? { ...extractedFilters, limit: 3 }
            : { filters: extractedFilters, options: { limit: 3, page: 1, enrich: true } }
        ));

        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            currentIntent === "prospect"
              ? { ...extractedFilters, limit: 3 }
              : { filters: extractedFilters, options: { limit: 3, page: 1, enrich: true } }
          ),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search API Response:', data);
      console.log('API Response Keys:', Object.keys(data));
      console.log('Intent from API:', data.nlp_analysis?.categorized_intent || data.intent);

      let mappedResults = [];
      const searchIntent = currentIntent;
      setIntent(searchIntent);

      // Handle different response formats from different endpoints
      const rawList = searchIntent === "prospect"
        ? (data.profiles || data.results?.data || data.data || [])
        : (data.data?.companies || data.companies || data.results?.data || data.data || []);

      console.log('Raw List:', rawList);
      console.log('Raw List Length:', Array.isArray(rawList) ? rawList.length : 'Not an array');

      const totalCount = searchIntent === "prospect"
        ? (data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0))
        : (data.data?.total_count || data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0));

      const examples = buildExamples(trimmedQuery);
      setWorkflowSteps([
        {
          title: "Categorizing Filters",
          tool: "NLP Classifier",
          endpoint: "/api/explorium/search",
          input: { query: trimmedQuery },
          output: {
            intent: data.nlp_analysis?.categorized_intent || data.intent || "business",
            confidence: data.nlp_analysis?.confidence ?? data.confidence ?? 0,
            is_relevant: true,
            reason: "Query confirmed by user",
            extracted_filters: latestExtractedFilters,
          },
        },
        {
          title: "Filter Clarification",
          tool: "LLM Clarification",
          endpoint: "/api/explorium/search",
          input: { query: trimmedQuery, filters: latestExtractedFilters },
          output: {
            clarification_message: clarification,
            user_confirmation_required: true,
          },
        },
        {
          title: "Search Execution",
          tool: "Explorium Search Workflow",
          endpoint: "/api/explorium/search",
          input: { query: trimmedQuery, filters: latestExtractedFilters },
          output: {
            total_results: totalCount,
            preview_count: Math.min(Array.isArray(rawList) ? rawList.length : 0, 5),
            preview_data: (Array.isArray(rawList) ? rawList : []).slice(0, 5),
            code_examples: examples,
          },
        },
      ])

      if (searchIntent === "prospect") {
        try {
          localStorage.setItem("prospect_search_results", JSON.stringify(rawList || []))
        } catch (e) {
          console.warn("Failed to cache prospect search results", e)
        }

        const mapEmployer = (src: any): EmployerItem => ({
          name: src?.name || src?.company_name || "",
          linkedin_id: src?.linkedin_id || src?.company_linkedin_id || "",
          company_id: src?.company_id || 0,
          company_linkedin_id: src?.company_linkedin_id || "",
          company_website_domain: src?.company_website_domain || src?.company_domain || "",
          position_id: src?.position_id || 0,
          title: src?.title || "",
          description: src?.description || "",
          location: src?.location || "",
          start_date: src?.start_date || "",
          end_date: src?.end_date || undefined,
          employer_is_default: Boolean(src?.employer_is_default),
          seniority_level: src?.seniority_level || src?.seniority || "",
          function_category: src?.function_category || src?.job_function || "",
          years_at_company: src?.years_at_company || "",
          years_at_company_raw: src?.years_at_company_raw || 0,
          company_headquarters_country: src?.company_headquarters_country || "",
          company_hq_location: src?.company_hq_location || src?.headquarter || "",
          company_hq_location_address_components: Array.isArray(src?.company_hq_location_address_components)
            ? src.company_hq_location_address_components
            : [],
          company_headcount_range: src?.company_headcount_range || src?.company_size || "",
          company_industries: Array.isArray(src?.company_industries) ? src.company_industries : [],
          company_linkedin_industry: src?.company_linkedin_industry || src?.industry || "",
          company_type: src?.company_type || "",
          company_headcount_latest: src?.company_headcount_latest || src?.size || 0,
          company_website: src?.company_website || src?.website || "",
          company_linkedin_profile_url: src?.company_linkedin_profile_url || src?.linkedin_url || "",
          business_email_verified: Boolean(src?.business_email_verified),
        })

        mappedResults = (Array.isArray(rawList) ? rawList : []).map((item: any): ProspectProfile => {
          const raw = (item?.raw_data && typeof item.raw_data === "object")
            ? item.raw_data
            : ((item?.rawData && typeof item.rawData === "object") ? item.rawData : {})

          const currentEmployersArr = (Array.isArray(item.current_employers) && item.current_employers.length > 0
            ? item.current_employers
            : null) ||
            (Array.isArray(item.employer) && item.employer.length > 0 ? item.employer : null) ||
            (Array.isArray(raw.current_employers) && raw.current_employers.length > 0 ? raw.current_employers : null) ||
            (Array.isArray(raw.employer) && raw.employer.length > 0 ? raw.employer : null) ||
            []

          const currentEmployer = currentEmployersArr[0] || null

          const pastEmployersArr = (Array.isArray(item.past_employers) ? item.past_employers : null) ||
            (Array.isArray(raw.past_employers) ? raw.past_employers : null) ||
            []

          const computedYears = sumEmployerYears(
            item?.current_employers,
            item?.past_employers,
            item?.employer,
            raw?.current_employers,
            raw?.past_employers,
            raw?.employer
          )

          const emailCandidates = [
            item.work_email,
            item.email,
            item.business_email,
            item.personal_email,
            raw.work_email,
            raw.email,
            raw.business_email,
            raw.personal_email,
            Array.isArray(item.emails) ? item.emails[0] : undefined,
            Array.isArray(item.work_emails) ? item.work_emails[0] : undefined,
            Array.isArray(item.personal_emails) ? item.personal_emails[0] : undefined,
            Array.isArray(item.contact_info?.work_emails) ? item.contact_info.work_emails[0] : undefined,
            Array.isArray(item.contact_info?.emails) ? item.contact_info.emails[0] : undefined,
            Array.isArray(item.contact_info?.personal_emails) ? item.contact_info.personal_emails[0] : undefined,
            Array.isArray(raw.emails) ? raw.emails[0] : undefined,
            Array.isArray(raw.work_emails) ? raw.work_emails[0] : undefined,
            Array.isArray(raw.personal_emails) ? raw.personal_emails[0] : undefined,
          ]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)

          const email = emailCandidates.find((v) => v.includes("@")) || "";

          const cleanLoc = [
            item.region,
            item.location,
            item.location_details?.country,
            raw.region,
            raw.location,
            raw.location_details?.country,
            [item.city, item.country_name].filter(Boolean).join(", "),
            [raw.city, raw.country_name].filter(Boolean).join(", "),
          ].filter((s) => typeof s === "string" && s.trim().length > 0)[0] || "N/A";

          return {
            person_id: Number(item.person_id || item.prospect_id || raw.person_id || 0),
            name: item.full_name || item.name || raw.full_name || raw.name || `${item.first_name || raw.first_name || ""} ${item.last_name || raw.last_name || ""}`.trim() || "Unknown",
            first_name: item.first_name || raw.first_name || "",
            last_name: item.last_name || raw.last_name || "",
            region: typeof item.region === "string" ? item.region : (typeof item.location === "string" ? item.location : ""),
            region_address_components: Array.isArray(item.region_address_components) ? item.region_address_components : [],
            headline: item.headline || item.title || raw.headline || raw.title || currentEmployer?.title || "N/A",
            summary: item.summary || raw.summary || "",
            skills: Array.isArray(item.skills) ? item.skills : (Array.isArray(raw.skills) ? raw.skills : []),
            languages: Array.isArray(item.languages) ? item.languages : (Array.isArray(raw.languages) ? raw.languages : []),
            linkedin_profile_url: item.linkedin_profile_url || item.flagship_profile_url || item.linkedin_url || raw.linkedin_profile_url || raw.flagship_profile_url || raw.linkedin_url || "",
            flagship_profile_url: item.flagship_profile_url || item.linkedin_profile_url || item.linkedin_url || raw.flagship_profile_url || raw.linkedin_profile_url || raw.linkedin_url || "",
            emails: email ? [email] : [],
            profile_picture_url: item.profile_picture_url || raw.profile_picture_url || "",
            profile_picture_permalink: item.profile_picture_permalink || raw.profile_picture_permalink || "",
            twitter_handle: item.twitter_handle || raw.twitter_handle || "",
            num_of_connections: parseConnectionCount(
              item.num_of_connections,
              item.connections,
              item.connection_count,
              item.linkedin_connections,
              raw.num_of_connections,
              raw.connections,
              raw.connection_count,
              raw.linkedin_connections
            ),
            education_background: Array.isArray(item.education_background) ? item.education_background : [],
            honors: Array.isArray(item.honors) ? item.honors : [],
            certifications: Array.isArray(item.certifications) ? item.certifications : [],
            current_employers: currentEmployersArr.map(mapEmployer),
            past_employers: pastEmployersArr.map(mapEmployer),
            last_updated: item.last_updated || item.updated_at || raw.last_updated || raw.updated_at || "",
            recently_changed_jobs: Boolean(item.recently_changed_jobs),
            years_of_experience: formatYearsExperience(
              item.years_of_experience || raw.years_of_experience,
              item.years_of_experience_raw ??
              raw.years_of_experience_raw ??
              item.experience_years ??
              raw.experience_years ??
              item.total_experience_years ??
              raw.total_experience_years ??
              computedYears,
              Array.isArray(item.experience) ? item.experience : (Array.isArray(raw.experience) ? raw.experience : [])
            ),
            years_of_experience_raw: Number(
              item.years_of_experience_raw ??
              raw.years_of_experience_raw ??
              item.experience_years ??
              raw.experience_years ??
              item.total_experience_years ??
              raw.total_experience_years ??
              computedYears ??
              0
            ),
            all_employers: Array.isArray(item.all_employers)
              ? item.all_employers.map(mapEmployer)
              : [...currentEmployersArr, ...pastEmployersArr].map(mapEmployer),
            updated_at: item.updated_at || raw.updated_at || "",
            location_details: {
              city: item.location_details?.city || raw.location_details?.city || "",
              state: item.location_details?.state || raw.location_details?.state || "",
              country: item.location_details?.country || raw.location_details?.country || cleanLoc || "N/A",
              continent: item.location_details?.continent || raw.location_details?.continent || "",
            },
          };
        });
      } else {
        console.log('=== COMPANY MAPPING START ===');
        console.log('Raw list length:', rawList.length);
        console.log('First raw item:', rawList[0]);
        mappedResults = mapCompanyResults(rawList)
        console.log('Companies mapped results:', mappedResults.length);
        console.log('First mapped result:', mappedResults[0]);
        console.log('=== COMPANY MAPPING END ===');
      }

      console.log('Final mappedResults length:', mappedResults.length);
      setResults(mappedResults);
      setHasSearched(true);
      console.log('Setting results - Intent:', searchIntent, 'Results count:', mappedResults.length);

      // Auto-detect signals if query is about personalization/signals
      const queryLowerAuto = trimmedQuery.toLowerCase();
      const signalKeywords = ['signal', 'signals', 'personalize', 'personalization', 'outreach', 'recent activity', 'context'];
      const shouldAutoDetectSignals = signalKeywords.some(keyword => queryLowerAuto.includes(keyword));

      if (shouldAutoDetectSignals && mappedResults.length > 0) {
        setTimeout(() => {
          handleDetectSignals(mappedResults, searchIntent);
        }, 500);
      }

      // Generate context-aware suggested prompts based on current search
      const suggestions: string[] = []
      const industry = extractedFilters?.industry?.[0] || ""
      const location = extractedFilters?.location?.[0] || ""
      const resultCount = mappedResults.length

      if (searchIntent === "business") {
        if (industry) {
          suggestions.push(`Find decision makers at ${industry} companies${location ? ` in ${location}` : ""} with recent funding`)
          suggestions.push(`Get recent news and signals for these ${resultCount} ${industry} companies`)
        }
        suggestions.push(`Find similar companies to the ones found`)
        suggestions.push(`Enrich the found companies with technographic data`)
      } else {
        if (industry) {
          suggestions.push(`Find more ${industry} decision makers who recently changed jobs`)
          suggestions.push(`Get contact information for these ${resultCount} ${industry} leaders`)
        }
        suggestions.push(`Find prospects with AI expertise in the same industry`)
        suggestions.push(`Search for prospects who posted on LinkedIn recently`)
      }
      suggestions.push(`Detect signals for personalized outreach`)
      suggestions.push(`Create an email campaign for these leads`)

      setSuggestedPrompts(suggestions)

      const nextTamPreview = {
        count: totalCount,
        cost: mappedResults.length * 0.1,
      }
      setTamPreview(nextTamPreview);

      const now = new Date().toISOString()
      const baseSession = chats.find((c) => c.id === activeChatId) || createEmptySession()
      const nextSession: ChatSession = {
        ...baseSession,
        results: mappedResults,
        tamPreview: nextTamPreview,
        clarificationStep: "completed",
        hasSearched: true,
        updatedAt: now,
        suggestedPrompts: suggestions,
        messages: [
          ...baseSession.messages,
          { role: "user", content: "Confirm filters", createdAt: now },
          { role: "assistant", content: `Found ${totalCount} ${searchIntent === "prospect" ? "prospects" : "companies"} for "${trimmedQuery}".`, createdAt: now }
        ]
      }

      setActiveChatId(nextSession.id)
      setChats((prev) => {
        const exists = prev.some((c) => c.id === nextSession.id)
        const merged = exists
          ? prev.map((c) => (c.id === nextSession.id ? nextSession : c))
          : [nextSession, ...prev]
        return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      })
    } catch (e) {
      console.error("Search failed:", e)
      setClarification(`Search failed: ${e instanceof Error ? e.message : String(e)}. Please try again or refine your query.`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleAgentChat = async () => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    // Add user message to agent messages
    const userMsg: {role: "user" | "assistant", content: string} = { role: "user", content: trimmedQuery }
    const updatedMessages = [...agentMessages, userMsg]
    setAgentMessages(updatedMessages)
    setNaturalLanguageQuery("") // clear input
    setIsAgentResponding(true)

    try {
      // Build context from current session
      const sessionResults = results.length > 0 ? results : (chats.find(c => c.id === activeChatId)?.results || [])
      const context = {
        intent,
        query: chats.find(c => c.id === activeChatId)?.query || trimmedQuery,
        results: sessionResults.slice(0, 10),
        signals: detectedSignals.slice(0, 10),
        filters: latestExtractedFilters || {}
      }

      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, context })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `Agent error: ${res.status}`)
      }

      const data = await res.json()

      // Add assistant reply
      const assistantMsg: {role: "user" | "assistant", content: string} = { role: "assistant", content: data.reply }
      setAgentMessages(prev => [...prev, assistantMsg])

      // Persist to chat session
      persistCurrentChat({ userPrompt: trimmedQuery, assistantMessage: data.reply })

      // Handle actions returned by the agent
      if (data.action === "new_search") {
        setNaturalLanguageQuery(data.action_data?.query || trimmedQuery)
        setTimeout(() => handleClarifyFilters(), 100)
      } else if (data.action === "detect_signals") {
        const sessionResults2 = results.length > 0 ? results : (chats.find(c => c.id === activeChatId)?.results || [])
        handleDetectSignals(sessionResults2, intent)
      } else if (data.action === "generate_campaign") {
        handleGenerateCampaign()
      }
    } catch (e: any) {
      console.error("Agent chat error:", e)
      const errorMsg: {role: "user" | "assistant", content: string} = { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
      setAgentMessages(prev => [...prev, errorMsg])
    } finally {
      setIsAgentResponding(false)
    }
  }

  const handleNaturalSearch = async () => {
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    // If we already have results in this session → send to conversational agent
    const hasResults = results.length > 0 || (chats.find(c => c.id === activeChatId)?.results?.length || 0) > 0
    if (hasResults && hasSearched) {
      await handleAgentChat()
      return
    }

    // Otherwise → existing clarify-then-search flow
    await handleClarifyFilters()
  }

  /**
   * Agentic suggested prompt handler.
   * Classifies the prompt and executes the right action using the current session context.
   */
  const handleSuggestedPrompt = async (prompt: string) => {
    const lower = prompt.toLowerCase()

    // Get session context
    const sessionResults = chats.find(c => c.id === activeChatId)?.results || []
    const currentResults = results.length > 0 ? results : sessionResults
    const currentIntent = intent
    const currentFilters = latestExtractedFilters
    const industry = currentFilters?.industry?.[0] || ""
    const location = currentFilters?.location?.[0] || ""

    // --- CATEGORY 1: Signal detection ---
    const isSignalPrompt = lower.includes('signal') || lower.includes('personalized outreach')
    if (isSignalPrompt) {
      handleDetectSignals(currentResults, currentIntent)
      return
    }

    // --- CATEGORY 2: Email campaign generation ---
    const isEmailCampaign = lower.includes('email campaign') || lower.includes('email') || lower.includes('campaign')
    if (isEmailCampaign) {
      if (currentResults.length === 0) {
        setClarification("No results found to create a campaign for. Please run a search first.")
        return
      }
      console.log("CAMPAIGN: Triggering campaign generation with", currentResults.length, "results")
      await handleGenerateCampaign()
      return
    }

    // --- CATEGORY 3: Enrichment / technographic data ---
    const isEnrichment = lower.includes('enrich') || lower.includes('technograph') || lower.includes('technology') || lower.includes('tech stack')
    if (isEnrichment) {
      if (currentResults.length === 0) {
        setClarification("No results to enrich. Please run a search first.")
        return
      }
      setClarification(`Enriching ${currentResults.length} ${currentIntent === "prospect" ? "prospects" : "companies"} with technographic data... This will use the Explorium enrichment API.`)
      // Trigger signal detection which includes technographic enrichment
      handleDetectSignals(currentResults, currentIntent)
      return
    }

    // --- CATEGORY 4+5+FALLBACK: Route through conversational agent ---
    // For any other prompt (similar search, refined search, or freeform), send to the agent
    // The agent will decide whether to answer conversationally or trigger a new search action
    setNaturalLanguageQuery(prompt)
    setSuggestedPrompts([])
    if (currentResults.length > 0) {
      // Use agent for contextual conversation
      setTimeout(() => handleAgentChat(), 100)
    } else {
      // No results yet, fall back to search flow
      setTimeout(() => handleClarifyFilters(), 100)
    }
  }

  const handleDetectSignals = async (passedResults?: any[], passedIntent?: "business" | "prospect") => {
    // Use passed results, or fall back to state results, or fall back to active chat session results
    const sessionResults = chats.find(c => c.id === activeChatId)?.results || []
    const resultsToUse = (passedResults && passedResults.length > 0)
      ? passedResults
      : (results.length > 0 ? results : sessionResults)
    const intentToUse = passedIntent || intent

    if (resultsToUse.length === 0) {
      setClarification("No search results found to analyze. Please run a search first, then I can detect signals for personalized outreach.")
      return
    }

    if (isDetectingSignals) return

    setIsDetectingSignals(true)
    setShowSignals(true)
    setClarification(`Detecting ${intentToUse === "prospect" ? "person-level" : "company-level"} signals for ${resultsToUse.length} ${intentToUse === "prospect" ? "prospects" : "companies"}...`)

    try {
      // Prepare data for signal detection
      let dataToSend: any = {}

      if (intentToUse === "prospect") {
        // For prospects, send PERSON data to Crustdata for person-level signals
        dataToSend = {
          companies: resultsToUse.map((prospect: any) => {
            const currentEmployer = prospect.current_employers?.[0] || prospect.employer?.[0] || {}
            // Include person data for Crustdata to detect person signals
            return {
              // Person data (for Crustdata signals)
              name: prospect.name || prospect.full_name || "",
              full_name: prospect.name || prospect.full_name || "",
              first_name: prospect.first_name || "",
              last_name: prospect.last_name || "",
              linkedin_url: prospect.linkedin_profile_url || prospect.flagship_profile_url || "",
              email: prospect.emails?.[0] || prospect.email || "",
              job_title: currentEmployer.title || prospect.headline || "",
              // Company data (for context)
              company_name: currentEmployer.name || "",
              company_domain: currentEmployer.company_website_domain || currentEmployer.company_domain || "",
              industry: currentEmployer.company_linkedin_industry || "",
              employee_count_range: currentEmployer.company_headcount_range || "",
              employee_count_exact: currentEmployer.company_headcount_latest || 0,
              funding_stage: "",
              funding_total: 0,
              technologies: [],
              employee_growth_6m_percent: 0,
              employee_growth_12m_percent: 0,
              job_openings_count: 0,
            }
          }),
          prospect_query: naturalLanguageQuery,
          // Use Crustdata + ContactOut for prospect signals
          data_source: ["crustdata", "contactout"]
        }
      } else {
        // For companies, send COMPANY data to Explorium + ContactOut for company-level signals
        dataToSend = {
          companies: resultsToUse.map((company: any) => ({
            name: company.name,
            domain: company.domain,
            industry: company.industry,
            employee_count_range: company.employee_count_range,
            employee_count_exact: company.employee_count_exact,
            funding_stage: company.funding_stage,
            funding_total: company.funding_total,
            technologies: company.technologies,
            employee_growth_6m_percent: company.employee_growth_6m_percent,
            employee_growth_12m_percent: company.employee_growth_12m_percent,
            job_openings_count: company.job_openings_count,
          })),
          prospect_query: naturalLanguageQuery,
          // Use Explorium + ContactOut for company signals
          data_source: ["explorium", "contactout"]
        }
      }

      console.log("Sending for signal detection:", JSON.stringify(dataToSend, null, 2))

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/signals/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        console.error("Signal detection API error:", errText)
        setClarification(`Signal detection failed: ${response.status} ${response.statusText}. Please try again.`)
        setDetectedSignals([])
        return
      }

      const data = await response.json()
      console.log("Signals response:", data)
      const signals = data.signals || []
      setDetectedSignals(signals)

      if (signals.length === 0) {
        setClarification("Signal detection completed but no signals were found for these results.")
      } else {
        setClarification(`Found ${signals.length} signal${signals.length === 1 ? "" : "s"} for personalized outreach. See the Detected Signals section below.`)
      }

    } catch (error) {
      console.error("Signal detection error:", error)
      setClarification(`Signal detection failed: ${error instanceof Error ? error.message : String(error)}. Please try again.`)
      setDetectedSignals([])
    } finally {
      setIsDetectingSignals(false)
    }
  }

  // Wrapper function for button onClick (no parameters)
  const onDetectSignalsClick = () => {
    handleDetectSignals()
  }

  const handleGenerateCampaign = async () => {
    const sessionResults = chats.find(c => c.id === activeChatId)?.results || []
    const currentResults = results.length > 0 ? results : sessionResults
    const currentIntent = intent

    console.log("CAMPAIGN: handleGenerateCampaign called, results:", currentResults.length, "signals:", detectedSignals.length)

    if (currentResults.length === 0) {
      setClarification("No results found to create a campaign for. Please run a search first.")
      return
    }

    setIsGeneratingCampaign(true)
    setCampaignDraft(null)
    setCampaignApproved(false)
    setSelectedRecipients(new Set())
    setSentRecipients({})
    setClarification("Preparing campaign draft... This may take a moment.")

    try {
      // If no signals detected yet, detect them inline and capture the result
      let signalsToUse = detectedSignals
      if (signalsToUse.length === 0) {
        setClarification("Detecting signals first for personalized outreach...")
        setShowSignals(true)

        // Build signal detection payload (same logic as handleDetectSignals)
        let signalPayload: any = {}
        if (currentIntent === "prospect") {
          signalPayload = {
            companies: currentResults.map((prospect: any) => {
              const currentEmployer = prospect.current_employers?.[0] || prospect.employer?.[0] || {}
              return {
                name: prospect.name || prospect.full_name || "",
                full_name: prospect.name || prospect.full_name || "",
                first_name: prospect.first_name || "",
                last_name: prospect.last_name || "",
                linkedin_url: prospect.linkedin_profile_url || prospect.flagship_profile_url || "",
                email: prospect.emails?.[0] || prospect.email || "",
                job_title: currentEmployer.title || prospect.headline || "",
                company_name: currentEmployer.name || "",
                company_domain: currentEmployer.company_website_domain || currentEmployer.company_domain || "",
                industry: currentEmployer.company_linkedin_industry || "",
                employee_count_range: currentEmployer.company_headcount_range || "",
                employee_count_exact: currentEmployer.company_headcount_latest || 0,
                funding_stage: "",
                funding_total: 0,
                technologies: [],
                employee_growth_6m_percent: 0,
                employee_growth_12m_percent: 0,
                job_openings_count: 0,
              }
            }),
            prospect_query: naturalLanguageQuery,
            data_source: ["crustdata", "contactout"]
          }
        } else {
          signalPayload = {
            companies: currentResults.map((company: any) => ({
              name: company.name,
              domain: company.domain,
              industry: company.industry,
              employee_count_range: company.employee_count_range,
              employee_count_exact: company.employee_count_exact,
              funding_stage: company.funding_stage,
              funding_total: company.funding_total,
              technologies: company.technologies,
              employee_growth_6m_percent: company.employee_growth_6m_percent,
              employee_growth_12m_percent: company.employee_growth_12m_percent,
              job_openings_count: company.job_openings_count,
            })),
            prospect_query: naturalLanguageQuery,
            data_source: ["explorium", "contactout"]
          }
        }

        try {
          const signalResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/signals/detect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signalPayload),
          })

          if (signalResponse.ok) {
            const signalData = await signalResponse.json()
            signalsToUse = signalData.signals || []
            setDetectedSignals(signalsToUse)
          } else {
            console.warn("Signal detection failed, proceeding with empty signals")
          }
        } catch (signalErr) {
          console.warn("Signal detection network error, proceeding with empty signals:", signalErr)
        }
      }

      setClarification("Generating personalized campaign draft based on signals...")

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/campaigns/generate-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: currentResults.slice(0, 10),
          signals: signalsToUse,
          intent: currentIntent,
          context: naturalLanguageQuery,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        console.error("Campaign draft API error:", errText)
        setClarification(`Campaign draft generation failed: ${response.status} ${response.statusText}. Please try again.`)
        return
      }

      const data = await response.json()
      setCampaignDraft(data)
      setClarification("Campaign draft generated! Review your personalized email and LinkedIn message below.")
    } catch (error) {
      console.error("Campaign draft error:", error)
      setClarification(`Campaign draft generation failed: ${error instanceof Error ? error.message : String(error)}. Please try again.`)
    } finally {
      setIsGeneratingCampaign(false)
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) return

    let csvContent = ""
    let headers: string[] = []
    let rows: string[][] = []

    if (intent === "prospect") {
      // Prospect CSV headers
      headers = [
        "Name",
        "Email",
        "Phone",
        "LinkedIn URL",
        "Current Title",
        "Current Company",
        "Company Industry",
        "Location",
        "Connections",
        "Years of Experience",
        "Headline",
        "Skills",
      ]

      // Prospect CSV rows
      rows = results.map((prospect: any) => {
        const currentEmployer = prospect.current_employers?.[0] || prospect.employer?.[0]
        const emails = Array.isArray(prospect.emails) ? prospect.emails.join("; ") : prospect.email || ""
        const phones = Array.isArray(prospect.phones) ? prospect.phones.join("; ") : prospect.phone || ""
        const skills = Array.isArray(prospect.skills) ? prospect.skills.slice(0, 5).join("; ") : ""

        return [
          prospect.name || "",
          emails,
          phones,
          prospect.flagship_profile_url || prospect.linkedin_profile_url || "",
          currentEmployer?.title || "",
          currentEmployer?.name || "",
          currentEmployer?.company_linkedin_industry || "",
          prospect.location_details?.country || prospect.region || "",
          String(prospect.num_of_connections || 0),
          prospect.years_of_experience || "",
          prospect.headline || "",
          skills,
        ]
      })
    } else {
      // Company CSV headers
      headers = [
        "Company Name",
        "Domain",
        "Website",
        "Industry",
        "Location",
        "Employee Count",
        "Revenue",
        "Founded Year",
        "Company Type",
        "Funding Stage",
        "Total Funding",
        "LinkedIn URL",
        "Technologies",
        "Description",
      ]

      // Company CSV rows
      rows = results.map((company: any) => {
        const location = [
          company.headquarters_city,
          company.headquarters_state,
          company.headquarters_country,
        ]
          .filter(Boolean)
          .join(", ")

        const technologies = Array.isArray(company.technologies)
          ? company.technologies.slice(0, 5).join("; ")
          : ""

        return [
          company.name || "",
          company.domain || "",
          company.website || "",
          company.industry || "",
          location || company.location_display || "",
          company.employee_count_range || String(company.employee_count_exact || ""),
          company.revenue_range || String(company.revenue_exact || ""),
          String(company.founded_year || ""),
          company.company_type || "",
          company.funding_stage || "",
          String(company.funding_total || ""),
          company.linkedin_url || "",
          technologies,
          (company.description || "").replace(/"/g, '""').substring(0, 200),
        ]
      })
    }

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Build CSV content
    csvContent = headers.map(escapeCSV).join(",") + "\n"
    csvContent += rows.map((row) => row.map(escapeCSV).join(",")).join("\n")

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `${intent === "prospect" ? "prospects" : "companies"}_export_${new Date().toISOString().split("T")[0]}.csv`
    )
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            AI-Powered Search
          </CardTitle>
          <CardDescription>
            Use natural language to find companies and prospects, discover signals, and build targeted lists.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Workspace</CardTitle>
              <Button onClick={startNewChat} size="sm" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                New Chat
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={activePanel === "chats" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setActivePanel("chats")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chats
                </Button>
                <Button
                  variant={activePanel === "library" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setActivePanel("library")}
                >
                  <Library className="mr-2 h-4 w-4" />
                  Prompt Library
                </Button>
              </div>

              {activePanel === "chats" ? (
                <div className="space-y-2">
                  {chats.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      No previous chats yet.
                    </p>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => openChat(chat.id)}
                        className={`w-full rounded-md border p-2 text-left text-sm transition ${activeChatId === chat.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                          }`}
                      >
                        <div className="font-medium">{chat.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(chat.updatedAt).toLocaleString()}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(["All", "Build Lead Lists", "Find Contact Info", "Personalize Your Outreach", "Meeting Prep", "Recruiting"] as const).map((item) => (
                      <Badge
                        key={item}
                        variant={selectedUseCase === item ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedUseCase(item)}
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>

                  {PROMPT_LIBRARY.filter((p) => selectedUseCase === "All" || p.useCase === selectedUseCase).map((prompt) => (
                    <Card key={prompt.id}>
                      <CardHeader className="p-3">
                        <Badge variant="secondary" className="mb-2 w-fit">
                          {prompt.useCase}
                        </Badge>
                        <CardTitle className="text-sm">{prompt.title}</CardTitle>
                        <CardDescription className="text-xs">{prompt.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-2 p-3 pt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setNaturalLanguageQuery(prompt.prompt)}
                        >
                          Use Prompt
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(prompt.prompt)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {hasSearched && results.length > 0 ? (
                  <><MessageSquare className="h-5 w-5" /> Chat with Your Results</>
                ) : (
                  <><Sparkles className="h-5 w-5" /> Describe Your Search</>
                )}
              </CardTitle>
              <CardDescription>
                {hasSearched && results.length > 0
                  ? "Ask questions about your results, request actions, or start a new search"
                  : "Tell us what you're looking for in plain English"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                ref={queryInputRef}
                placeholder={hasSearched && results.length > 0
                  ? "Ask about your results, refine your search, or request an action..."
                  : "e.g., Find marketing decision makers at digital agencies with 1-50 employees in Texas"}
                value={naturalLanguageQuery}
                onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleNaturalSearch()
                  }
                }}
                rows={2}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleNaturalSearch}
                  disabled={isSearching || isAgentResponding || !naturalLanguageQuery.trim()}
                  className="flex-1"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : isAgentResponding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Thinking...
                    </>
                  ) : hasSearched && results.length > 0 ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze Query
                    </>
                  )}
                </Button>
              </div>

              {clarification && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Filter Clarification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-sm">{clarification}</p>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={handleConfirmFilters} disabled={isSearching} size="sm">
                        {isSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          "Confirm & Search"
                        )}
                      </Button>
                      <Button onClick={handleRefineSearch} variant="outline" size="sm">
                        Modify Query
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Campaign Draft Loading */}
          {isGeneratingCampaign && (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
                <p className="font-medium">Generating Campaign Draft...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating personalized outreach messages based on detected signals
                </p>
              </CardContent>
            </Card>
          )}

          {/* Campaign Draft Card */}
          {campaignDraft && !isGeneratingCampaign && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Campaign Draft
                      {campaignApproved && (
                        <Badge variant="default" className="ml-2 bg-green-600 text-xs">Approved</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {campaignApproved
                        ? "Send personalized messages directly to recipients"
                        : "Review the draft, connect accounts, then approve to send"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGenerateCampaign} disabled={isGeneratingCampaign}>
                    Regenerate
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Draft */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Email Draft
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-semibold">Subject:</span> {campaignDraft.subject}
                    </p>
                    <div className="border-t pt-2">
                      <p className="text-sm whitespace-pre-line">{campaignDraft.email_body}</p>
                    </div>
                  </div>
                </div>

                {/* LinkedIn Message */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> LinkedIn Message
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm whitespace-pre-line">{campaignDraft.linkedin_message}</p>
                  </div>
                </div>

                {/* Connection Status & Approval */}
                {!campaignApproved && (
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
                    <p className="text-sm font-medium">Connect your accounts, then approve to send directly</p>

                    {/* Gmail Connection */}
                    <div className="flex items-center justify-between p-3 rounded border bg-background">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">Gmail</p>
                          {gmailConnected ? (
                            <p className="text-xs text-green-600">Connected as {gmailEmail}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Send emails directly from your Gmail</p>
                          )}
                        </div>
                      </div>
                      {gmailConnected ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={handleConnectGmail}>
                          Connect Gmail
                        </Button>
                      )}
                    </div>

                    {/* LinkedIn Connection */}
                    <div className="flex items-center justify-between p-3 rounded border bg-background">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">LinkedIn (Unipile)</p>
                          {linkedinConnected ? (
                            <p className="text-xs text-green-600">Connected via Unipile</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Send LinkedIn messages directly</p>
                          )}
                        </div>
                      </div>
                      {linkedinConnected ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                          Not configured
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setCampaignApproved(true)
                          const allIdxs = new Set(campaignDraft.recipients.map((_: any, i: number) => i))
                          setSelectedRecipients(allIdxs)
                          setSendErrors({})
                          setClarification("Campaign approved! Click Send buttons next to each recipient to deliver messages directly.")
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve & Send
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleGenerateCampaign}>
                        Revise Draft
                      </Button>
                    </div>
                  </div>
                )}

                {/* Recipients Table */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Recipients ({campaignDraft.recipients.length})
                    {campaignApproved && Object.keys(sentRecipients).length > 0 && (
                      <span className="text-xs text-green-600 ml-2">
                        {Object.keys(sentRecipients).length} / {campaignDraft.recipients.length} sent
                      </span>
                    )}
                  </h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {campaignApproved && (
                            <th className="text-center p-2 w-8">
                              <input
                                type="checkbox"
                                checked={selectedRecipients.size === campaignDraft.recipients.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRecipients(new Set(campaignDraft.recipients.map((_: any, i: number) => i)))
                                  } else {
                                    setSelectedRecipients(new Set())
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                          )}
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Title</th>
                          <th className="text-left p-2 font-medium">Company</th>
                          <th className="text-left p-2 font-medium">
                            {campaignApproved ? "Send" : "Channels"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignDraft.recipients.map((r: any, idx: number) => {
                          const firstName = r.first_name || r.name?.split(" ")[0] || "there"
                          const companyName = r.company || r.domain || "your company"
                          const personalizedBody = campaignDraft.email_body
                            .replace(/\{\{firstName\}\}/g, firstName)
                            .replace(/\{\{companyName\}\}/g, companyName)
                          const personalizedSubject = campaignDraft.subject
                            .replace(/\{\{firstName\}\}/g, firstName)
                            .replace(/\{\{companyName\}\}/g, companyName)
                          const personalizedLinkedIn = campaignDraft.linkedin_message
                            .replace(/\{\{firstName\}\}/g, firstName)
                            .replace(/\{\{companyName\}\}/g, companyName)

                          const sent = sentRecipients[idx]
                          const sending = sendingRecipients[idx]
                          const error = sendErrors[idx]

                          return (
                            <tr key={idx} className={`border-b last:border-b-0 ${sent ? "bg-green-50 dark:bg-green-900/10" : error ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                              {campaignApproved && (
                                <td className="text-center p-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedRecipients.has(idx)}
                                    onChange={(e) => {
                                      const next = new Set(selectedRecipients)
                                      if (e.target.checked) next.add(idx)
                                      else next.delete(idx)
                                      setSelectedRecipients(next)
                                    }}
                                    className="rounded"
                                  />
                                </td>
                              )}
                              <td className="p-2">
                                <div className="flex items-center gap-1.5">
                                  {sent && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                                  {r.name || "Unknown"}
                                </div>
                              </td>
                              <td className="p-2 text-muted-foreground">{r.job_title || r.industry || "N/A"}</td>
                              <td className="p-2 text-muted-foreground">{r.company || r.domain || "N/A"}</td>
                              <td className="p-2">
                                {campaignApproved ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      {/* Email send */}
                                      {sent === "email" || sent === "both" ? (
                                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                                          <Check className="h-3 w-3 mr-1" /> Email sent
                                        </Badge>
                                      ) : sending === "email" ? (
                                        <Badge variant="outline" className="text-xs">
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending...
                                        </Badge>
                                      ) : (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          disabled={!r.email || !gmailConnected || !!sending}
                                          title={!gmailConnected ? "Connect Gmail first" : !r.email ? "No email available" : `Send to ${r.email}`}
                                          onClick={() => handleSendEmail(idx, r.email, personalizedSubject, personalizedBody)}
                                        >
                                          <Send className="h-3 w-3 mr-1" />
                                          Send Email
                                        </Button>
                                      )}
                                      {/* LinkedIn send */}
                                      {sent === "linkedin" || sent === "both" ? (
                                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                                          <Check className="h-3 w-3 mr-1" /> LinkedIn sent
                                        </Badge>
                                      ) : sending === "linkedin" ? (
                                        <Badge variant="outline" className="text-xs">
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending...
                                        </Badge>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          disabled={!r.linkedin_url || !linkedinConnected || !!sending}
                                          title={!linkedinConnected ? "LinkedIn not connected" : !r.linkedin_url ? "No LinkedIn URL" : "Send via LinkedIn"}
                                          onClick={() => handleSendLinkedIn(idx, r.linkedin_url, personalizedLinkedIn)}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Send LinkedIn
                                        </Button>
                                      )}
                                      {/* Copy fallback */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        title="Copy personalized email"
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            `Subject: ${personalizedSubject}\n\n${personalizedBody}`
                                          )
                                          setClarification(`Copied personalized email for ${r.name || "recipient"} to clipboard.`)
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {error && (
                                      <p className="text-xs text-red-500">{error}</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    {r.email && <Badge variant="outline" className="text-xs">Email</Badge>}
                                    {r.linkedin_url && <Badge variant="outline" className="text-xs">LinkedIn</Badge>}
                                    {!r.email && !r.linkedin_url && <span>No contact info</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bulk Send Actions */}
                {campaignApproved && selectedRecipients.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!gmailConnected}
                      onClick={async () => {
                        let count = 0
                        for (const idx of Array.from(selectedRecipients)) {
                          const r = campaignDraft.recipients[idx]
                          if (!r?.email || sentRecipients[idx] === "email" || sentRecipients[idx] === "both") continue
                          const firstName = r.first_name || r.name?.split(" ")[0] || "there"
                          const companyName = r.company || r.domain || "your company"
                          const body = campaignDraft.email_body.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          const subj = campaignDraft.subject.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          await handleSendEmail(idx, r.email, subj, body)
                          count++
                        }
                        if (count > 0) setClarification(`Sent emails to ${count} recipient${count === 1 ? "" : "s"} via Gmail.`)
                        else setClarification("No unsent recipients with email addresses selected.")
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send All Emails ({selectedRecipients.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!linkedinConnected}
                      onClick={async () => {
                        let count = 0
                        for (const idx of Array.from(selectedRecipients)) {
                          const r = campaignDraft.recipients[idx]
                          if (!r?.linkedin_url || sentRecipients[idx] === "linkedin" || sentRecipients[idx] === "both") continue
                          const firstName = r.first_name || r.name?.split(" ")[0] || "there"
                          const companyName = r.company || r.domain || "your company"
                          const msg = campaignDraft.linkedin_message.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          await handleSendLinkedIn(idx, r.linkedin_url, msg)
                          count++
                        }
                        if (count > 0) setClarification(`Sent LinkedIn messages to ${count} recipient${count === 1 ? "" : "s"} via Unipile.`)
                        else setClarification("No unsent recipients with LinkedIn URLs selected.")
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Send All LinkedIn ({selectedRecipients.size})
                    </Button>
                  </div>
                )}

                {/* Completion summary */}
                {campaignApproved && Object.keys(sentRecipients).length === campaignDraft.recipients.length && (
                  <div className="rounded-lg border-2 border-green-300 bg-green-50 dark:bg-green-900/10 p-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-400">
                      All {campaignDraft.recipients.length} recipients reached!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Emails sent via Gmail. LinkedIn messages sent via Unipile.
                    </p>
                  </div>
                )}

                {/* Copy All Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const fullText = `Subject: ${campaignDraft.subject}\n\n${campaignDraft.email_body}\n\n---\n\nLinkedIn Message:\n${campaignDraft.linkedin_message}`
                    navigator.clipboard.writeText(fullText)
                    setClarification("Copied full campaign draft (with template variables) to clipboard.")
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All to Clipboard
                </Button>
              </CardContent>
            </Card>
          )}

          {hasSearched && results.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {intent === "prospect" ? "Prospects Found" : "Companies Found"}
                    </CardTitle>
                    <CardDescription>
                      Found {tamPreview.count.toLocaleString()} {intent === "prospect" ? "prospects" : "companies"} • Showing {results.length} results
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={onDetectSignalsClick}
                      disabled={isDetectingSignals}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {isDetectingSignals ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Signals
                    </Button>
                    <Button
                      onClick={exportToCSV}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export to CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {intent === "prospect" ? (
                  <ProspectsResultsTable
                    data={results}
                    totalCount={tamPreview.count}
                    enableContactReveal={true}
                  />
                ) : (
                  <>
                    {results.length > 0 ? (
                      <CompaniesResultsTable
                        companies={results}
                        isLoading={false}
                        hasSearched={true}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No companies to display
                      </div>
                    )}
                  </>
                )}
                {intent === "business" && (
                  <div className="mt-4 flex gap-2">
                    <Button onClick={handlePullAllCompanies} disabled={isSearching} size="sm">
                      <Users className="mr-2 h-4 w-4" />
                      Pull All {tamPreview.count.toLocaleString()} Companies
                    </Button>
                    <Button onClick={handleRefineSearch} variant="outline" size="sm">
                      Refine Search
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Suggested Prompts */}
          {suggestedPrompts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Suggested Next Steps
                </CardTitle>
                <CardDescription>
                  Try these related prompts based on your search
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="text-left justify-start h-auto py-2 px-3 whitespace-normal"
                    >
                      <Sparkles className="h-3 w-3 mr-2 shrink-0 text-purple-500" />
                      {prompt}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {detectedSignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Detected Signals
                </CardTitle>
                <CardDescription>
                  {intent === "prospect"
                    ? "Person-level insights for personalized outreach"
                    : "Company-level insights for personalized outreach"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detectedSignals.map((signal: any, idx: number) => (
                  <div key={idx} className="rounded-lg border p-4">
                    {intent === "prospect" ? (
                      // Display person info for prospects
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{signal.person_name || signal.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {signal.job_title} at {signal.company}
                          </p>
                          {signal.linkedin_url && (
                            <a
                              href={signal.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              View LinkedIn Profile
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Display company info for companies
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{signal.company_name}</h3>
                        <span className="text-sm text-muted-foreground">{signal.domain}</span>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {signal.signals?.map((s: any, sIdx: number) => (
                        <div key={sIdx} className="flex items-start gap-2">
                          <Badge
                            variant={s.urgency === 'high' ? 'destructive' : s.urgency === 'medium' ? 'default' : 'secondary'}
                            className="mt-0.5"
                          >
                            {s.urgency}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{s.type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{s.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {signal.personalization_tips && (
                      <div className="mt-3 rounded bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-900/20">
                        <strong>Tip:</strong> {signal.personalization_tips}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {workflowSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Workflow Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workflowSteps.map((step, idx) => (
                  <div key={idx} className="rounded border p-2">
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className="text-xs text-muted-foreground">{step.tool}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {agentMessages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {agentMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary/10 ml-8"
                        : "bg-muted mr-8"
                    }`}
                  >
                    <div className="font-medium text-xs text-muted-foreground mb-1">
                      {msg.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="whitespace-pre-line">{msg.content}</div>
                  </div>
                ))}
                {isAgentResponding && (
                  <div className="bg-muted mr-8 rounded-lg p-3 text-sm">
                    <div className="font-medium text-xs text-muted-foreground mb-1">Assistant</div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={agentMessagesEndRef} />
              </CardContent>
            </Card>
          )}

          {hasSearched && !isSearching && results.length === 0 && queryRelevant && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No results found for this query. Try a more specific title, industry, or location.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}  