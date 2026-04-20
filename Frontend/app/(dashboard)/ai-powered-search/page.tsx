"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Sparkles,
  Users,
  Loader2,
  Plus,
  MessageSquare,
  Library,
  Copy,
  Download,
  Zap,
  Mail,
  ExternalLink,
  Send,
  Check,
  CheckCircle2,
  Mic,
  MicOff,
  Activity,
  Bot,
  User,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { CompaniesResultsTable } from "@/components/leads/companies/companies-results-table"
import type { CompanyData } from "@/components/leads/companies/companies-results-table"
import { ProspectsResultsTable } from "@/components/leads/prospects/prospects-results-table"
import type { ProspectProfile, EmployerItem } from "@/lib/services/prospectService"
import { enrichCompany, enrichProspect, type CompanyEnrichmentResult, type ProspectEnrichmentResult, enrichProspectContactOut, enrichCompanyContactOut } from "@/lib/services/betterContactService"
import { authService } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { CsvImportButton } from "@/components/shared/csv-import-button"
import { normalizeCsvRecord } from "@/lib/utils/csv"

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
const CHAT_STORAGE_USER_KEY = "nlp_enrichment_user_id"
const CAMPAIGN_STATE_KEY = "nlp_enrichment_campaign_state_v2"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const CREDIT_LABELS: Record<string, string> = {
  explorium_searches: "Explorium searches",
  contactout_company_enrichments: "ContactOut company enrichments",
  contactout_decision_makers: "ContactOut decision makers",
}

const formatCreditLabel = (key: string) => {
  if (CREDIT_LABELS[key]) return CREDIT_LABELS[key]
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const PROMPT_LIBRARY: PromptLibraryItem[] = [
  // --- Build Lead Lists ---
  {
    id: "build-1",
    useCase: "Build Lead Lists",
    title: "Marketing decision makers at small digital agencies in TX and FL",
    description: "Find marketing decision makers at digital agencies with 1-50 employees in Texas and Florida.",
    prompt: "Find Marketing decision makers at digital agencies with 1 to 50 employees in Texas and Florida.",
  },
  {
    id: "build-2",
    useCase: "Build Lead Lists",
    title: "Series A-B SaaS companies in North America",
    description: "Find early-stage SaaS companies with recent funding in the US and Canada.",
    prompt: "Find B2B SaaS companies in the US and Canada that raised Series A or Series B funding with 50 to 500 employees.",
  },
  {
    id: "build-3",
    useCase: "Build Lead Lists",
    title: "Healthcare companies using Salesforce in California",
    description: "Find healthcare companies that use Salesforce CRM in California.",
    prompt: "Find healthcare companies in California with 100 to 2000 employees that use Salesforce.",
  },
  {
    id: "build-4",
    useCase: "Build Lead Lists",
    title: "E-commerce brands with fast employee growth",
    description: "Find e-commerce companies showing strong hiring signals.",
    prompt: "Find e-commerce companies in the US with more than 50 employees that have grown headcount by at least 20% in the last 12 months.",
  },
  {
    id: "build-5",
    useCase: "Build Lead Lists",
    title: "AI tech-enabled services hiring (CTO/Head of Tech/IT Procurement)",
    description: "Find non-recruiting companies hiring for AI tech-enabled services with 100+ employees and signals for personalization.",
    prompt: "Find the top 50 companies (not staffing or recruiting agencies) that are actively hiring for AI tech-enabled services. Exclude recruiting agencies, staffing, talent firms, HR consultants, and job boards. Company size: 100+ employees. Include signals from technology, social media, and blogs for personalization. Target ICP titles: Head of Tech, CTO, IT Procurement.",
  },
  // --- Find Contact Info ---
  {
    id: "contact-1",
    useCase: "Find Contact Info",
    title: "Data decision makers at mid-size Snowflake users",
    description: "Find data leaders at companies with 100-1000 employees using Snowflake and include verified emails only.",
    prompt: "Find data decision makers at companies with 100 to 1000 employees that use Snowflake, only with verified emails.",
  },
  {
    id: "contact-2",
    useCase: "Find Contact Info",
    title: "CTOs and VPs of Engineering at AI startups",
    description: "Find senior engineering leaders at AI companies with verified contact details.",
    prompt: "Find CTOs and VPs of Engineering at artificial intelligence companies with 20 to 500 employees, only with verified emails.",
  },
  {
    id: "contact-3",
    useCase: "Find Contact Info",
    title: "HR directors at manufacturing companies in the Midwest",
    description: "Source HR leaders at manufacturing firms in the US Midwest with emails.",
    prompt: "Find HR Directors and VP of People at manufacturing companies in Illinois, Ohio, and Michigan with verified emails.",
  },
  // --- Personalize Your Outreach ---
  {
    id: "personalize-1",
    useCase: "Personalize Your Outreach",
    title: "Executive outreach using recent company signals",
    description: "Find target executives and include recent activity context for personalized outreach.",
    prompt: "Find VP/Head level marketing leaders in fintech companies in the US and include recent company signals for personalized outreach.",
  },
  {
    id: "personalize-2",
    useCase: "Personalize Your Outreach",
    title: "Recently funded startups for partnership outreach",
    description: "Find companies that recently raised funding for timely partnership conversations.",
    prompt: "Find technology companies in the US that raised funding in the last 6 months with 20 to 200 employees and include signals for personalized outreach.",
  },
  {
    id: "personalize-3",
    useCase: "Personalize Your Outreach",
    title: "Sales leaders at companies hiring SDRs",
    description: "Find VP Sales at companies actively hiring sales reps — a strong buying signal.",
    prompt: "Find VP of Sales and Sales Directors at B2B SaaS companies with 100 to 1000 employees that are currently hiring SDRs or Account Executives.",
  },
  // --- Meeting Prep ---
  {
    id: "meeting-1",
    useCase: "Meeting Prep",
    title: "Company overview with competitors and likely pain points",
    description: "Get target companies and context useful for prep before outbound meetings.",
    prompt: "Find B2B SaaS companies in the US with 200 to 1000 employees and include data useful for competitor and pain-point analysis.",
  },
  {
    id: "meeting-2",
    useCase: "Meeting Prep",
    title: "Fintech companies in Europe with recent leadership changes",
    description: "Prep for meetings with European fintech firms experiencing executive turnover.",
    prompt: "Find fintech companies in Europe with 100 to 5000 employees and include recent leadership changes and company signals.",
  },
  // --- Recruiting ---
  {
    id: "recruiting-1",
    useCase: "Recruiting",
    title: "Texas DevOps or platform engineers in security",
    description: "Source DevOps/platform engineering prospects in information security companies in Texas.",
    prompt: "Find DevOps or Platform Engineers in information security companies in Texas with at least 18 months in role.",
  },
  {
    id: "recruiting-2",
    useCase: "Recruiting",
    title: "Senior product managers at growth-stage startups",
    description: "Find experienced PMs at fast-growing startups in the US.",
    prompt: "Find Senior Product Managers and Directors of Product at startups with 50 to 500 employees in the US that have grown headcount by 15% or more.",
  },
  {
    id: "recruiting-3",
    useCase: "Recruiting",
    title: "Machine learning engineers in the Bay Area",
    description: "Source ML engineers at AI-focused companies in San Francisco and the Bay Area.",
    prompt: "Find Machine Learning Engineers and AI Researchers at artificial intelligence companies in California with verified emails and Social profiles.",
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
  const [enrichingRows, setEnrichingRows] = useState<Record<string, boolean>>({})
  const [enrichedData, setEnrichedData] = useState<Record<string, any>>({})
  const [waterfallAttempts, setWaterfallAttempts] = useState<Record<string, { email?: boolean; phone?: boolean }>>({})
  const [showSignals, setShowSignals] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [campaignDraft, setCampaignDraft] = useState<{
    subject: string
    email_body: string
    Social_message: string
    recipients: Array<{
      name: string
      first_name?: string
      email?: string
      Social_url?: string
      job_title?: string
      company?: string
      domain?: string
    }>
  } | null>(null)
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false)
  const [campaignApproved, setCampaignApproved] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState<Set<number>>(new Set())
  const [sentRecipients, setSentRecipients] = useState<Record<number, "email" | "Social" | "both">>({})
  const [sendingRecipients, setSendingRecipients] = useState<Record<number, "email" | "Social">>({})
  const [sendErrors, setSendErrors] = useState<Record<number, string>>({})
  const [SocialConnected, setSocialConnected] = useState(false)
  const { toast } = useToast()
  const [isImportingFilters, setIsImportingFilters] = useState(false)
  const [isVoiceListening, setIsVoiceListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [creditUsage, setCreditUsage] = useState<Record<string, number> | null>(null)
  const [icpConfig, setIcpConfig] = useState({
    titles: ["Head of Tech", "CTO", "IT Procurement"],
    industries: ["Technology", "Information and Internet", "Software Development"],
    locations: [],
    min_employees: 201,
    max_employees: 5000,
    seniority: [],
    keywords: ["AI", "artificial intelligence", "tech-enabled services"],
  })
  const creditUsageEntries = creditUsage ? Object.entries(creditUsage) : []
  const totalCreditsUsed = creditUsageEntries.reduce((sum, [, value]) => sum + (value ?? 0), 0)
  const hasHydratedCampaignState = useRef(false)

  // Agent conversation state
  const [agentMessages, setAgentMessages] = useState<Array<{ role: "user" | "assistant", content: string }>>([])
  const [isAgentResponding, setIsAgentResponding] = useState(false)

  const queryInputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const agentMessagesEndRef = useRef<HTMLDivElement>(null)
  const initialActiveChatId = useRef<string | null>(null)

  // Auto-scroll agent conversation when new messages appear
  useEffect(() => {
    agentMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentMessages, isAgentResponding])

  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript || ""
        }
      }
      if (finalTranscript.trim()) {
        setNaturalLanguageQuery((prev) => {
          const combined = prev ? `${prev} ${finalTranscript}` : finalTranscript
          return combined.trim()
        })
      }
    }

    recognition.onerror = () => {
      setIsVoiceListening(false)
    }

    recognition.onend = () => {
      if (isVoiceListening) {
        setIsVoiceListening(false)
      }
    }

    recognitionRef.current = recognition
    setVoiceSupported(true)
    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  // Check Social connection status on mount
  useEffect(() => {
    const API = ""
    // Check Social (Messaging provider) status
    fetch(`${API}/api/v1/campaigns/linkedin/status`).then(r => r.json()).then(data => {
      if (data.connected) setSocialConnected(true)
    }).catch(() => { })
    // Fetch workspace ICP config for scoring search results
    fetch(`${API}/api/v1/visitors/site-config`).then(r => {
      if (r.ok) return r.json()
      return null
    }).then(data => {
      if (data?.icp_filters && Object.keys(data.icp_filters).length > 0) {
        setIcpConfig(data.icp_filters)
      }
    }).catch(() => { })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || hasHydratedCampaignState.current) return
    const stored = window.localStorage.getItem(CAMPAIGN_STATE_KEY)
    if (!stored) {
      hasHydratedCampaignState.current = true
      return
    }
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed.detectedSignals)) setDetectedSignals(parsed.detectedSignals)
      if (parsed.campaignDraft) setCampaignDraft(parsed.campaignDraft)
      if (parsed.campaignApproved) setCampaignApproved(parsed.campaignApproved)
      if (parsed.selectedRecipients) setSelectedRecipients(new Set(parsed.selectedRecipients))
      if (parsed.sentRecipients) setSentRecipients(parsed.sentRecipients)
      if (parsed.sendingRecipients) setSendingRecipients(parsed.sendingRecipients)
      if (parsed.sendErrors) setSendErrors(parsed.sendErrors)
      if (parsed.creditUsage) setCreditUsage(parsed.creditUsage)
    } catch (err) {
      console.error("Failed to hydrate campaign state:", err)
    } finally {
      hasHydratedCampaignState.current = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const payload = {
      detectedSignals,
      campaignDraft,
      campaignApproved,
      selectedRecipients: Array.from(selectedRecipients),
      sentRecipients,
      sendingRecipients,
      sendErrors,
      creditUsage,
    }
    window.localStorage.setItem(CAMPAIGN_STATE_KEY, JSON.stringify(payload))
  }, [detectedSignals, campaignDraft, campaignApproved, selectedRecipients, sentRecipients, sendingRecipients, sendErrors, creditUsage])

  const handleSendEmail = async (recipientIdx: number, toEmail: string, subject: string, body: string) => {
    setSendingRecipients(prev => ({ ...prev, [recipientIdx]: "email" }))
    setSendErrors(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    try {
      const API = ""
      const res = await fetch(`${API}/api/v1/campaigns/send-email`, {
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
        [recipientIdx]: prev[recipientIdx] === "Social" ? "both" : "email"
      }))
    } catch (e: any) {
      setSendErrors(prev => ({ ...prev, [recipientIdx]: e.message || "Email send failed" }))
    } finally {
      setSendingRecipients(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    }
  }

  const handleSendSocial = async (recipientIdx: number, SocialUrl: string, message: string) => {
    setSendingRecipients(prev => ({ ...prev, [recipientIdx]: "Social" }))
    setSendErrors(prev => { const n = { ...prev }; delete n[recipientIdx]; return n })
    try {
      const API = ""
    const res = await fetch(`${API}/api/v1/campaigns/send-linkedin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: SocialUrl, message }),
    })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients(prev => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "email" ? "both" : "Social"
      }))
    } catch (e: any) {
      setSendErrors(prev => ({ ...prev, [recipientIdx]: e.message || "Social send failed" }))
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

  const getPersistentUserId = (): string | null => {
    if (typeof window === "undefined") return null
    const user = authService.getCurrentUser()
    if (user?.id) return user.id
    let stored = localStorage.getItem(CHAT_STORAGE_USER_KEY)
    if (!stored) {
      const randomString =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      stored = `anon_${randomString}`
      localStorage.setItem(CHAT_STORAGE_USER_KEY, stored)
    }
    return stored
  }

  const mergeChatCollections = (existing: ChatSession[], incoming: ChatSession[]): ChatSession[] => {
    const map = new Map<string, ChatSession>()
    incoming.forEach((session) => map.set(session.id, session))
    existing.forEach((session) => {
      if (!map.has(session.id)) {
        map.set(session.id, session)
      }
    })
    const merged = Array.from(map.values())
    merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return merged
  }

  const normalizeServerSession = (record: any): ChatSession => {
    const data = record.data || {}
    const now = new Date().toISOString()
    return {
      id: data.id || data.sessionId || record.session_id || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: data.title || record.title || "Chat",
      createdAt: data.createdAt || record.created_at || now,
      updatedAt: data.updatedAt || record.updated_at || now,
      messages: Array.isArray(data.messages) ? data.messages : [],
      query: data.query || "",
      intent: data.intent || "business",
      results: Array.isArray(data.results) ? data.results : [],
      tamPreview: data.tamPreview || { count: 0, cost: 0 },
      clarification: data.clarification || "",
      workflowSteps: Array.isArray(data.workflowSteps) ? data.workflowSteps : [],
      hasSearched: Boolean(data.hasSearched),
      clarificationStep: data.clarificationStep || "pending",
      extractedFilters: data.extractedFilters || {},
      suggestedPrompts: Array.isArray(data.suggestedPrompts) ? data.suggestedPrompts : [],
    }
  }

  const syncChatWithServer = async (session: ChatSession) => {
    const userId = getPersistentUserId()
    if (!userId) return
    try {
      await fetch(`${API_BASE_URL}/api/v1/chat/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          session_id: session.id,
          data: session,
        }),
      })
    } catch (error) {
      console.error('Failed to sync chat with server:', error);
    }
  }

  const applySessionToView = (session: ChatSession) => {
    const normalizeSocialUrl = (value: any) => {
      if (typeof value !== "string" || !value.trim()) return ""
      const v = value.trim()
      return v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`
    }

    const normalizeEmployer = (src: any): EmployerItem => ({
      name: src?.name || src?.company_name || src?.company || "",
      linkedin_id: src?.linkedin_id || src?.Social_id || "",
      company_id: Number(src?.company_id || 0),
      company_linkedin_id: src?.company_linkedin_id || src?.company_Social_id || "",
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
      company_linkedin_industry: src?.company_linkedin_industry || src?.company_Social_industry || src?.industry || "",
      company_type: src?.company_type || "",
      company_headcount_latest: Number(src?.company_headcount_latest || src?.size || 0),
      company_website: src?.company_website || src?.website || "",
      company_linkedin_profile_url: src?.company_linkedin_profile_url || src?.company_Social_profile_url || src?.linkedin_url || src?.Social_url || "",
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

      const profileUrl = normalizeSocialUrl(
        item?.linkedin_profile_url ||
        item?.flagship_profile_url ||
        item?.linkedin_url ||
        item?.Social_profile_url ||
        item?.Social_url ||
        item?.Social ||
        raw?.linkedin_profile_url ||
        raw?.flagship_profile_url ||
        raw?.linkedin_url ||
        raw?.Social_profile_url ||
        raw?.Social_url
      )

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
        'linkedin_profile_url': profileUrl,
        'Social_profile_url': profileUrl,
        'flagship_profile_url': profileUrl,
        emails: email ? [email] : [],
        profile_picture_url: item?.profile_picture_url || raw?.profile_picture_url || "",
        profile_picture_permalink: item?.profile_picture_permalink || raw?.profile_picture_permalink || "",
        twitter_handle: item?.twitter_handle || raw?.twitter_handle || "",
        num_of_connections: parseConnectionCount(
          item?.num_of_connections,
          item?.connections,
          item?.connection_count,
          item?.Social_connections,
          raw?.num_of_connections,
          raw?.connections,
          raw?.connection_count,
          raw?.Social_connections
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
    setAgentMessages(Array.isArray(session.messages) ? session.messages : [])
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : []
      if (parsed.length > 0) {
        const ordered = [...parsed].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        setChats(ordered)
        setActiveChatId(ordered[0].id)
        initialActiveChatId.current = ordered[0].id
        applySessionToView(ordered[0])
      }
    } catch (e) {
      console.warn("Failed to load NLP chats", e)
    }

    const loadServerHistory = async () => {
      try {
        const userId = getPersistentUserId()
        if (!userId) return
        const response = await fetch(`${API_BASE_URL}/api/v1/chat/history?user_id=${encodeURIComponent(userId)}`)
        if (!response.ok) return
        const payload = await response.json()
        const sessions = Array.isArray(payload.sessions) ? payload.sessions.map(normalizeServerSession) : []
        if (sessions.length === 0) return
        setChats((prev) => mergeChatCollections(prev, sessions))
        if (!initialActiveChatId.current && sessions[0]) {
          initialActiveChatId.current = sessions[0].id
          setActiveChatId(sessions[0].id)
          applySessionToView(sessions[0])
        }
      } catch (error) {
        console.warn("Failed to load server chat history", error)
      }
    }

    loadServerHistory()
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
    applySessionToView(found)  // Restores agentMessages from session.messages
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
      suggestions.push(`Search for prospects who posted on Social recently`)
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
    void syncChatWithServer(nextSession)
  }

  const buildExamples = (query: string) => {
    const endpoint = `${API_BASE_URL}/api/explorium/search`
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

      const normalizeDomain = (value?: string) => {
        if (!value || typeof value !== "string") return ""
        return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim()
      }

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

      const employeesExact = item.employee_count_exact ?? item.Social_headcount ?? item.size ?? raw.employee_count_exact ?? raw.size
      const employeesRange = item.employee_count_range ?? item.employee_range ?? item.number_of_employees_range ?? item.company_size ?? item.size_range ?? raw.employee_count_range ?? raw.number_of_employees_range

      const normalizedDomain = normalizeDomain(item.domain ?? item.website ?? raw.domain ?? raw.website ?? "")
      const linkedinUrl =
        item.linkedin_url ??
        item.company_linkedin_url ??
        item.linkedin_profile_url ??
        item.Social_url ??
        item.Social_profile ??
        item.company_Social_url ??
        item.li_vanity ??
        raw.linkedin_url ??
        raw.company_linkedin_url ??
        raw.li_vanity

      return {
        id: String(item.id ?? item.business_id ?? item.domain ?? ""),
        name: item.name ?? item.business_name ?? item.company_name ?? "",
        domain: normalizedDomain,
        website: item.website,
        logo_url: item.logo_url ?? item.Social_logo_url ?? item.business_logo ?? item.logo ?? (item.domain ? `https://logo.clearbit.com/${item.domain}` : undefined),
        description: item.description ?? item.company_description ?? item.business_description,
        industry: item.industry ?? item.linkedin_industry_category ?? item.Social_industry_category ?? item.primary_industry,
        sub_industry: item.sub_industry,
        linkedin_industry_category: item.linkedin_industry_category ?? item.Social_industry_category,
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
        linkedin_url: linkedinUrl,
        Social_url: linkedinUrl,
        twitter_url: item.twitter_url,
        facebook_url: item.facebook_url,
        instagram_url: item.instagram_url,
        follower_count: item.follower_count ?? item.Social_followers,
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
      const response = await fetch(`/api/v1/leads/search/companies`, {
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

  const handleLoadMore = async () => {
    if (isSearching) return

    // Get filters and intent from component state or active chat session
    let filters = latestExtractedFilters || {}
    let currentIntent = intent
    if (!filters || Object.keys(filters).length === 0) {
      const activeChat = chats.find(c => c.id === activeChatId)
      if (activeChat?.extractedFilters) {
        filters = activeChat.extractedFilters
        currentIntent = activeChat.intent || intent
      }
    }
    if (!filters || Object.keys(filters).length === 0) return

    setIsSearching(true)
    try {
      const currentLimit = results.length
      const targetLimit = currentLimit + 25
      const endpoint = currentIntent === "business" ? `/api/v1/leads/search/companies` : `/api/v1/prospects/search`

      const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
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

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Load more API error (${response.status}):`, errorText)
        throw new Error(`Failed to load more ${currentIntent === "business" ? "companies" : "prospects"}: ${errorText || response.status}`)
      }

      const payload = await response.json()
      let mappedResults

      if (currentIntent === "business") {
        const rawCompanies = payload?.data?.companies || []
        mappedResults = mapCompanyResults(rawCompanies)
      } else {
        const rawProspects = payload?.data?.prospects || []
        mappedResults = mapProspectResults(rawProspects)
      }

      setResults(mappedResults)
      setTamPreview((prev) => ({
        ...prev,
        count: payload?.data?.total_count || mappedResults.length || prev.count,
        cost: mappedResults.length * 0.1,
      }))
      // Don't add assistant message - user only wants results table to update
    } catch (e) {
      console.error("Load more failed:", e)
      const errorMsg: { role: "user" | "assistant", content: string } = {
        role: "assistant",
        content: "Sorry, I couldn't load more results. Please try again."
      }
      setAgentMessages(prev => [...prev, errorMsg])
    } finally {
      setIsSearching(false)
    }
  }

  const computeIcpScore = (result: any, icp: Record<string, any>): { score: number, tier: 'Hot' | 'Warm' | 'Cold', breakdown: Record<string, number>, timestamp: number } => {
    let score = 0
    const breakdown: Record<string, number> = { title: 0, industry: 0, location: 0, size: 0, seniority: 0, keywords: 0 }

    // Title match: +25 pts
    const targetTitles: string[] = icp.titles || icp.current_title || []
    if (targetTitles.length > 0) {
      const resultTitle = [
        result.headline, result.job_title, result.current_title,
        result.current_employers?.[0]?.title, result.name
      ].filter(Boolean).join(" ").toLowerCase()
      if (targetTitles.some((t: string) => resultTitle.includes(t.toLowerCase()))) {
        score += 25
        breakdown.title = 25
      }
    }

    // Industry match: +25 pts
    const targetIndustries: string[] = icp.industries || icp.industry || []
    if (targetIndustries.length > 0) {
      const resultIndustry = [
        result.industry, result.company_linkedin_industry,
        result.linkedin_industry_category, result.sub_industry,
        result.current_employers?.[0]?.company_linkedin_industry
      ].filter(Boolean).join(" ").toLowerCase()
      if (targetIndustries.some((ind: string) => resultIndustry.includes(ind.toLowerCase()))) {
        score += 25
        breakdown.industry = 25
      }
    }

    // Location match: +20 pts
    const targetLocations: string[] = icp.locations || icp.location || []
    if (targetLocations.length > 0) {
      const resultLocation = [
        result.region, result.location, result.location_display,
        result.headquarters_city, result.headquarters_state, result.headquarters_country,
        result.headquarters_address,
        result.location_details?.country, result.location_details?.state, result.location_details?.city
      ].filter(Boolean).join(" ").toLowerCase()
      if (targetLocations.some((loc: string) => resultLocation.includes(loc.toLowerCase()))) {
        score += 20
        breakdown.location = 20
      }
    }

    // Company size match: +20 pts
    // Support both min/max numbers (workspace ICP) and string ranges (search filter fallback)
    let sizeMatched = false
    const minEmp = icp.min_employees
    const maxEmp = icp.max_employees
    const sizeRanges: string[] = icp.company_size || []
    const empCount = result.employee_count_exact || result.employee_count ||
      result.current_employers?.[0]?.company_headcount_latest || 0
    const empRange = (result.employee_count_range || result.company_size || "").toLowerCase()

    if (minEmp || maxEmp) {
      // Workspace ICP: numeric min/max
      if (empCount > 0) {
        const inRange = (!minEmp || empCount >= minEmp) && (!maxEmp || empCount <= maxEmp)
        if (inRange) sizeMatched = true
      }
    }
    if (!sizeMatched && sizeRanges.length > 0) {
      // Search filter fallback: match string ranges like "51-200"
      if (sizeRanges.some((r: string) => empRange.includes(r.toLowerCase()))) {
        sizeMatched = true
      } else if (empCount > 0) {
        // Parse the ICP ranges and check if empCount falls within any
        for (const range of sizeRanges) {
          const match = range.match(/^(\d+)\s*[-–]\s*(\d+)/)
          if (match) {
            const lo = parseInt(match[1]), hi = parseInt(match[2])
            if (empCount >= lo && empCount <= hi) { sizeMatched = true; break }
          }
          if (range.includes("+")) {
            const base = parseInt(range)
            if (!isNaN(base) && empCount >= base) { sizeMatched = true; break }
          }
        }
      }
    }
    if (sizeMatched) {
      score += 20
      breakdown.size = 20
    }

    // Seniority match: +10 pts
    const targetSeniority: string[] = icp.seniority || []
    if (targetSeniority.length > 0) {
      const resultSeniority = [
        result.current_employers?.[0]?.seniority_level, result.seniority
      ].filter(Boolean).join(" ").toLowerCase()
      if (targetSeniority.some((s: string) => resultSeniority.includes(s.toLowerCase()))) {
        score += 10
        breakdown.seniority = 10
      }
    }

    // Keywords match: +10 pts
    const targetKeywords: string[] = icp.keywords || []
    if (targetKeywords.length > 0) {
      const resultText = JSON.stringify(result).toLowerCase()
      if (targetKeywords.some((kw: string) => resultText.includes(kw.toLowerCase()))) {
        score += 10
        breakdown.keywords = 10
      }
    }

    let tier: 'Hot' | 'Warm' | 'Cold' = 'Cold'
    if (score >= 70) tier = 'Hot'
    else if (score >= 40) tier = 'Warm'

    return { score: Math.min(score, 100), tier, breakdown, timestamp: Date.now() }
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

  const generateQuerySuggestions = (query: string, filters: Record<string, any>): string[] => {
    const suggestions: string[] = []
    const queryLower = query.toLowerCase()

    // Suggest broadening location
    if (filters.location?.length) {
      const withoutLocation = query.replace(/\b(in|from|based in|located in)\s+[A-Za-z\s,]+/gi, "").replace(/\s+/g, " ").trim()
      if (withoutLocation && withoutLocation !== query) {
        suggestions.push(withoutLocation)
      }
    }

    // Suggest broader role category
    if (filters.current_title?.length) {
      const titles = filters.current_title as string[]
      const hasNarrowTitle = titles.some((t: string) =>
        /\b(senior|sr|junior|jr|lead|principal|staff)\b/i.test(t)
      )
      if (hasNarrowTitle) {
        const broader = query.replace(/\b(senior|sr\.|junior|jr\.|lead|principal|staff)\s*/gi, "").trim()
        if (broader !== query) suggestions.push(broader)
      }
    }

    // Suggest increasing company size range
    if (filters.company_size?.length) {
      const sizeLabels = filters.company_size as string[]
      const allSmall = sizeLabels.every((s: string) => ["1-10", "11-50"].includes(s))
      if (allSmall) {
        const broader = query
          .replace(/\b(small|startup|1\s*-\s*10|11\s*-\s*50|1\s+to\s+50)\b/gi, "mid-size")
          .trim()
        if (broader !== query) suggestions.push(broader)
      }
    }

    // Generic fallback: remove qualifiers
    if (suggestions.length < 2) {
      const simplified = query
        .replace(/\b(only|verified|with emails?|with contact info|active|recently)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
      if (simplified !== query && simplified.length > 10) suggestions.push(simplified)
    }

    // Always offer an industry-broadened variant if industry filter is present
    if (filters.industry?.length && suggestions.length < 3) {
      const withoutIndustry = query
        .replace(/\b(in|at|for)\s+(the\s+)?([\w\s]+?)\s+(industry|sector|space|companies)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
      if (withoutIndustry && withoutIndustry !== query && withoutIndustry.length > 10) {
        suggestions.push(withoutIndustry)
      }
    }

    return suggestions.slice(0, 3)
  }

  const detectIntent = (query: string): "business" | "prospect" => {
    const queryLower = query.toLowerCase()
    const prospectKeywords = [
      'people', 'prospects', 'person', 'contacts', 'vp', 'ceo', 'cto', 'cxo', 'cfo', 'cio', 'coo',
      'head of', 'manager', 'engineer', 'decision makers', 'decision maker', 'decisions',
      'directors', 'founders', 'who is', 'who are', 'who works', 'profiles', 'emails', 'phones',
      'leaders', 'executives', 'procurement'
    ]

    // If ANY prospect keyword or signal is found, it's a prospect search
    const hasProspectKeyword = prospectKeywords.some(kw => queryLower.includes(kw))
    const hasStrongContactSignal = /\b(email|phone|contact|profile|Social)\b/i.test(queryLower)

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

    // 4. Extract company size — normalize to valid CrustData ranges
    const CRUSTDATA_RANGES = [
      { min: 1, max: 10, label: "1-10" },
      { min: 11, max: 50, label: "11-50" },
      { min: 51, max: 200, label: "51-200" },
      { min: 201, max: 500, label: "201-500" },
      { min: 501, max: 1000, label: "501-1000" },
      { min: 1001, max: 5000, label: "1001-5000" },
      { min: 5001, max: 10000, label: "5001-10000" },
      { min: 10001, max: Infinity, label: "10001+" },
    ]
    const mapToCrustdataRanges = (low: number, high: number): string[] =>
      CRUSTDATA_RANGES.filter(r => r.max >= low && r.min <= high).map(r => r.label)
    const mapSingleNumber = (n: number): string[] =>
      CRUSTDATA_RANGES.filter(r => n >= r.min && n <= r.max).map(r => r.label)

    const sizePatterns = [
      { pattern: /(\d+)\s*-\s*(\d+)/i, range: true },
      { pattern: /(\d+)\s+to\s+(\d+)/i, range: true },
      { pattern: /company\s+(?:size|of)\s+(\d+)\b/i, single: true },
      { pattern: /(\d+)\s+employees?\b/i, single: true },
      { pattern: /\b(small|startup)\b/i, values: ['1-10', '11-50'] },
      { pattern: /\b(mid-size|medium)\b/i, values: ['51-200', '201-500'] },
      { pattern: /\b(large|enterprise)\b/i, values: ['501-1000', '1001-5000', '5001-10000'] },
    ]

    for (const sp of sizePatterns as any[]) {
      const match = queryLower.match(sp.pattern)
      if (match && sp.range) {
        extractedFilters.company_size = mapToCrustdataRanges(parseInt(match[1]), parseInt(match[2]))
        break
      } else if (match && sp.single) {
        extractedFilters.company_size = mapSingleNumber(parseInt(match[1]))
        break
      } else if (match && sp.values) {
        extractedFilters.company_size = sp.values
        break
      }
    }

    // 5. Extract Job Titles (for prospect searches)
    const titleKeywords: { pattern: RegExp; label: string }[] = [
      { pattern: /\bmarket+ing\b/, label: 'Marketing' },
      { pattern: /\bsales\b/, label: 'Sales' },
      { pattern: /\bceo\b/, label: 'CEO' },
      { pattern: /\bcto\b/, label: 'CTO' },
      { pattern: /\bcmo\b/, label: 'CMO' },
      { pattern: /\bvpo?\b/, label: 'VP' },
      { pattern: /\bexecutive\b/, label: 'Executive' },
      { pattern: /\bfounder\b/, label: 'Founder' },
      { pattern: /\bdeveloper\b/, label: 'Developer' },
      { pattern: /\bengine+r\b/, label: 'Engineer' },
      { pattern: /\bmanager\b/, label: 'Manager' },
      { pattern: /\bdirector\b/, label: 'Director' },
      { pattern: /\bhead of\b/, label: 'Head of' },
      { pattern: /\bproduct\b/, label: 'Product' },
      { pattern: /\boperations\b/, label: 'Operations' },
      { pattern: /\bfinance\b/, label: 'Finance' },
      { pattern: /\bhr\b/, label: 'HR' },
      { pattern: /\brecruiter\b/, label: 'Recruiter' },
      { pattern: /\blegal\b/, label: 'Legal' },
      { pattern: /\bgtm\b/, label: 'GTM' },
      { pattern: /\brevops\b/, label: 'RevOps' },
    ]
    const extractedTitles: string[] = []
    for (const tk of titleKeywords) {
      if (tk.pattern.test(queryLower)) {
        extractedTitles.push(tk.label)
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

  const handleClarifyFilters = async (
    overrideFilters?: Record<string, any>,
    overrideIntent?: "business" | "prospect"
  ) => {
    const API = ""
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
    let searchIntent: "business" | "prospect" = overrideIntent || detectIntent(trimmedQuery)
    let extractedFilters = overrideFilters ?? extractFiltersFromQuery(trimmedQuery)
    setLatestExtractedFilters(extractedFilters)

    // --- Hybrid fast path: skip LLM for simple, well-structured queries ---
    const complexClauses = /\b(hiring|companies that|at those|series|funding|raised|grew|growth|recently|competitors|pain[- ]?point)\b/i
    const hasStrongFilters = !!(
      extractedFilters.current_title?.length &&
      (extractedFilters.location?.length || extractedFilters.industry?.length || extractedFilters.company_size?.length)
    )
    const isSimpleQuery = hasStrongFilters && !complexClauses.test(trimmedQuery)

    if (isSimpleQuery && !overrideFilters) {
      console.log('[AI Search] Fast path: skipping LLM, client-side filters are strong enough', extractedFilters)
    } else {
      try {
        const parseRes = await fetch(`${API}/api/v1/chat/parse-query`, {
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
    }

    setIntent(searchIntent)
    setLatestExtractedFilters(extractedFilters)

    // Guard: if filters are too vague (no title, location, industry, or company_size),
    // ask the user to be more specific instead of attempting a search that will fail.
    const hasAnyFilter = !!(
      extractedFilters.current_title?.length ||
      extractedFilters.location?.length ||
      extractedFilters.industry?.length ||
      extractedFilters.company_size?.length
    )
    if (!hasAnyFilter) {
      const vagueMessage = `Your query "${trimmedQuery}" is too broad for me to search effectively.\n\nPlease include at least one of:\nJob title or role (e.g. "CTOs", "Marketing decision makers")\nIndustry (e.g. "in SaaS", "at healthcare companies")\nLocation (e.g. "in Texas", "in Europe")\nCompany size (e.g. "with 50-200 employees")\n\nExample: "Find Marketing VPs at SaaS companies in California with 50-500 employees"`
      setClarification(vagueMessage)
      setIsSearching(false)

      const now = new Date().toISOString()
      const baseSession = chats.find((c) => c.id === activeChatId) || createEmptySession()
      const nextSession: ChatSession = {
        ...baseSession,
        query: trimmedQuery,
        intent: searchIntent,
        clarification: vagueMessage,
        extractedFilters,
        clarificationStep: "pending",
        updatedAt: now,
        title: baseSession.title === "New Chat" ? createSessionTitle(trimmedQuery) : baseSession.title,
        messages: [
          ...baseSession.messages,
          { role: "user", content: trimmedQuery, createdAt: now },
          { role: "assistant", content: vagueMessage, createdAt: now }
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
      setAgentMessages(nextSession.messages.map(m => ({ role: m.role, content: m.content })))
      return
    }

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

    // Show the user query and AI response in the chat conversation area
    setAgentMessages(nextSession.messages.map(m => ({ role: m.role, content: m.content })))

    const examples = buildExamples(trimmedQuery)
    setWorkflowSteps([
      { title: "Categorizing Intent", tool: "LLM (Claude)", endpoint: "/api/v1/chat/parse-query", input: { query: trimmedQuery }, output: { intent: searchIntent, extracted_filters: extractedFilters } },
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

      const extractedFilters = (latestExtractedFilters && Object.keys(latestExtractedFilters).length > 0)
        ? latestExtractedFilters
        : extractFiltersFromQuery(trimmedQuery)
      setLatestExtractedFilters(extractedFilters)

      console.log("DEBUG: Final extractedFilters:", extractedFilters)
      console.log("=== DEBUG: handleConfirmFilters ===")
      console.log("latestExtractedFilters:", latestExtractedFilters)
      console.log("Intent:", intent)
      console.log("Query:", trimmedQuery)

      const API = ""
      const searchIntent = intent === "prospect" ? "prospect" : "business"
      const endpoint = searchIntent === "prospect"
        ? `${API}/api/v1/prospects/search`
        : `${API}/api/v1/explorium/company/search`
      const toArray = (value: any) => {
        if (!value) return undefined
        if (Array.isArray(value)) return value
        return [value]
      }
      // Build keyword from extracted keywords array (join into single string for backend)
      const keywordsArr = toArray(extractedFilters.keywords)
      const keywordStr = Array.isArray(keywordsArr) && keywordsArr.length > 0
        ? keywordsArr.join(" ")
        : undefined
      const payload = searchIntent === "prospect"
        ? {
          current_title: toArray(extractedFilters.current_title),
          location: toArray(extractedFilters.location),
          industry: toArray(extractedFilters.industry),
          employees: toArray(extractedFilters.company_size),
          keyword: keywordStr,
          limit: 3,
        }
        : { query: trimmedQuery, filters: extractedFilters }

      console.log("Calling endpoint:", endpoint)
      console.log("Request body:", JSON.stringify(payload))

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Search API Error Response:", errorText)
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Search API Response:", data)
      console.log("API Response Keys:", Object.keys(data))
      console.log("Intent from API:", data.nlp_analysis?.categorized_intent || data.intent)

      const returnedCreditUsage =
        data.service_results?.credit_usage ||
        data.credit_usage ||
        data.data?.credit_usage ||
        null
      setCreditUsage(
        returnedCreditUsage && Object.keys(returnedCreditUsage).length ? returnedCreditUsage : null
      )

      let mappedResults = []
      setIntent(searchIntent)

      // Handle different response formats from different endpoints
      const rawList = searchIntent === "prospect"
        ? (data.profiles || data.data?.profiles || data.results?.data || [])
        : (data.data?.companies || data.companies || data.results?.data || data.data || []);

      console.log('Raw List:', rawList);
      console.log('Raw List Length:', Array.isArray(rawList) ? rawList.length : 'Not an array');

      const totalCount = searchIntent === "prospect"
        ? (data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0))
        : (data.data?.total_count || data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0));

      const examples = buildExamples(trimmedQuery);
      const workflowEndpoint = searchIntent === "prospect" ? "/api/v1/prospects/search" : "/api/v1/explorium/company/search"
      setWorkflowSteps([
        {
          title: "Categorizing Filters",
          tool: "NLP Classifier",
          endpoint: "/api/v1/chat/parse-query",
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
          endpoint: "/api/v1/chat/parse-query",
          input: { query: trimmedQuery, filters: latestExtractedFilters },
          output: {
            clarification_message: clarification,
            user_confirmation_required: true,
          },
        },
        {
          title: "Search Execution",
          tool: searchIntent === "prospect" ? "Prospect Search" : "Company Search",
          endpoint: workflowEndpoint,
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
          linkedin_id: src?.linkedin_id || src?.Social_id || "",
          company_id: src?.company_id || 0,
          company_linkedin_id: src?.company_linkedin_id || src?.company_Social_id || "",
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
          company_linkedin_industry: src?.company_linkedin_industry || src?.company_Social_industry || src?.industry || "",
          company_type: src?.company_type || "",
          company_headcount_latest: src?.company_headcount_latest || src?.size || 0,
          company_website: src?.company_website || src?.website || "",
          company_linkedin_profile_url: src?.company_linkedin_profile_url || src?.company_Social_profile_url || src?.linkedin_url || src?.Social_url || "",
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
            linkedin_profile_url: item.linkedin_profile_url || item.flagship_profile_url || item.linkedin_url || item.Social_profile_url || item.Social_url || raw.linkedin_profile_url || raw.flagship_profile_url || raw.linkedin_url || raw.Social_profile_url || raw.Social_url || "",
            'Social_profile_url': item.Social_profile_url || item.linkedin_profile_url || item.flagship_profile_url || item.linkedin_url || raw.Social_profile_url || raw.linkedin_profile_url || raw.flagship_profile_url || raw.linkedin_url || "",
            'flagship_profile_url': item.flagship_profile_url || item.linkedin_profile_url || item.linkedin_url || item.Social_profile_url || item.Social_url || raw.flagship_profile_url || raw.linkedin_profile_url || raw.linkedin_url || raw.Social_profile_url || raw.Social_url || "",
            emails: email ? [email] : [],
            profile_picture_url: item.profile_picture_url || raw.profile_picture_url || "",
            profile_picture_permalink: item.profile_picture_permalink || raw.profile_picture_permalink || "",
            twitter_handle: item.twitter_handle || raw.twitter_handle || "",
            num_of_connections: parseConnectionCount(
              item.num_of_connections,
              item.connections,
              item.connection_count,
              item.Social_connections,
              raw.num_of_connections,
              raw.connections,
              raw.connection_count,
              raw.Social_connections
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

      console.log('ICP config at scoring:', icpConfig)
      console.log('Search intent at scoring:', searchIntent)
      console.log('Mapped results length:', mappedResults.length)
      if (mappedResults.length > 0) {
        console.log('First result before ICP:', {name: mappedResults[0].name, hasIcp: !!mappedResults[0]._icpScore})
      }

      // ICP scoring: use workspace ICP config, or fall back to search filters as ICP proxy
      const effectiveIcp: Record<string, any> = (icpConfig && Object.keys(icpConfig).length > 0)
        ? icpConfig
        : {
          // Derive ICP from the search filters so scoring always runs
          ...(extractedFilters.current_title?.length ? { titles: extractedFilters.current_title } : {}),
          ...(extractedFilters.industry?.length ? { industries: extractedFilters.industry } : {}),
          ...(extractedFilters.location?.length ? { locations: extractedFilters.location } : {}),
          ...(extractedFilters.company_size?.length ? { company_size: extractedFilters.company_size } : {}),
          ...(extractedFilters.keywords?.length ? { keywords: extractedFilters.keywords } : {}),
        }
      const hasEffectiveIcp = Object.keys(effectiveIcp).length > 0

      if (hasEffectiveIcp) {
        const icpConfigHash = JSON.stringify(effectiveIcp)
        console.log('Effective ICP config:', icpConfigHash)
        mappedResults = mappedResults.map((r: any) => {
          const contactId = r.person_id || r.domain || r.id || r.name
          const cacheKey = `icp_score_${contactId}_${icpConfigHash}`
          const cachedStr = localStorage.getItem(cacheKey)
          if (cachedStr) {
            try {
              const cached = JSON.parse(cachedStr)
              const isFresh = (Date.now() - cached.timestamp) < 24 * 60 * 60 * 1000
              if (isFresh) {
                console.log('Using cached ICP score for', r.name || r.company_name, cached)
                return { ...r, _icpScore: cached }
              }
            } catch (e) {
              // Invalid cache, recompute
            }
          }
          const score = computeIcpScore(r, effectiveIcp)
          localStorage.setItem(cacheKey, JSON.stringify(score))
          console.log('[ICP Debug] Computed score for', r.name || r.company_name || r.person_name, score)
          return { ...r, _icpScore: score }
        })
        mappedResults.sort((a: any, b: any) => (b._icpScore?.score || 0) - (a._icpScore?.score || 0))
        console.log('[AI Search] ICP scored and sorted results with caching')
      } else {
        console.log('ICP scoring skipped - no ICP config and no search filters to derive from')
      }

      console.log('After ICP scoring, first result:', {name: mappedResults[0]?.name, icp: mappedResults[0]?._icpScore})

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
        suggestions.push(`Search for prospects who posted on Social recently`)
      }
      suggestions.push(`Detect signals for personalized outreach`)
      suggestions.push(`Create an email campaign for these leads`)

      setSuggestedPrompts(suggestions)

      const nextTamPreview = {
        count: totalCount,
        cost: mappedResults.length * 0.1,
      }
      setTamPreview(nextTamPreview);

      // Low result count warning
      let resultSummary = `Found ${totalCount} ${searchIntent === "prospect" ? "prospects" : "companies"} for "${trimmedQuery}".`
      if (totalCount > 0 && totalCount < 20) {
        const lowCountWarning = `\n\nOnly ${totalCount} results found. Your filters may be too narrow — consider broadening location, title, or company size.`
        resultSummary += lowCountWarning
        setClarification((prev) => prev + lowCountWarning)
      }

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
          { role: "assistant", content: resultSummary, createdAt: now }
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

      // Update visible chat conversation with search results message
      setAgentMessages(nextSession.messages.map(m => ({ role: m.role, content: m.content })))
    } catch (e) {
      console.error("Search failed:", e)
      setClarification(`Search failed: ${e instanceof Error ? e.message : String(e)}. Please try again or refine your query.`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleAgentChat = async () => {
    const API = ""
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    // Add user message to agent messages
    const userMsg: { role: "user" | "assistant", content: string } = { role: "user", content: trimmedQuery }
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

      const res = await fetch(`${API}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, context })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `Agent error: ${res.status}`)
      }

      const data = await res.json()

      // Handle actions returned by the agent
      if (data.action === "new_search") {
        setNaturalLanguageQuery(data.action_data?.query || trimmedQuery)
        setTimeout(() => handleClarifyFilters(), 100)
        // Add assistant reply for new search
        const assistantMsg: { role: "user" | "assistant", content: string } = { role: "assistant", content: data.reply }
        setAgentMessages(prev => [...prev, assistantMsg])
        persistCurrentChat({ userPrompt: trimmedQuery, assistantMessage: data.reply })
      } else if (data.action === "detect_signals") {
        const sessionResults2 = results.length > 0 ? results : (chats.find(c => c.id === activeChatId)?.results || [])
        handleDetectSignals(sessionResults2, intent)
        // Add assistant reply for detect signals
        const assistantMsg: { role: "user" | "assistant", content: string } = { role: "assistant", content: data.reply }
        setAgentMessages(prev => [...prev, assistantMsg])
        persistCurrentChat({ userPrompt: trimmedQuery, assistantMessage: data.reply })
      } else if (data.action === "generate_campaign") {
        handleGenerateCampaign()
        // Add assistant reply for campaign generation
        const assistantMsg: { role: "user" | "assistant", content: string } = { role: "assistant", content: data.reply }
        setAgentMessages(prev => [...prev, assistantMsg])
        persistCurrentChat({ userPrompt: trimmedQuery, assistantMessage: data.reply })
      } else if (data.action === "load_more") {
        // Trigger load more results - no text response, just load more
        handleLoadMore()
        // Don't add assistant message for load_more - user only wants results table to update
      } else {
        // Regular conversational response
        const assistantMsg: { role: "user" | "assistant", content: string } = { role: "assistant", content: data.reply }
        setAgentMessages(prev => [...prev, assistantMsg])
        persistCurrentChat({ userPrompt: trimmedQuery, assistantMessage: data.reply })
      }
    } catch (e: any) {
      console.error("Agent chat error:", e)
      const errorMsg: { role: "user" | "assistant", content: string } = { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
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

  const inferIntentFromFilters = (filters: Record<string, any>): "business" | "prospect" => {
    const prospectIndicators = ["current_title", "past_title", "function", "seniority_level", "keyword", "company"]
    return prospectIndicators.some((key) => filters[key]) ? "prospect" : "business"
  }

  const handleImportedFilters = async (records: Record<string, string>[]) => {
    if (!records.length) {
      toast({
        title: "No filters found",
        description: "CSV should contain at least one row with filter columns.",
        variant: "destructive",
      })
      return
    }

    // Detect if the CSV contains company data (rows of companies) vs filter criteria
    const firstRow = records[0]
    const companyDataPatterns = ["name", "company_name", "company name", "company", "domain", "website", "url", "company domain", "company_domain"]
    const csvColumns = Object.keys(firstRow).map((col) => col.toLowerCase().trim().replace(/[_\s]+/g, " "))
    const hasCompanyData = companyDataPatterns.some((pattern) =>
      csvColumns.some((col) => col === pattern || col === pattern.replace(/ /g, "_"))
    ) || records.length > 1

    if (hasCompanyData && records.length > 0) {
      // CSV contains company data — directly populate the results table
      setIsImportingFilters(true)
      setIntent("business")
      setNaturalLanguageQuery("Imported companies from CSV")
      setClarification(`Imported ${records.length} companies from CSV`)
      setHasSearched(true)
      setIsSearching(false)

      // Update session to skip clarification
      const now = new Date().toISOString()
      const baseSession = chats.find((c) => c.id === activeChatId) || createEmptySession()
      setActiveChatId(baseSession.id)
      setChats((prev) => {
        const updated = {
          ...baseSession,
          query: "Imported companies from CSV",
          intent: "business" as const,
          clarification: `Imported ${records.length} companies from CSV`,
          clarificationStep: "completed" as const,
          updatedAt: now,
        }
        const exists = prev.some((c) => c.id === updated.id)
        const merged = exists
          ? prev.map((c) => (c.id === updated.id ? updated : c))
          : [updated, ...prev]
        return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      })

      // Normalize CSV column names to match expected company fields
      const columnMap: Record<string, string> = {
        "company": "name", "company_name": "name", "company name": "name", "name": "name",
        "domain": "domain", "website": "domain", "company domain": "domain", "company_domain": "domain", "url": "domain",
        "company website": "domain", "company_website": "domain",
        "industry": "industry", "sector": "industry", "Social industry": "industry",
        "employees": "employee_count_exact", "employee count": "employee_count_exact",
        "emp. range": "employee_count_range", "employee range": "employee_count_range",
        "employee_count": "employee_count_exact", "company size": "employee_count_range",
        "company_size": "employee_count_range", "headcount": "employee_count_exact",
        "location": "location_display", "headquarters": "location_display", "hq": "location_display",
        "city": "headquarters_city", "country": "headquarters_country", "state": "headquarters_state",
        "address": "street", "zip": "zip_code",
        "funding stage": "funding_stage", "funding_stage": "funding_stage",
        "total funding": "funding_total", "total_funding": "funding_total",
        "last funding": "last_funding_date",
        "revenue": "revenue_exact", "rev. range": "revenue_range", "revenue range": "revenue_range",
        "Social": "Social_url", "Social url": "Social_url", "Social_url": "Social_url",
        "description": "description", "phone": "phone", "email": "email",
        "type": "company_type", "founded": "founded_year",
        "investors": "investors", "investors count": "investors_count",
        "technologies": "technologies", "tech heavy": "is_tech_heavy",
        "quality score": "data_quality_score", "business id": "id",
        "enriched": "enriched", "decision makers": "decision_makers_count",
        "locations": "locations", "#locations": "locations_distribution_count",
      }
      const normalizedRecords = records.map((row) => {
        const normalized: Record<string, any> = {}
        Object.entries(row).forEach(([key, value]) => {
          const k = key.toLowerCase().trim()
          const mappedKey = columnMap[k] || columnMap[k.replace(/[_\s]+/g, " ")] || k.replace(/\s+/g, "_")
          normalized[mappedKey] = value
        })
        // Clean domain value (strip protocol/trailing slash)
        if (normalized["domain"]) {
          normalized["domain"] = String(normalized["domain"]).replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        }
        // Generate a logo URL from domain
        if (normalized["domain"] && !normalized["logo_url"]) {
          normalized["logo_url"] = `https://logo.clearbit.com/${normalized["domain"]}`
        }
        return normalized
      })

      const mapped = mapCompanyResults(normalizedRecords)
      console.log("CSV Import: directly mapped", mapped.length, "companies")
      setResults(mapped)
      setIsImportingFilters(false)
      return
    }

    // Otherwise treat as filter criteria (original behavior)
    const normalized = normalizeCsvRecord(records[0])
    if (Object.keys(normalized).length === 0) {
      toast({
        title: "Empty filter row",
        description: "Please map columns to search filters before importing.",
        variant: "destructive",
      })
      return
    }

    const inferredIntent = inferIntentFromFilters(normalized)
    setIntent(inferredIntent)
    setNaturalLanguageQuery("Imported filters")
    setLatestExtractedFilters(normalized)
    setClarification("Running search with imported filters...")
    setIsImportingFilters(true)

    try {
      await handleClarifyFilters(normalized, inferredIntent)
    } finally {
      setIsImportingFilters(false)
    }
  }

  const handleGenerateLeadList = (prompt?: string) => {
    const fromLibrary = PROMPT_LIBRARY[0]?.prompt
    const query = prompt || fromLibrary || naturalLanguageQuery
    setNaturalLanguageQuery(query)
    handleNaturalSearch()
  }

  const handleSummarizeResults = () => {
    if (!results.length) {
      toast({
        title: "No results yet",
        description: "Run a search before requesting a summary.",
        variant: "destructive",
      })
      return
    }

    handleSuggestedPrompt("Summarize the key insights from these results and highlight what makes each company/prospect interesting.")
  }

  const toggleVoiceListening = () => {
    if (!voiceSupported || !recognitionRef.current) {
      toast({
        title: "Voice not supported",
        description: "Your browser does not support voice input.",
        variant: "destructive",
      })
      return
    }

    if (isVoiceListening) {
      recognitionRef.current.stop()
      setIsVoiceListening(false)
    } else {
      recognitionRef.current.start()
      setIsVoiceListening(true)
    }
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
      setClarification(
        `Enriching ${currentResults.length} ${currentIntent === "prospect" ? "prospects" : "companies"} with technographic data... This will use the enrichment API.`
      )
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

      const response = await fetch(`${API_BASE_URL}/api/v1/signals/detect`, {
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
          const signalResponse = await fetch(`${API_BASE_URL}/api/v1/signals/detect`, {
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

      const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/generate-draft`, {
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
      const normalizedDraft = {
        ...data,
        Social_message: data.Social_message || data.linkedin_message || "",
        recipients: Array.isArray(data.recipients)
          ? data.recipients.map((r: any) => ({
            ...r,
            Social_url: r.Social_url || r.linkedin_url || r.linkedin_profile_url || "",
          }))
          : [],
      }
      setCampaignDraft(normalizedDraft)
      setClarification("Campaign draft generated! Review your personalized email and Social message below.")
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
        "Social URL",
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
          prospect.linkedin_profile_url || prospect.flagship_profile_url || prospect.Social_profile_url || "",
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
        "Social URL",
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
          company.Social_url || "",
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

  const handleProspectEnrichReveal = async (profile: ProspectProfile, field: 'email' | 'phone') => {
    const linkedinKey = profile.linkedin_profile_url || profile.flagship_profile_url
    if (!linkedinKey) return
    const enrichmentKey = `${linkedinKey}-${field}`
    if (enrichingRows[enrichmentKey]) return

    const firstName = profile.first_name || profile.name?.split(" ")[0] || ""
    const lastName = profile.last_name || profile.name?.split(" ").slice(1).join(" ") || ""
    const employer = profile.current_employers?.[0]
    const companyName = employer?.name || ""
    const companyDomain = employer?.company_website_domain || ""

    setEnrichingRows(prev => ({ ...prev, [enrichmentKey]: true }))
    
    // Zap icon: BetterContact waterfall (20+ data sources)
    const result = await enrichProspect(firstName, lastName, companyName, companyDomain, linkedinKey, field)

    setEnrichedData(prev => ({
      ...prev,
      [linkedinKey]: {
        ...(prev[linkedinKey] || {}),
        [field]: result.success ? (field === 'email' ? result.email : result.phone) : undefined,
        [`${field}_error`]: !result.success ? result.error : undefined,
        [`${field}_not_found`]: result.not_found
      }
    }))
    setEnrichingRows(prev => ({ ...prev, [enrichmentKey]: false }))
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-6 w-6" />
                AI-Powered Search
              </CardTitle>
              <CardDescription>
                Use natural language to find companies and prospects, discover signals, and build targeted lists.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {intent === "prospect" ? "Prospect search" : "Company search"}
              </Badge>
              {hasSearched && (
                <Badge variant="outline">
                  {results.length} result{results.length === 1 ? "" : "s"}
                </Badge>
              )}
              {creditUsageEntries.length > 0 && (
                <Badge variant="outline">
                  {totalCreditsUsed} credit{totalCreditsUsed === 1 ? "" : "s"} used
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 pb-20">
        <div className="lg:col-span-3">
          <Card className="lg:sticky lg:top-6 max-h-[calc(100vh-6rem)] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Workspace</CardTitle>
              <Button onClick={startNewChat} size="sm" className="w-full">
                New Chat
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)] pr-1">
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
                <div className="space-y-3">
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

                  <div className="space-y-2">
                    {PROMPT_LIBRARY.filter((p) => selectedUseCase === "All" || p.useCase === selectedUseCase).map((prompt) => (
                      <div key={prompt.id} className="rounded-md border bg-card/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground">{prompt.useCase}</div>
                            <div className="text-sm font-medium">{prompt.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">{prompt.description}</div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setNaturalLanguageQuery(prompt.prompt)}
                            >
                              Use
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigator.clipboard.writeText(prompt.prompt)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn(
          "space-y-6",
          (detectedSignals.length > 0 || isDetectingSignals || workflowSteps.length > 0 || totalCreditsUsed > 0) 
            ? "lg:col-span-6" 
            : "lg:col-span-9"
        )}>
          <Card className="border-border/60 shadow-xl min-h-[400px] flex flex-col justify-between">
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
             <CardContent className="space-y-6 p-10 flex-1 flex flex-col justify-center">
              {agentMessages.length > 0 && (
                <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-lg p-4 bg-muted/30">
                  {agentMessages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3 items-start", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap break-all",
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"
                      )}>
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isAgentResponding && (
                    <div className="flex gap-3 items-start">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="rounded-lg px-3 py-2 bg-card border">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={agentMessagesEndRef} />
                </div>
              )}
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
                rows={6}
                className="resize-none text-xl p-6 border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 leading-relaxed font-medium"
              />
              <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  AI is parsing intent as you type
                </Badge>
                {isImportingFilters && (
                  <span className="text-xs text-muted-foreground">Applying imported filters...</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleGenerateLeadList()}>
                    <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                    Generate leads
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSummarizeResults}>
                    <Library className="mr-2 h-4 w-4 text-foreground" />
                    Summarize
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGenerateCampaign}>
                    <Mail className="mr-2 h-4 w-4 text-foreground" />
                    Draft campaign
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDetectSignals(results, intent)}>
                    <Zap className="mr-2 h-4 w-4 text-yellow-500" />
                    Detect signals
                  </Button>
                  <CsvImportButton
                    label="Import CSV filters"
                    onRecordsParsed={handleImportedFilters}
                    className="h-9 px-3 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={toggleVoiceListening}>
                    {isVoiceListening ? (
                      <>
                        <MicOff className="mr-2 h-4 w-4 text-red-500" />
                        Stop voice
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4 text-green-500" />
                        Voice mode
                      </>
                    )}
                  </Button>
                </div>
                <Button
                  onClick={handleNaturalSearch}
                  disabled={isSearching || isAgentResponding || !naturalLanguageQuery.trim()}
                  className="ml-auto min-w-[180px]"
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
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Filter Clarification</CardTitle>
                    <CardDescription>Confirm or refine the extracted filters.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="whitespace-pre-line text-sm">{clarification}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => { console.log('Confirm and Search clicked'); handleConfirmFilters(); }} disabled={isSearching} size="sm">
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

          {(hasSearched || campaignDraft || detectedSignals.length > 0 || creditUsageEntries.length > 0) && (
            <Card className="border-border/60 shadow-sm sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Status</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Quick snapshot of the current search session.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {intent === "prospect" ? "Prospect mode" : "Company mode"}
                </Badge>
                {hasSearched && (
                  <Badge variant="outline">
                    {results.length} result{results.length === 1 ? "" : "s"} shown
                  </Badge>
                )}
                {detectedSignals.length > 0 && (
                  <Badge variant="outline">
                    {detectedSignals.length} signal set{detectedSignals.length === 1 ? "" : "s"}
                  </Badge>
                )}
                {campaignDraft && (
                  <Badge variant={campaignApproved ? "default" : "outline"}>
                    {campaignApproved ? "Campaign approved" : "Campaign draft ready"}
                  </Badge>
                )}
                {creditUsageEntries.length > 0 && (
                  <Badge variant="outline">
                    {totalCreditsUsed} credit{totalCreditsUsed === 1 ? "" : "s"} used
                  </Badge>
                )}
                {SocialConnected && (
                  <Badge variant="outline">Social connected</Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* Campaign Draft Loading */}
          {isGeneratingCampaign && (
            <Card className="border-border/60 shadow-sm">
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
            <Card className="border-border/60 shadow-sm">
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

                {/* Social Message */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Social Message
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm whitespace-pre-line">{campaignDraft.Social_message}</p>
                  </div>
                </div>

                {/* Connection Status & Approval */}
                {!campaignApproved && (
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
                    <p className="text-sm font-medium">Connect your accounts, then approve to send directly</p>

                    {/* Email — uses signed-in account */}
                    <div className="flex items-center justify-between gap-3 p-3 rounded border bg-background">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-xs text-green-600">Uses your signed-in Google account</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
                      </Badge>
                    </div>

                    {/* Social Connection */}
                    <div className="flex items-center justify-between gap-3 p-3 rounded border bg-background">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">Social (Messaging provider)</p>
                          {SocialConnected ? (
                            <p className="text-xs text-green-600">Connected via Messaging provider</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Send Social messages directly</p>
                          )}
                        </div>
                      </div>
                      {SocialConnected ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                          Not configured
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
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
                          const isCompanyIntent = intent === "business"
                          const firstName = isCompanyIntent ? "" : (r.first_name || r.name?.split(" ")[0] || "there")
                          const companyName = r.company || r.name || r.domain || "your company"
                          const personalizedBody = campaignDraft.email_body
                            .replace(/\{\{firstName\}\}/g, firstName)
                            .replace(/\{\{companyName\}\}/g, companyName)
                          const personalizedSubject = campaignDraft.subject
                            .replace(/\{\{firstName\}\}/g, firstName)
                            .replace(/\{\{companyName\}\}/g, companyName)
                          const personalizedSocial = campaignDraft.Social_message
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
                                          disabled={!r.email || !!sending}
                                          title={!r.email ? "No email available" : `Send to ${r.email}`}
                                          onClick={() => handleSendEmail(idx, r.email, personalizedSubject, personalizedBody)}
                                        >
                                          <Send className="h-3 w-3 mr-1" />
                                          Send Email
                                        </Button>
                                      )}
                                      {/* Social send */}
                                      {sent === "Social" || sent === "both" ? (
                                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                                          <Check className="h-3 w-3 mr-1" /> Social sent
                                        </Badge>
                                      ) : sending === "Social" ? (
                                        <Badge variant="outline" className="text-xs">
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending...
                                        </Badge>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          disabled={!r.Social_url || !SocialConnected || !!sending}
                                          title={!SocialConnected ? "Social not connected" : !r.Social_url ? "No Social URL" : "Send via Social"}
                                          onClick={() => handleSendSocial(idx, r.Social_url, personalizedSocial)}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Send Social
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
                                    {r.Social_url && <Badge variant="outline" className="text-xs">Social</Badge>}
                                    {!r.email && !r.Social_url && <span>No contact info</span>}
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        let count = 0
                        for (const idx of Array.from(selectedRecipients)) {
                          const r = campaignDraft.recipients[idx]
                          if (!r?.email || sentRecipients[idx] === "email" || sentRecipients[idx] === "both") continue
                          const isCompanyIntent2 = intent === "business"
                          const firstName = isCompanyIntent2 ? "" : (r.first_name || r.name?.split(" ")[0] || "there")
                          const companyName = r.company || r.name || r.domain || "your company"
                          const body = campaignDraft.email_body.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          const subj = campaignDraft.subject.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          await handleSendEmail(idx, r.email, subj, body)
                          count++
                        }
                        if (count > 0) setClarification(`Sent emails to ${count} recipient${count === 1 ? "" : "s"} via Email.`)
                        else setClarification("No unsent recipients with email addresses selected.")
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send All Emails ({selectedRecipients.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!SocialConnected}
                      onClick={async () => {
                        let count = 0
                        for (const idx of Array.from(selectedRecipients)) {
                          const r = campaignDraft.recipients[idx]
                          if (!r?.Social_url || sentRecipients[idx] === "Social" || sentRecipients[idx] === "both") continue
                          const isCompanyIntent3 = intent === "business"
                          const firstName = isCompanyIntent3 ? "" : (r.first_name || r.name?.split(" ")[0] || "there")
                          const companyName = r.company || r.name || r.domain || "your company"
                          const msg = campaignDraft.Social_message.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, companyName)
                          await handleSendSocial(idx, r.Social_url, msg)
                          count++
                        }
                        if (count > 0) setClarification(`Sent Social messages to ${count} recipient${count === 1 ? "" : "s"} via Messaging provider.`)
                        else setClarification("No unsent recipients with Social URLs selected.")
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Send All Social ({selectedRecipients.size})
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
                      Emails sent via Email. Social messages sent via Messaging provider.
                    </p>
                  </div>
                )}

                {/* Copy All Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const fullText = `Subject: ${campaignDraft.subject}\n\n${campaignDraft.email_body}\n\n---\n\nSocial Message:\n${campaignDraft.Social_message}`
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
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>
                      {intent === "prospect" ? "Prospects Found" : "Companies Found"}
                    </CardTitle>
                    <CardDescription>
                      Found {tamPreview.count.toLocaleString()} {intent === "prospect" ? "prospects" : "companies"} • Showing {results.length} results
                      {icpConfig && results.some((r: any) => r._icpScore?.score > 0) && (
                        <span className="ml-2 text-xs text-emerald-500 font-medium">• ICP scored</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                {results.some((r: any) => r._icpScore?.score > 0) && (
                  <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border/40">
                    <span className="text-xs text-muted-foreground mr-1">ICP Scores:</span>
                    {results.slice(0, 10).map((r: any, idx: number) => {
                      const s = r._icpScore
                      if (!s) return null
                      return (
                        <Badge
                          key={idx}
                          variant={s.tier === "Hot" ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            s.tier === "Hot" && "bg-emerald-500/90 text-white",
                            s.tier === "Warm" && "bg-amber-500/80 text-white",
                            s.tier === "Cold" && "bg-zinc-500/60 text-white"
                          )}
                        >
                          {(r.name || r.first_name || `#${idx + 1}`).split(" ")[0]}: {s.score} ({s.tier})
                        </Badge>
                      )
                    })}
                    {results.length > 10 && (
                      <span className="text-[10px] text-muted-foreground">+{results.length - 10} more</span>
                    )}
                  </div>
                )}
                {intent === "prospect" ? (
                  <ProspectsResultsTable
                    data={results}
                    totalCount={tamPreview.count}
                    enableContactReveal={true}
                    tableId="ai-powered-prospects"
                    onEnrichReveal={handleProspectEnrichReveal}
                    enrichCache={enrichedData}
                    enrichingRows={enrichingRows}
                  />
                ) : (
                  <>
                    {results.length > 0 ? (
                      <CompaniesResultsTable
                        companies={results}
                        isLoading={false}
                        hasSearched={true}
                        tableId="ai-powered-companies-v3"
                        onEnrichReveal={async (companyId, field) => {
                          if (enrichedData[companyId]?.[field] || enrichingRows[companyId]) return
                          const company = results.find((c: any) => (c.domain || c.id) === companyId)
                          if (!company) return
                          setEnrichingRows(prev => ({ ...prev, [companyId]: true }))
                          
                          // Zap icon: BetterContact waterfall (20+ data sources)
                          const result = await enrichCompany(company.name, company.domain, field)

                          setEnrichedData(prev => {
                            const existing = prev[companyId] || {}
                            const updated = { ...existing, success: result.success, not_found: result.not_found }
                            if (result.email) updated.email = { email: result.email, credits_consumed: result.credits_consumed }
                            if (result.phone) updated.phone = { phone: result.phone, credits_consumed: result.credits_consumed }
                            return { ...prev, [companyId]: updated }
                          })
                          setWaterfallAttempts(prev => ({ ...prev, [companyId]: { ...prev[companyId], [field]: true } }))
                          setEnrichingRows(prev => ({ ...prev, [companyId]: false }))
                        }}
                        enrichCache={Object.fromEntries(
                          Object.entries(enrichedData).map(([key, data]) => [
                            key,
                            enrichingRows[key]
                              ? { loading: true }
                              : data?.success && !data?.not_found
                                ? {
                                  email: data.email || undefined,
                                  phone: data.phone || undefined,
                                }
                                : {}
                          ])
                        )}
                        enrichingRows={enrichingRows}
                        waterfallAttempts={waterfallAttempts}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No companies to display
                      </div>
                    )}
                  </>
                )}
                {intent === "business" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={handlePullAllCompanies} disabled={isSearching} size="sm">
                      <Users className="mr-2 h-4 w-4" />
                      Pull More Companies
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
            <Card className="border-border/60 shadow-sm bg-card/50 backdrop-blur-sm mt-8">
              <CardHeader className="pb-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Suggested Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="text-[11px] h-auto py-1.5 px-3 bg-background/50 hover:bg-background border-border/40"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fallback for no results */}
          {hasSearched && !isSearching && results.length === 0 && (() => {
            const querySuggestions = generateQuerySuggestions(naturalLanguageQuery, latestExtractedFilters)
            return (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No results found</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Your filters may be too narrow. Try one of these broader searches:
                  </p>
                </div>
                {querySuggestions.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {querySuggestions.map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setNaturalLanguageQuery(suggestion)
                          setTimeout(() => handleClarifyFilters(), 100)
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => setNaturalLanguageQuery("")}>Clear Search</Button>
              </div>
            )
          })()}
        </div>

        {(detectedSignals.length > 0 || isDetectingSignals || workflowSteps.length > 0 || totalCreditsUsed > 0) && (
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
                  {/* Signals Section */}
                  {detectedSignals.length > 0 && (
                    <Card className="border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-white/10">
                      <CardHeader className="pb-3 border-b border-white/5 bg-yellow-500/[0.03]">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          Live Signals
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase tracking-wider font-semibold opacity-60">Intelligence Pack</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="pr-3">
                          <div className="divide-y divide-border/20">
                            {detectedSignals.map((signal, idx) => (
                              <div key={idx} className="p-4 hover:bg-white/5 transition-colors group">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <h4 className="text-[13px] font-bold leading-tight group-hover:text-primary transition-colors">
                                        {signal.company_name || signal.person_name || signal.name}
                                      </h4>
                                      <Badge className="text-[9px] h-4 px-1 bg-yellow-500/10 text-yellow-600 border-none shrink-0">Signal</Badge>
                                    </div>
                                    <div className="space-y-1.5 pl-1.5 border-l-2 border-yellow-500/20">
                                      {(signal.signals || [signal]).map((s: any, si: number) => (
                                        <div key={si} className="text-[11px] leading-relaxed">
                                          <p className="font-medium">{s.title || s.type?.replace(/_/g, ' ') || "Alert"}</p>
                                          <p className="opacity-70">{s.description}</p>
                                        </div>
                                      ))}
                                      {signal.personalization_tips && (
                                        <div className="text-[11px] leading-relaxed mt-1">
                                          <p className="font-medium text-yellow-600">Personalization tip</p>
                                          <p className="opacity-70">{signal.personalization_tips}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Workflow Section */}
                  {workflowSteps.length > 0 && (
                    <Card className="border-border/60 bg-card/40 backdrop-blur-md shadow-md overflow-hidden ring-1 ring-white/10">
                      <CardHeader className="pb-3 border-b border-white/5 bg-violet-500/[0.03]">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4 text-violet-500" />
                          Analysis Path
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {workflowSteps.map((step, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="h-5 w-5 rounded-full border border-violet-500/40 bg-violet-500/10 flex items-center justify-center text-[10px] text-violet-600 font-bold">
                                  {idx + 1}
                                </div>
                                {idx !== workflowSteps.length - 1 && <div className="w-px h-full bg-border/40 mt-1" />}
                              </div>
                              <div className="pb-2">
                                <p className="text-[12px] font-semibold leading-tight">{step.title}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{step.tool}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Resource Check */}
                  {totalCreditsUsed > 0 && (
                    <Card className="border-border/60 bg-card/40 backdrop-blur-md ring-1 ring-white/10">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Credits Consumed</span>
                          <span className="text-lg font-bold font-mono tracking-tighter text-primary">{totalCreditsUsed}</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/80" style={{ width: `${Math.min(100, (totalCreditsUsed/20)*100)}%` }} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] opacity-60 text-center">Resources enriched for this search</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
