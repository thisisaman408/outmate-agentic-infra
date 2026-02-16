"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Search, Sparkles, Users, Loader2, Plus, MessageSquare, Library, Copy, Download } from "lucide-react"
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
}

const CHAT_STORAGE_KEY = "nlp_enrichment_chats_v1"

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

  const queryInputRef = useRef<HTMLTextAreaElement>(null)

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
      extractedFilters: {}
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
  }

  const openChat = (chatId: string) => {
    const found = chats.find((c) => c.id === chatId)
    if (!found) return
    setActiveChatId(found.id)
    applySessionToView(found)
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

  const handleClarifyFilters = async () => {
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

    // Simple client-side intent detection based on keywords
    const queryLower = trimmedQuery.toLowerCase()
    const prospectKeywords = ['people', 'prospects', 'person', 'contacts', 'vp', 'ceo', 'cto', 'cfo', 'director', 'manager', 'engineer', 'developer', 'head of', 'chief']
    const companyKeywords = ['companies', 'business', 'businesses', 'firm', 'firms', 'organization', 'startup', 'startups', 'enterprise', 'enterprises', 'saas', 'b2b', 'b2c']
    
    const hasProspectKeyword = prospectKeywords.some(kw => queryLower.includes(kw))
    const hasCompanyKeyword = companyKeywords.some(kw => queryLower.includes(kw))
    
    // Determine intent
    let searchIntent: "business" | "prospect" = "business" // default
    if (hasProspectKeyword && !hasCompanyKeyword) {
      searchIntent = "prospect"
    } else if (hasCompanyKeyword && !hasProspectKeyword) {
      searchIntent = "business"
    }
    
    setIntent(searchIntent)

    // Enhanced filter extraction
    const extractedFilters: Record<string, any> = {}
    
    // Extract location with region support
    const locationPatterns = [
      // North America
      { pattern: /\b(north america|na)\b/i, values: ['United States', 'Canada', 'Mexico'] },
      { pattern: /\b(usa|us|united states|america)\b/i, values: ['United States'] },
      { pattern: /\bcanada\b/i, values: ['Canada'] },
      { pattern: /\bmexico\b/i, values: ['Mexico'] },
      
      // US States
      { pattern: /\b(texas|tx)\b/i, values: ['Texas'] },
      { pattern: /\b(california|ca)\b/i, values: ['California'] },
      { pattern: /\b(new york|ny)\b/i, values: ['New York'] },
      { pattern: /\b(florida|fl)\b/i, values: ['Florida'] },
      { pattern: /\b(illinois|il)\b/i, values: ['Illinois'] },
      { pattern: /\b(massachusetts|ma)\b/i, values: ['Massachusetts'] },
      { pattern: /\b(washington|wa)\b/i, values: ['Washington'] },
      
      // Other regions
      { pattern: /\b(europe|eu)\b/i, values: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy'] },
      { pattern: /\b(asia)\b/i, values: ['India', 'China', 'Singapore', 'Japan'] },
      { pattern: /\b(india)\b/i, values: ['India'] },
      { pattern: /\b(uk|united kingdom|britain)\b/i, values: ['United Kingdom'] },
    ]
    
    for (const { pattern, values } of locationPatterns) {
      if (pattern.test(queryLower)) {
        extractedFilters.location = values
        break // Use first match
      }
    }
    
    // Extract industry/company type
    const industryPatterns = [
      { pattern: /\b(b2b\s+)?(saas|software as a service)\b/i, values: ['Software'] },
      { pattern: /\bfintech\b/i, values: ['Financial Services', 'Fintech'] },
      { pattern: /\bhealthcare\b/i, values: ['Healthcare', 'Medical'] },
      { pattern: /\btechnology|tech\b/i, values: ['Technology', 'Software', 'IT Services'] },
      { pattern: /\bdigital agency|agencies\b/i, values: ['Marketing', 'Advertising'] },
      { pattern: /\bmarketing\b/i, values: ['Marketing', 'Advertising'] },
      { pattern: /\be-commerce|ecommerce\b/i, values: ['E-commerce', 'Retail'] },
      { pattern: /\bai|artificial intelligence|machine learning\b/i, values: ['Artificial Intelligence', 'Technology'] },
      { pattern: /\bconsulting\b/i, values: ['Consulting'] },
      { pattern: /\bmanufacturing\b/i, values: ['Manufacturing'] },
    ]
    
    for (const { pattern, values } of industryPatterns) {
      if (pattern.test(queryLower)) {
        extractedFilters.industry = values
        break
      }
    }
    
    // Extract company type
    if (/\bb2b\b/i.test(queryLower)) {
      extractedFilters.company_type = ['B2B']
    } else if (/\bb2c\b/i.test(queryLower)) {
      extractedFilters.company_type = ['B2C']
    }
    
    // Extract company size
    const sizePatterns = [
      { pattern: /(\d+)\s*-\s*(\d+)\s*(employees|people|staff)/i, range: true },
      { pattern: /(\d+)\s+to\s+(\d+)\s*(employees|people|staff)/i, range: true },
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
    
    // Extract keywords for free-text search
    const keywords = []
    if (/\bsaas\b/i.test(queryLower)) keywords.push('SaaS')
    if (/\bcloud\b/i.test(queryLower)) keywords.push('cloud')
    if (/\bai\b/i.test(queryLower)) keywords.push('AI')
    if (/\bdata\b/i.test(queryLower)) keywords.push('data')
    
    if (keywords.length > 0) {
      extractedFilters.keywords = keywords
    }

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
      {
        title: "Categorizing Intent",
        tool: "Keyword Matcher",
        endpoint: "client-side",
        input: { query: trimmedQuery },
        output: {
          intent: searchIntent,
          confidence: 0.8,
          is_relevant: true,
          reason: "Query analyzed client-side",
          extracted_filters: extractedFilters,
        },
      },
      {
        title: "Filter Clarification",
        tool: "Filter Parser",
        endpoint: "client-side",
        input: { query: trimmedQuery, filters: extractedFilters },
        output: {
          clarification_message: clarificationMessage,
          user_confirmation_required: true,
        },
      },
    ])

    setIsSearching(false)
  }

  const handleConfirmFilters = async () => {
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    setClarification("Starting search with your confirmed filters...")

    try {
      // Use different endpoints based on intent
      const endpoint = intent === "prospect" 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/prospects/search`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/leads/search/companies`;
      
      console.log('Calling endpoint:', endpoint, 'with filters:', latestExtractedFilters);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          intent === "prospect"
            ? { ...latestExtractedFilters, limit: 3 }
            : { filters: latestExtractedFilters, options: { limit: 3, page: 1, enrich: true } }
        ),
      });

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
      const searchIntent = intent
      setIntent(searchIntent);

      // Handle different response formats from different endpoints
      const rawList = intent === "prospect"
        ? (data.profiles || data.results?.data || data.data || [])
        : (data.data?.companies || data.companies || data.results?.data || data.data || []);
      
      console.log('Raw List:', rawList);
      console.log('Raw List Length:', Array.isArray(rawList) ? rawList.length : 'Not an array');
      
      const totalCount = intent === "prospect"
        ? (data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0))
        : (data.data?.total_count || data.total_count || data.results?.total_results || (Array.isArray(rawList) ? rawList.length : 0));

      const examples = buildExamples(trimmedQuery)
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
    } catch (error) {
      console.error("Search Error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      setClarification(`Sorry, I couldn't complete the search. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your backend is running at http://localhost:8000`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleNaturalSearch = async () => {
    const trimmedQuery = naturalLanguageQuery.trim()
    if (!trimmedQuery) return
    await handleClarifyFilters()
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
            NLP based Enrichment
          </CardTitle>
          <CardDescription>
            Use natural language to build your TAM and enrich companies or people.
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
                        className={`w-full rounded-md border p-2 text-left text-sm transition ${
                          activeChatId === chat.id
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
                <Sparkles className="h-5 w-5" />
                Describe Your Search
              </CardTitle>
              <CardDescription>
                Tell us what you're looking for in plain English
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                ref={queryInputRef}
                placeholder="e.g., Find marketing decision makers at digital agencies with 1-50 employees in Texas"
                value={naturalLanguageQuery}
                onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleNaturalSearch}
                  disabled={isSearching || !naturalLanguageQuery.trim()}
                  className="flex-1"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
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
              </CardHeader>
              <CardContent>
                {console.log('Rendering results - Intent:', intent, 'Results length:', results.length)}
                {intent === "prospect" ? (
                  <ProspectsResultsTable 
                    data={results} 
                    totalCount={tamPreview.count}
                    enableContactReveal={true}
                  />
                ) : (
                  <>
                    {console.log('About to render CompaniesResultsTable with', results.length, 'results')}
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

          {activeChatId && chats.find((c) => c.id === activeChatId)?.messages?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Chat History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {chats
                  .find((c) => c.id === activeChatId)
                  ?.messages.map((message, idx) => (
                    <div key={idx} className="rounded border p-2">
                      <div className="font-medium text-xs text-muted-foreground">
                        {message.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="text-sm">{message.content}</div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}

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