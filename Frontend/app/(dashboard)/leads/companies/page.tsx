"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Command,
  Bot,
  Zap,
  Bookmark,
  Target,
  Star,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Plus,
  Building2,
  Globe,
  MoreVertical,
  ArrowUpDown,
  Filter,
  Download,
  MapPin,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { NlpSearchBar } from "@/components/leads/nlp-search-bar"
import { authService } from "@/lib/auth"
import { toast } from "sonner"
import { CompaniesResultsTable } from "@/components/leads/companies/companies-results-table"
import type { CompanyData } from "@/components/leads/companies/companies-results-table"
import { enrichCompany } from "@/lib/services/betterContactService"
import { savedSearchesApi } from "@/lib/api/saved-searches"
import { aiAgentsApi, type ResearchResult, type PredictiveScore } from "@/lib/api/ai-agents"
import { unifiedDataService } from "@/lib/services/unified-data-service"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/* ─── filter data ─── */

interface FilterDef {
  icon: string
  label: string
  locked?: boolean
  tier?: "Growth" | "Scale"
  signalRow?: boolean
  chips?: string[]
  expanded?: boolean
  filterKey?: string // maps to backend filter key
  addable?: boolean  // whether user can add chips
  options?: string[] // predefined options/ranges
}

const unlockedFilters: FilterDef[] = [
  { icon: "\u{1F3E2}", label: "Company", expanded: true, chips: [], filterKey: "name", addable: true },
  { 
    icon: "\u{1F3F7}", label: "Industry & keywords", expanded: true, chips: [], filterKey: "industry", addable: true,
    options: ["Software", "SaaS", "E-commerce", "Healthcare", "Fintech", "Manufacturing", "Education", "Real Estate"]
  },
  { 
    icon: "\u{1F465}", label: "# Employees", filterKey: "company_size", addable: true,
    options: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "10001+"]
  },
  { 
    icon: "\u{1F4B5}", label: "Revenue range", filterKey: "revenue_range", addable: true,
    options: ["$0-$1M", "$1M-$10M", "$10M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B+"]
  },
  { 
    icon: "\u{1F4B0}", label: "Funding stage", expanded: true, chips: [], filterKey: "funding_stage", addable: true,
    options: ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "IPO", "Acquired"]
  },
  { icon: "\u2699\uFE0F", label: "Technologies", filterKey: "technologies", addable: true },
  { icon: "\u26A1", label: "Signals", signalRow: true },
  { icon: "\u{1F4CB}", label: "Job postings" },
]

const lockedFilters: FilterDef[] = [
  { icon: "\u{1F4C8}", label: "Headcount growth", locked: true, tier: "Growth" },
  { icon: "\u{1F3AF}", label: "Buying intent", locked: true, tier: "Growth" },
  { icon: "\u{1F4A1}", label: "Intent topics", locked: true, tier: "Growth" },
  { icon: "\u{1F441}", label: "Website visitors", locked: true, tier: "Growth" },
  { icon: "\u{1F916}", label: "AI filters", locked: true, tier: "Growth" },
  { icon: "\u2B50", label: "ICP fit score", locked: true, tier: "Growth" },
  { icon: "\u{1F4CA}", label: "Scores (composite)", locked: true, tier: "Scale" },
  { icon: "\u{1F517}", label: "Company lookalikes", locked: true, tier: "Scale" },
  { icon: "\u{1F9E0}", label: "Composite GTM score", locked: true, tier: "Scale" },
  { icon: "\u{1F5C2}", label: "SIC and NAICS", locked: true, tier: "Growth" },
  { icon: "\u{1F5FA}", label: "Territories", locked: true, tier: "Scale" },
  { icon: "\u{1F3E6}", label: "Parent accounts", locked: true, tier: "Scale" },
]

/* ─── helpers ─── */

const tierPill = (tier: "Growth" | "Scale") => {
  const cls = tier === "Growth" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
  return <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider", cls)}>{tier}</span>
}

const scoreBar = (score: number) => (
  <div className="flex items-center gap-1.5">
    <div className="w-[44px] h-[4px] rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
    </div>
    <span className="text-[10px] font-bold text-foreground">{score}</span>
  </div>
)

const intentDots = (n: number) => (
  <div className="flex items-center gap-[3px]">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className={cn("w-[6px] h-[6px] rounded-full", i <= n ? "bg-primary" : "bg-muted")} />
    ))}
  </div>
)

/* ─── broad / mega-corp exclusion list ─── */
const MEGA_CORPS = new Set([
  "google", "alphabet", "amazon", "microsoft", "apple", "meta", "facebook",
  "linkedin", "netflix", "tesla", "nvidia", "intel", "ibm", "oracle", "cisco",
  "samsung", "sony", "adobe", "salesforce", "uber", "airbnb", "spotify",
  "twitter", "x corp", "snap", "snapchat", "tiktok", "bytedance", "walmart",
  "jpmorgan", "jp morgan", "goldman sachs", "bank of america", "wells fargo",
  "morgan stanley", "citigroup", "hsbc", "disney", "comcast", "at&t",
  "verizon", "t-mobile", "coca-cola", "pepsi", "pepsico", "mcdonalds",
  "mcdonald's", "starbucks", "nike", "adidas", "procter & gamble",
  "johnson & johnson", "pfizer", "moderna", "visa", "mastercard", "paypal",
])

/** Remove mega-corps unless user explicitly searches for them */
function filterMegaCorps(companies: CompanyData[], filters: Record<string, any>): CompanyData[] {
  // If user typed a company name, don't exclude mega-corps
  if (filters.name) return companies
  
  // Filter out mega-corps by default
  return companies.filter(c => {
    const name = (c.name || "").toLowerCase().trim()
    return !MEGA_CORPS.has(name)
  })
}

/* ─── build backend filters from chips ─── */
function buildFiltersFromChips(chips: Record<string, string[]>): Record<string, any> {
  const filters: Record<string, any> = {}
  const filterKeyMap: Record<string, string> = {
    "Company": "name",
    "Industry & keywords": "industry",
    "# Employees": "company_size",
    "Revenue range": "revenue_range",
    "Funding stage": "funding_stage",
    "Technologies": "technologies",
  }
  for (const [label, values] of Object.entries(chips)) {
    if (values.length === 0) continue
    const key = filterKeyMap[label]
    if (!key) continue
    filters[key] = values.length === 1 ? values[0] : values
  }
  return filters
}

export default function CompaniesPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    Company: true,
    "Industry & keywords": true,
    "Funding stage": true,
  })
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    Company: [],
    "Industry & keywords": [],
    "Funding stage": [],
  })
  const [chipInputs, setChipInputs] = useState<Record<string, string>>({})
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [globalSearchQuery, setGlobalSearchQuery] = useState("")
  const [isSaveSearchOpen, setIsSaveSearchOpen] = useState(false)
  const [savedSearchName, setSavedSearchName] = useState("")
  const [isSavingSearch, setIsSavingSearch] = useState(false)
  const [savedSearchesCount, setSavedSearchesCount] = useState(0)
  const [revealedEmail, setRevealedEmail] = useState<Record<string, boolean>>({})
  const [revealedPhone, setRevealedPhone] = useState<Record<string, boolean>>({})
  
  // AI Actions State
  const [isResearchOpen, setIsResearchOpen] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null)
  
  const [isScoringOpen, setIsScoringOpen] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState<PredictiveScore[]>([])
  const router = useRouter()

  // Real Data State
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [enrichedData, setEnrichedData] = useState<Record<string, any>>({})
  const [enrichingRows, setEnrichingRows] = useState<Record<string, boolean>>({})
  const [waterfallAttempts, setWaterfallAttempts] = useState<Record<string, { email?: boolean; phone?: boolean }>>({})

  // Selection state — driven by the table's onSelectionChange callback
  const [selectedCompanies, setSelectedCompanies] = useState<CompanyData[]>([])
  const selectedCount = selectedCompanies.length

  // +AI Column toggle — shows extra computed columns (Signal, ICP Score, Intent, AI Brief)
  const [showAiColumns, setShowAiColumns] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Fetch saved searches count
    const fetchSavedSearchesCount = async () => {
      try {
        const savedSearches = await savedSearchesApi.list("company")
        setSavedSearchesCount(savedSearches.length)
      } catch (error) {
        console.error("Failed to fetch saved searches count:", error)
        setSavedSearchesCount(0)
      }
    }
    fetchSavedSearchesCount()
  }, [])

  // Map raw backend company data to CompanyData (same logic as AI Powered Search)
  const mapCompanyResults = useCallback((rawList: any[]): CompanyData[] => {
    return (Array.isArray(rawList) ? rawList : []).map((item: any) => {
      const raw = (item?.raw_data && typeof item.raw_data === "object") ? item.raw_data : {}
      const normalizeDomain = (v?: string) => {
        if (!v || typeof v !== "string") return ""
        return v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim()
      }
      const parseLocation = (v?: string) => {
        if (!v || typeof v !== "string") return { city: undefined, state: undefined, country: undefined }
        const parts = v.split(",").map(p => p.trim()).filter(Boolean)
        if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[2] }
        if (parts.length === 2) return { city: parts[0], state: undefined, country: parts[1] }
        return { city: parts[0], state: undefined, country: undefined }
      }
      const loc = parseLocation(item.location_display || item.location || item.headquarters_address || raw.location_display || raw.location || raw.headquarter)
      const domain = normalizeDomain(item.domain ?? item.website ?? raw.domain ?? raw.website ?? "")

      return {
        id: String(item.id ?? item.business_id ?? item.domain ?? ""),
        name: item.name ?? item.business_name ?? item.company_name ?? "",
        domain,
        website: item.website,
        logo_url: item.logo_url ?? item.business_logo ?? item.logo ?? (domain ? `https://logo.clearbit.com/${domain}` : undefined),
        description: item.description ?? item.company_description ?? item.business_description,
        industry: item.industry ?? item.linkedin_industry_category ?? item.primary_industry,
        sub_industry: item.sub_industry,
        linkedin_industry_category: item.linkedin_industry_category,
        company_type: item.company_type ?? item.business_type ?? item.type ?? raw.company_type,
        founded_year: item.founded_year ?? item.year_founded ?? item.founded_at ?? raw.founded_year,
        employee_count_exact: item.employee_count_exact ?? item.employee_count ?? item.size ?? raw.employee_count_exact ?? raw.size,
        employee_count_range: item.employee_count_range ?? item.employee_range ?? item.number_of_employees_range ?? item.company_size ?? item.size_range ?? raw.employee_count_range ?? raw.number_of_employees_range,
        revenue_exact: item.revenue_exact ?? item.yearly_revenue_exact ?? item.yearly_revenue ?? item.yearly_revenue_usd ?? item.revenue_usd ?? item.annual_revenue_usd ?? item.revenue ?? raw.revenue_exact ?? raw.revenue,
        revenue_range: item.revenue_range ?? item.yearly_revenue_range ?? item.estimated_revenue_range ?? raw.revenue_range,
        funding_stage: item.funding_stage ?? item.last_funding_round_type,
        funding_total: item.funding_total ?? item.known_funding_total_value ?? item.total_funding_usd,
        last_funding_date: item.last_funding_date ?? item.last_funding_round_date,
        has_recent_funding: item.has_recent_funding ?? (item.last_funding_date ? new Date(item.last_funding_date) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) : false),
        investors: Array.isArray(item.investors) ? item.investors : [],
        investors_count: item.investors_count ?? (Array.isArray(item.investors) ? item.investors.length : undefined),
        headquarters_country: item.headquarters_country ?? item.country_name ?? item.country ?? raw.headquarters_country ?? loc.country,
        headquarters_state: item.headquarters_state ?? item.region_name ?? item.state ?? raw.headquarters_state ?? loc.state,
        headquarters_city: item.headquarters_city ?? item.city_name ?? item.city ?? raw.headquarters_city ?? loc.city,
        headquarters_address: item.headquarters_address ?? item.hq_address ?? item.location_display ?? item.location ?? raw.headquarter ?? raw.headquarters_address,
        location_display: item.location_display ?? item.location ?? raw.location_display ?? raw.location,
        street: item.street,
        zip_code: item.zip_code ?? item.zip ?? raw.zip_code,
        locations: Array.isArray(item.locations) ? item.locations : [],
        locations_distribution_count: item.locations_distribution_count,
        number_of_locations: item.number_of_locations,
        phone: Array.isArray(item.phone) ? item.phone.join(", ") : item.phone,
        email: Array.isArray(item.email) ? item.email.join(", ") : item.email,
        personal_email: item.personal_email,
        work_email: item.work_email,
        linkedin_url: item.linkedin_url ?? item.company_linkedin_url ?? item.linkedin_profile_url ?? raw.linkedin_url,
        twitter_url: item.twitter_url,
        facebook_url: item.facebook_url,
        instagram_url: item.instagram_url,
        follower_count: item.follower_count ?? item.linkedin_followers,
        technologies: Array.isArray(item.technologies) && item.technologies.length > 0
          ? item.technologies
          : Array.isArray(item.specialties) && item.specialties.length > 0
            ? item.specialties
            : Array.isArray(item.full_tech_stack) && item.full_tech_stack.length > 0
              ? item.full_tech_stack
              : Array.isArray(raw.technologies) ? raw.technologies
              : Array.isArray(raw.specialties) ? raw.specialties
              : (raw.seo?.technologies ? raw.seo.technologies : (raw.taxonomy?.technologies ?? [])),
        is_tech_heavy: item.is_tech_heavy ?? (
          (Array.isArray(item.technologies) && item.technologies.length > 3)
          || (Array.isArray(item.specialties) && item.specialties.length > 3)
        ),
        employee_growth_6m: item.employee_growth_6m,
        employee_growth_12m: item.employee_growth_12m,
        employee_growth_6m_percent: item.employee_growth_6m_percent ?? raw.employee_growth_6m_percent,
        employee_growth_12m_percent: item.employee_growth_12m_percent ?? raw.employee_growth_12m_percent,
        growth_category: item.growth_category,
        job_openings_count: item.job_openings_count
          ?? (Array.isArray(item.job_openings) ? item.job_openings.length : undefined)
          ?? (typeof item.job_openings === "object" && item.job_openings?.total ? item.job_openings.total : undefined)
          ?? (Array.isArray(raw.job_openings) ? raw.job_openings.length : undefined),
        web_traffic: item.web_traffic ?? raw.web_traffic ?? raw.web_traffic_data?.monthly_visits,
        seo_score: item.seo_score,
        decision_makers_count: item.decision_makers_count,
        acquisition_status: item.acquisition_status,
        data_quality_score: item.data_quality_score ?? item.quality_score ?? raw.data_quality_score,
        enriched: item.enriched ?? false,
        last_raised_amount: item.last_raised_amount,
        market_cap: item.market_cap,
        fiscal_year_end: item.fiscal_year_end,
        ticker: item.ticker,
        stock_symbol: item.stock_symbol,
      } as CompanyData
    })
  }, [])

  const searchWithFilters = useCallback(async (filters: Record<string, any>) => {
    if (Object.keys(filters).length === 0) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      // Use unified data service with Brightdata integration and fallback
      const result = await unifiedDataService.searchCompaniesWithRetry(filters, {
        useBrightdata: true,
        enableFallback: true,
        timeout: 15000 // 15 seconds timeout
      }, 2) // 2 retries

      // Transform data to match expected format
      const transformedCompanies = result.data.map(company => ({
        id: company.id,
        name: company.name,
        domain: company.domain,
        description: company.description,
        industry: company.industry,
        size: company.size,
        location: company.location,
        founded: company.founded,
        website: company.website,
        linkedin: company.linkedin,
        funding: company.funding,
        revenue: company.revenue,
        // Add any other necessary field mappings
      }))

      setCompanies(filterMegaCorps(mapCompanyResults(transformedCompanies), filters))
      
      // Show data source info to user
      if (result.source === 'brightdata') {
        console.log('✅ Companies data from Brightdata dataset')
      } else {
        console.log('🔄 Companies data from fallback API')
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Search when filter chips change
  useEffect(() => {
    const filters = buildFiltersFromChips(filterChips)
    if (Object.keys(filters).length > 0) {
      searchWithFilters(filters)
    }
  }, [filterChips, searchWithFilters])

  // NLP search handler
  const handleNlpSearch = async (filters: Record<string, any>) => {
    setIsLoading(true)
    setHasSearched(true)
    setCompanies([])
    try {
      // Use unified data service with Brightdata integration and fallback
      const result = await unifiedDataService.searchCompaniesWithRetry(filters, {
        useBrightdata: true,
        enableFallback: true,
        timeout: 15000 // 15 seconds timeout
      }, 2) // 2 retries

      // Transform data to match expected format
      const transformedCompanies = result.data.map(company => ({
        id: company.id,
        name: company.name,
        domain: company.domain,
        description: company.description,
        industry: company.industry,
        size: company.size,
        location: company.location,
        founded: company.founded,
        website: company.website,
        linkedin: company.linkedin,
        funding: company.funding,
        revenue: company.revenue,
        // Add any other necessary field mappings
      }))

      setCompanies(filterMegaCorps(mapCompanyResults(transformedCompanies), filters))
      
      // Show data source info to user
      if (result.source === 'brightdata') {
        toast.success('AI Search completed using Brightdata dataset')
      } else {
        toast.info('AI Search completed using fallback API')
      }
    } catch (e: any) {
      toast.error(e.message || "AI Search failed")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFilter = (label: string) => {
    setExpandedFilters((p) => ({ ...p, [label]: !p[label] }))
  }

  const removeChip = (filter: string, chip: string) => {
    setFilterChips((p) => ({ ...p, [filter]: (p[filter] || []).filter((c) => c !== chip) }))
  }

  const addChip = (filter: string, chip: string) => {
    if (!chip.trim()) return
    setFilterChips((p) => {
      const existing = p[filter] || []
      if (existing.includes(chip.trim())) return p
      return { ...p, [filter]: [...existing, chip.trim()] }
    })
    setChipInputs((p) => ({ ...p, [filter]: "" }))
  }

  const toggleRow = (id: string) => {
    setSelectedRows((p) => ({ ...p, [id]: !p[id] }))
  }

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies
    return companies.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.industry && c.industry.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [companies, searchQuery])

  const handleExport = () => {
    if (filteredCompanies.length === 0) return
    const headers = ["Company", "Industry", "Employees", "Location", "Score", "Email", "LinkedIn"]
    const rows = filteredCompanies.map((c) => [
      c.name, c.industry || "", c.employee_count_range || "", c.location_display || "", String(c.data_quality_score || 0), c.email || "", c.linkedin_url || ""
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `companies_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredCompanies.length} companies to CSV`)
  }

  const activeFilterCount = Object.values(filterChips).filter((v) => v.length > 0).length

  const handleSaveSearch = async () => {
    if (!savedSearchName.trim()) {
      toast.error("Please enter a name for your search")
      return
    }

    setIsSavingSearch(true)
    try {
      const filters = buildFiltersFromChips(filterChips)
      await savedSearchesApi.create({
        name: savedSearchName,
        search_type: "company",
        filters,
        nlp_query: globalSearchQuery || undefined
      })
      toast.success("Search saved successfully")
      setIsSaveSearchOpen(false)
      setSavedSearchName("")
      // Update saved searches count
      setSavedSearchesCount(prev => prev + 1)
    } catch (error: any) {
      toast.error(error.message || "Failed to save search")
    } finally {
      setIsSavingSearch(false)
    }
  }

  const handleAddToCRM = async () => {
    if (selectedCompanies.length === 0) {
      toast.info("Select companies to push to CRM")
      return
    }
    
    try {
      // Convert companies to CRM format
      const crmData = selectedCompanies.map(company => ({
        name: company.name,
        domain: company.domain,
        website: company.website,
        industry: company.industry,
        size: company.employee_count_range || company.employee_count_exact,
        location: `${company.headquarters_city || ''}, ${company.headquarters_state || ''}`.trim(),
        revenue: company.revenue_range,
        funding: company.funding_stage,
        description: company.description
      }))
      
      // Call CRM API (you'll need to implement this endpoint)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/crm/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ companies: crmData })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to push to CRM: ${response.status}`)
      }
      
      toast.success(`Pushed ${selectedCompanies.length} companies to CRM`)
      setSelectedCompanies([]) // Clear selection after successful push
    } catch (error: any) {
      toast.error(error.message || "Failed to push companies to CRM")
    }
  }

  const handleRevealField = async (companyId: string, field: 'email' | 'phone') => {
    const company = companies.find(c => (c.domain || c.id) === companyId)
    if (!company) return
    
    setEnrichingRows((prev: Record<string, boolean>) => ({ ...prev, [companyId]: true }))
    try {
      // Use the actual enrichment service
      const result = await enrichCompany(company.name, company.domain, field)
      
      // Update enriched data cache
      setEnrichedData(prev => ({
        ...prev,
        [companyId]: {
          ...prev[companyId],
          [field]: result
        }
      }))
      
      // Update revealed state
      if (field === 'email') {
        setRevealedEmail((prev: Record<string, boolean>) => ({ ...prev, [companyId]: true }))
      } else {
        setRevealedPhone((prev: Record<string, boolean>) => ({ ...prev, [companyId]: true }))
      }
    } catch (error: any) {
      console.error(`Failed to reveal ${field} for ${companyId}:`, error)
      toast.error(`Failed to get ${field}: ${error?.message || 'Unknown error'}`)
    } finally {
      setEnrichingRows((prev: Record<string, boolean>) => ({ ...prev, [companyId]: false }))
    }
  }

  const handleResearch = async () => {
    if (selectedCompanies.length === 0) {
      toast.error("Please select at least one company to research")
      return
    }
    const company = selectedCompanies[0]
    setIsResearchOpen(true)
    setResearching(true)
    setResearchResult(null)
    try {
      const result = await aiAgentsApi.researchCompany(company.name, "standard")
      setResearchResult(result)
    } catch (error: any) {
      toast.error(error.message || "Research failed")
      setIsResearchOpen(false)
    } finally {
      setResearching(false)
    }
  }

  const handleEnrichAll = async () => {
    if (companies.length === 0) {
      toast.info("No companies to enrich")
      return
    }
    
    try {
      // Start enrichment for all companies
      const enrichPromises = companies.map(async (company) => {
        const companyId = company.domain || company.id
        try {
          // Enrich email
          await handleRevealField(companyId, 'email')
          // Enrich phone
          await handleRevealField(companyId, 'phone')
        } catch (error) {
          console.error(`Failed to enrich company ${companyId}:`, error)
        }
      })
      
      await Promise.allSettled(enrichPromises)
      toast.success(`Queued ${companies.length} companies for enrichment`)
    } catch (error: any) {
      toast.error(error.message || "Failed to start enrichment")
    }
  }

  const handleAutoScore = async () => {
    if (selectedCompanies.length === 0) {
      toast.error("Please select at least one company to score")
      return
    }
    setIsScoringOpen(true)
    setScoring(true)
    setScores([])
    try {
      const results: PredictiveScore[] = []
      for (const company of selectedCompanies.slice(0, 5)) {
        const scoreResults = await aiAgentsApi.scoreLeads({ 
          name: company.name, 
          domain: company.domain,
          industry: company.industry,
          country: company.headquarters_country
        })
        results.push(...scoreResults)
      }
      setScores(results)
      toast.success("Auto-scoring complete")
    } catch (error: any) {
      toast.error(error.message || "Scoring failed")
    } finally {
      setScoring(false)
    }
  }

  const handleRunAgent = async () => {
    if (selectedCompanies.length === 0) {
      toast.error("Please select at least one company first")
      return
    }
    const company = selectedCompanies[0]
    setIsResearchOpen(true)
    setResearching(true)
    setResearchResult(null)
    toast.info(`Running AI agent on ${selectedCompanies.length} compan${selectedCompanies.length > 1 ? 'ies' : 'y'}...`)
    try {
      const result = await aiAgentsApi.researchCompany(company.name, "deep")
      setResearchResult(result)
      toast.success("AI agent completed research")
    } catch (error: any) {
      toast.error(error.message || "Agent run failed")
      setIsResearchOpen(false)
    } finally {
      setResearching(false)
    }
  }

  const handleCreateWorkflow = () => {
    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id])
    router.push(`/workflow-canvas?source=leads${selectedIds.length > 0 ? `&ids=${selectedIds.join(",")}` : ""}`)
  }

  if (!mounted) return null

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Filter Sidebar */}
      <aside className="w-[260px] min-w-[260px] h-full flex flex-col bg-card border-r border-border shadow-sm">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search companies..."
              className="pl-9 h-9 bg-muted/40 border-transparent focus:bg-background transition-all text-xs font-medium rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-2">
          {([
            ["total", "Total", companies.length > 0 ? companies.length.toLocaleString() : "0"],
            ["new", "Net New", hasSearched ? filteredCompanies.length.toLocaleString() : "0"],
            ["saved", "Saved", savedSearchesCount.toLocaleString()],
          ] as const).map(([key, label, num]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                "flex-1 flex flex-col items-center py-3 relative transition-all",
                activeTab === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[14px] font-bold tracking-tight">{num}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">{label}</span>
              {activeTab === key && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Filters Scroll Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {unlockedFilters.map((f) => {
            const isExpanded = expandedFilters[f.label]
            const chips = filterChips[f.label] || []
            const hasChips = chips.length > 0
            return (
              <div key={f.label} className="border-b border-border/40 last:border-0">
                <button
                  onClick={() => f.addable ? toggleFilter(f.label) : undefined}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-3 text-left transition-all hover:bg-muted/20",
                    f.signalRow ? "text-primary" : "text-foreground"
                  )}
                >
                  <span className="flex-1 text-[13px] font-semibold">{f.label}</span>
                  {hasChips && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                      {chips.length}
                    </span>
                  )}
                  {f.addable && (
                    isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-40" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                  )}
                </button>
                {isExpanded && f.addable && (
                  <div className="px-4 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 block">Include</span>

                    {/* Selected chips */}
                    {hasChips && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {chips.map((c) => (
                          <span
                            key={c}
                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary"
                          >
                            {c}
                            <button onClick={() => removeChip(f.label, c)} className="hover:text-foreground ml-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Predefined options (hide already selected) */}
                    {f.options && f.options.filter(opt => !chips.includes(opt)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {f.options.filter(opt => !chips.includes(opt)).map(opt => (
                          <button
                            key={opt}
                            onClick={() => addChip(f.label, opt)}
                            className="text-[10px] font-medium px-2 py-1 rounded-md border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground bg-background transition-all"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Text Input */}
                    <div className="flex gap-1 mt-1">
                      <Input
                        placeholder={`Add ${f.label.toLowerCase()}...`}
                        className="h-7 text-[10px] bg-background"
                        value={chipInputs[f.label] || ""}
                        onChange={(e) => setChipInputs((p) => ({ ...p, [f.label]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addChip(f.label, chipInputs[f.label] || "")
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => addChip(f.label, chipInputs[f.label] || "")}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <Separator className="my-1" />
          {lockedFilters.map((f) => (
            <Popover key={f.label}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-2 px-4 py-3 text-left border-b border-border/30 hover:bg-muted/20 transition-all">
                  <span className="flex-1 text-[13px] font-semibold text-muted-foreground">{f.label}</span>
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/30" />
                  {f.tier && tierPill(f.tier)}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-[240px] p-4 shadow-2xl border-border rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">Requires {f.tier} plan</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed mb-4">
                  Unlock advanced {f.label.toLowerCase()} filtering to identify your most profitable accounts.
                </p>
                <Button className="w-full h-9 text-[11px] font-bold bg-primary text-primary-foreground">Upgrade Portfolio</Button>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-card">
          <button
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setFilterChips({})
              setCompanies([])
              setHasSearched(false)
            }}
          >
            Clear all {activeFilterCount > 0 ? `· ${activeFilterCount}` : ""}
          </button>
          <button className="text-[11px] font-semibold text-primary hover:underline">More Filters</button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Action Bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
          <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/50 border border-border/50 group focus-within:border-primary/50 transition-all">
            <Search className="w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
            <input
              placeholder="Search across Outmate..."
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && globalSearchQuery.trim()) {
                  handleNlpSearch({ query: globalSearchQuery.trim() })
                }
              }}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 font-sans text-[10px] font-bold text-muted-foreground bg-card border border-border rounded opacity-100">
               ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-9 px-3 gap-2 text-[11px] font-bold transition-all", selectedCount > 0 ? "hover:bg-primary/5 hover:text-primary" : "opacity-50 cursor-not-allowed")}
              onClick={handleResearch}
              disabled={selectedCount === 0}
              title={selectedCount === 0 ? "Select companies first" : undefined}
            >
              <Bot className="w-4 h-4" />
              Research with AI{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all"
              onClick={handleCreateWorkflow}
            >
              <Zap className="w-4 h-4" /> Create workflow
            </Button>
            <Dialog open={isSaveSearchOpen} onOpenChange={setIsSaveSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all">
                  <Bookmark className="w-4 h-4" /> Save search
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Save Search</DialogTitle>
                  <DialogDescription>
                    Give your search a name to easily access it later from the "Saved" tab.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="name" className="text-sm font-medium">Name</label>
                    <Input
                      id="name"
                      value={savedSearchName}
                      onChange={(e) => setSavedSearchName(e.target.value)}
                      placeholder="e.g. Series A Fintechs in NY"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSaveSearchOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveSearch} disabled={isSavingSearch}>
                    {isSavingSearch ? "Saving..." : "Save Search"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-9 px-3 gap-2 text-[11px] font-bold transition-all", selectedCount > 0 ? "hover:bg-primary/5 hover:text-primary" : "opacity-50 cursor-not-allowed")}
              onClick={handleAutoScore}
              disabled={selectedCount === 0}
              title={selectedCount === 0 ? "Select companies first" : undefined}
            >
              <Target className="w-4 h-4" />
              Auto-Score{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button 
              className={cn("h-10 px-5 gap-2 text-[11px] font-black transition-all active:scale-95", selectedCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed")}
              onClick={handleRunAgent}
              disabled={selectedCount === 0}
              title={selectedCount === 0 ? "Select companies to run agent" : undefined}
            >
              {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {selectedCount > 0 ? `Run Agent (${selectedCount})` : "Run Agent"}
            </Button>
          </div>
        </div>

        {/* NLP Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Search</span>
            <span className="text-xs text-muted-foreground">Describe the companies you&apos;re looking for in plain English</span>
          </div>
          <NlpSearchBar intent="company" onFiltersExtracted={handleNlpSearch} />
        </div>

        {/* Summary Stats + Actions Bar */}
        {hasSearched && (
          <div className="px-6 py-2 border-b border-border bg-muted/5">
            <div className="flex items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">{companies.length.toLocaleString()}</span>
                <span>companies</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="font-semibold text-foreground">{filteredCompanies.length.toLocaleString()}</span>
                <span>net new</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="font-semibold text-foreground">{activeFilterCount}</span>
                <span>filters active</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedCount}</span> selected
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedCount}</span> W selected
                </span>
                <span className="text-border">·</span>
                <button
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleExport}
                >
                  Export CSV
                </button>
                <button
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleAddToCRM}
                >
                  Push to CRM
                </button>
                <button
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleEnrichAll}
                >
                  Enrich all
                </button>
                <button
                  className={cn("text-[12px] font-medium transition-colors", showAiColumns ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => {
                    setShowAiColumns(prev => !prev)
                    toast.success(showAiColumns ? "AI columns hidden" : "AI columns visible: Signal, ICP Score, Intent, AI Brief")
                  }}
                >
                  {showAiColumns ? "− AI column" : "+ AI column"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Area */}
        <div className="flex-1 overflow-auto no-scrollbar">
          {!hasSearched && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Search for companies</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Use the filters on the left or the AI search bar above to find companies matching your criteria.
              </p>
            </div>
          ) : (
            <CompaniesResultsTable
              companies={filteredCompanies}
              isLoading={isLoading}
              hasSearched={hasSearched}
              showAiColumns={showAiColumns}
              tableId="companies-page-v4"
              onEnrichReveal={async (companyId, field) => {
                if (enrichedData[companyId]?.[field] || enrichingRows[companyId]) return
                const company = filteredCompanies.find((c) => (c.domain || c.id) === companyId)
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
                      ? { email: data.email || undefined, phone: data.phone || undefined }
                      : {}
                ])
              )}
              enrichingRows={enrichingRows}
              waterfallAttempts={waterfallAttempts}
              onSelectionChange={setSelectedCompanies}
            />
          )}
        </div>

        {/* Research Dialog */}
        <Dialog open={isResearchOpen} onOpenChange={setIsResearchOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                AI Research Report
              </DialogTitle>
            </DialogHeader>
            {researching ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Analyzing company data across the web...</p>
              </div>
            ) : researchResult ? (
              <div className="space-y-6 py-4">
                <div>
                  <h3 className="text-lg font-bold mb-1">{researchResult.companyName}</h3>
                  <p className="text-sm text-muted-foreground">{researchResult.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">Insights</h4>
                    <ul className="space-y-1">
                      {researchResult.keyInsights.slice(0, 4).map((insight, i) => (
                        <li key={i} className="text-xs font-medium list-disc ml-4">{insight}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">Opportunities</h4>
                    <ul className="space-y-1">
                      {researchResult.opportunities.slice(0, 4).map((opp, i) => (
                        <li key={i} className="text-xs font-medium list-disc ml-4">{opp}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={() => setIsResearchOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Auto-Score Dialog */}
        <Dialog open={isScoringOpen} onOpenChange={setIsScoringOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                AI Propensity Scoring
              </DialogTitle>
            </DialogHeader>
            {scoring ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Calculating match scores for selected leads...</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {scores.map((score, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div>
                      <div className="text-sm font-bold">{score.companyName}</div>
                      <div className="text-[10px] text-muted-foreground">{score.recommendation}</div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-lg font-black",
                        score.score > 70 ? "text-green-500" : score.score > 40 ? "text-amber-500" : "text-red-500"
                      )}>
                        {score.score}%
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider opacity-50">{score.prediction} fit</div>
                    </div>
                  </div>
                ))}
                {scores.length === 0 && !scoring && (
                  <p className="text-center py-4 text-sm text-muted-foreground">No scores available.</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsScoringOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
