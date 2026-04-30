"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Plus,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  Bot,
  Bookmark,
  BookmarkPlus,
  Star,
  Play,
  Settings,
  Mic,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  UserCircle,
  Building2,
  Mail,
  Linkedin,
  MapPin,
  Briefcase,
  Sparkles,
  Download,
  Zap,
  Loader2,
  Database,
  Globe,
  Target,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { searchProspects, type ProspectProfile, type ProspectSearchFilters } from "@/lib/services/prospectService"
import { unifiedDataService } from "@/lib/services/unified-data-service"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { ProspectsResultsTable } from "@/components/leads/prospects/prospects-results-table"
import { integrationsApi } from "@/lib/api/integrations"
import { savedSearchesApi } from "@/lib/api/saved-searches"
import { aiAgentsApi, type ResearchResult, type PredictiveScore } from "@/lib/api/ai-agents"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { useRouter } from "next/navigation"

/* ─── types ─── */

interface FilterDef {
  label: string
  locked?: boolean
  tier?: "Starter" | "Growth" | "Scale"
  signalRow?: boolean
  chips?: string[]
  expanded?: boolean
  options?: string[]
  category?: string
  advancedOptions?: { label: string; description: string }[]
}

/* ─── filter data ─── */

const unlockedFilters: FilterDef[] = [
  /* ── Identity ── */
  {
    label: "Current title",
    category: "Identity",
    options: [
      "VP Sales",
      "Head of Growth",
      "CRO",
      "Director of Sales",
      "Account Executive",
      "SDR Manager",
      "CMO",
      "Head of Marketing",
      "RevOps Lead",
      "BDR Manager",
    ],
  },
  {
    label: "Company",
    category: "Identity",
    options: [],
  },
  {
    label: "Seniority level",
    category: "Identity",
    options: ["C-suite", "VP", "Director", "Senior IC", "Manager", "IC", "Founder"],
  },

  /* ── Identity Header Section ── */
  {
    label: "Name",
    category: "Identity Header",
    options: [],
    advancedOptions: [
      { label: "Exact match", description: "Only show exact name matches" },
      { label: "Exclude contacts", description: "Exclude already contacted people" },
    ],
  },
  {
    label: "Current title",
    category: "Identity Header",
    options: [
      "VP Sales",
      "Head of Growth",
      "CRO",
      "Director of Sales",
      "Account Executive",
      "SDR Manager",
      "CMO",
      "Head of Marketing",
      "RevOps Lead",
      "BDR Manager",
    ],
    advancedOptions: [
      { label: "Include similar titles", description: "Match related job titles automatically" },
      { label: "Exclude past titles", description: "Don't match on previous positions" },
    ],
  },
  {
    label: "Past Title",
    category: "Identity Header",
    options: ["VP Sales", "Head of Growth", "CRO", "Director of Sales", "Account Executive", "CMO", "Head of Marketing", "RevOps Lead"],
    advancedOptions: [
      { label: "Within last 2 years", description: "Only titles held in the last 2 years" },
    ],
  },
  {
    label: "Seniority level",
    category: "Identity Header",
    options: ["C-suite", "VP", "Director", "Senior IC", "Manager", "IC", "Founder"],
    advancedOptions: [
      { label: "Include one level up/down", description: "Broaden to adjacent seniority" },
    ],
  },
  {
    label: "Function / department",
    category: "Identity Header",
    options: ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "Customer Success", "Design"],
    advancedOptions: [
      { label: "Cross-functional", description: "Include people spanning multiple departments" },
    ],
  },

  /* ── Location ── */
  {
    label: "Location",
    category: "Location",
    options: ["United States", "United Kingdom", "Germany", "France", "Canada", "Australia", "New York", "San Francisco", "London", "Berlin", "Austin", "Boston", "Chicago", "Toronto", "Paris", "Singapore"],
    advancedOptions: [
      { label: "Include remote", description: "Include remote workers based in region" },
      { label: "HQ location only", description: "Match company HQ, not person location" },
    ],
  },

  /* ── Experience Header Section ── */
  {
    label: "Total years of experience",
    category: "Experience Header",
    options: ["0-2 years", "3-5 years", "6-10 years", "11-15 years", "16-20 years", "20+ years"],
    advancedOptions: [
      { label: "Industry-specific", description: "Count only years in selected industry" },
    ],
  },
  {
    label: "Years at company",
    category: "Experience Header",
    options: ["< 1 year", "1-2 years", "3-5 years", "5-10 years", "10+ years"],
  },
  {
    label: "Years in current role",
    category: "Experience Header",
    options: ["< 6 months", "6-12 months", "1-2 years", "2-5 years", "5+ years"],
  },

  /* ── Contact Section ── */
  {
    label: "Email status",
    category: "Contact",
    options: ["Verified", "Unverified", "Invalid", "Catch-all", "No email"],
    advancedOptions: [
      { label: "Verified only", description: "Strictly show verified emails" },
    ],
  },
  {
    label: "Phone status",
    category: "Contact",
    options: ["Direct dial", "Mobile", "HQ number", "No phone"],
  },
  {
    label: "Source",
    category: "Contact",
    options: ["LinkedIn", "Website", "Referral", "Cold outbound", "Inbound", "Event", "Partner", "Import", "API", "Chrome Extension"],
  },

  /* ── CRM Section ── */
  {
    label: "Owner",
    category: "CRM",
    options: ["Me", "Unassigned", "Team A", "Team B", "All owners"],
  },
  {
    label: "Stage",
    category: "CRM",
    options: ["New", "Contacted", "Qualified", "Meeting booked", "Opportunity", "Customer", "Disqualified", "Nurture"],
    advancedOptions: [
      { label: "Exclude converted", description: "Hide already converted leads" },
    ],
  },
  {
    label: "Last activity",
    category: "CRM",
    options: ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "No activity", "More than 90 days ago"],
  },
  {
    label: "Keyword",
    category: "CRM",
    options: ["SaaS", "B2B", "AI/ML", "Fintech", "DevTools", "Cybersecurity", "E-commerce", "Cloud Infrastructure", "PLG", "Enterprise Sales"],
  },

  /* ── Profile Language ── */
  {
    label: "Profile language",
    category: "Location",
    options: ["English", "Spanish", "French", "German", "Portuguese", "Chinese", "Japanese"],
    advancedOptions: [
      { label: "Primary language only", description: "Exclude secondary languages" },
    ],
  },

  ]

const signalFilters: FilterDef[] = [
  { label: "Signals", signalRow: true, expanded: true, chips: ["Job change signal", "Promotion signal", "New hire"] },
  { label: "Job change signal", signalRow: true },
  { label: "Promotion signal", signalRow: true },
  { label: "Champion tracker", signalRow: true },
]

const lockedFilters: FilterDef[] = [
  { label: "# Employees (company)", locked: true, tier: "Starter" },
  { label: "Revenue", locked: true, tier: "Starter" },
  { label: "Funding", locked: true, tier: "Starter" },
  { label: "Technologies", locked: true, tier: "Starter" },
  { label: "Job Postings", locked: true, tier: "Starter" },
  { label: "Market Segments", locked: true, tier: "Starter" },
  { label: "Industry & keywords", locked: true, tier: "Starter" },
  { label: "Buying intent", locked: true, tier: "Growth" },
  { label: "Intent topics", locked: true, tier: "Growth" },
  { label: "Website visitors", locked: true, tier: "Growth" },
  { label: "Headcount growth", locked: true, tier: "Growth" },
  { label: "ICP fit score", locked: true, tier: "Growth" },
  { label: "People lookalikes", locked: true, tier: "Growth" },
  { label: "AI filters", locked: true, tier: "Growth" },
  { label: "Composite GTM score", locked: true, tier: "Scale" },
  { label: "Buying group signals", locked: true, tier: "Scale" },
  { label: "Territories", locked: true, tier: "Scale" },
  { label: "AI custom filter", locked: true, tier: "Scale" },
  { label: "Awards and certifications", locked: true, tier: "Scale" },
]

/* ─── helpers ─── */

const tierPill = (tier: "Starter" | "Growth" | "Scale") => {
  const cls =
    tier === "Starter" ? "bg-amber-500/20 text-amber-600" : tier === "Growth" ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-600"
  return <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider inline-flex items-center gap-1", cls)}><Lock className="w-2.5 h-2.5" />{tier}</span>
}

const scoreBar = (score: number) => (
  <div className="flex items-center gap-1.5">
    <div className="w-[38px] h-[4px] rounded-full bg-muted overflow-hidden">
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

/* ─── Filter Panel ─── */

function UnlockedFilterPanel({
  filter,
  isExpanded,
  chips,
  onToggle,
  onAddChip,
  onRemoveChip,
}: {
  filter: FilterDef
  isExpanded: boolean
  chips: string[]
  onToggle: () => void
  onAddChip: (val: string) => void
  onRemoveChip: (chip: string) => void
}) {
  const [search, setSearch] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const hasChips = chips.length > 0
  const options = filter.options || []
  const advOpts = filter.advancedOptions || []

  const filtered = useMemo(() => {
    const available = options.filter((o) => !chips.includes(o))
    if (!search.trim()) return available
    return available.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
  }, [options, chips, search])

  const addOption = (val: string) => {
    if (!chips.includes(val)) onAddChip(val)
    setSearch("")
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 h-11 text-left transition-all hover:bg-muted/30",
          hasChips ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex-1 text-[12px] font-bold tracking-tight">{filter.label}</span>
        {hasChips && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{chips.length}</span>}
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1.5 bg-muted/20">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border mb-3 focus-within:border-primary/50 transition-all">
            <Search className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={2.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={filter.label === "Name" ? "Search name..." : filter.label === "Current title" ? "Search current title..." : filter.label === "Past Title" ? "Search past title..." : filter.label === "Seniority level" ? "Search seniority level..." : filter.label === "Function / department" ? "Search function / department..." : filter.label === "Location" ? "Search location..." : filter.label === "Profile language" ? "Search profile language..." : filter.label === "Total years of experience" ? "Search total years of experience..." : filter.label === "Years at company" ? "Search years at company..." : filter.label === "Years in current role" ? "Search years in current role..." : filter.label === "Email status" ? "Search email status..." : filter.label === "Phone status" ? "Search phone status..." : filter.label === "Source" ? "Search source..." : filter.label === "Owner" ? "Search owner..." : filter.label === "Stage" ? "Search stage..." : filter.label === "Last activity" ? "Search last activity..." : filter.label === "Keyword" ? "Search keyword..." : "Quick search..."}
              className="flex-1 bg-transparent text-[11px] font-bold text-foreground placeholder:text-muted-foreground/40 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  addOption(search.trim())
                }
              }}
            />
          </div>

          {hasChips && (
            <div className="mb-3">
              <div className="text-[9px] uppercase font-black tracking-widest mb-2 text-muted-foreground/50">Selected</div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                  >
                    {c}
                    <button onClick={() => onRemoveChip(c)} className="opacity-60 hover:opacity-100">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={onToggle}
                className="mt-2 text-[10px] font-bold text-primary/70 hover:text-primary transition-colors"
              >
                ADD MORE
              </button>
            </div>
          )}

          {filtered.length > 0 && filter.label !== "Current title" && filter.label !== "Seniority level" && (
            <div>
              <div className="text-[9px] uppercase font-black tracking-widest mb-2 text-muted-foreground/50">Options</div>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-0.5">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => addOption(opt)}
                  className="w-full flex items-center gap-3 px-2 py-2 text-left text-[11px] font-bold text-foreground/70 rounded-lg hover:bg-card hover:text-primary transition-all"
                >
                  <input type="checkbox" checked={false} readOnly className="w-3.5 h-3.5 rounded border-muted accent-primary shrink-0" />
                  {opt}
                </button>
              ))}
            </div>
          )}

          {advOpts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/50 hover:text-primary transition-colors w-full"
              >
                <SlidersHorizontal className="w-3 h-3" strokeWidth={2.5} />
                <span>Advanced settings</span>
                {showAdvanced ? (
                  <ChevronUp className="w-3 h-3 ml-auto opacity-40" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-auto opacity-40" />
                )}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  {advOpts.map((ao) => (
                    <label
                      key={ao.label}
                      className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-card cursor-pointer transition-all border border-transparent hover:border-border/50"
                    >
                      <input type="checkbox" className="mt-0.5 w-3.5 h-3.5 rounded border-muted accent-primary" />
                      <div>
                        <div className="text-[11px] font-black text-foreground/80">{ao.label}</div>
                        <div className="text-[9px] text-muted-foreground font-bold mt-0.5 leading-relaxed">{ao.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export default function PeoplePage() {
  const [view, setView] = useState<"nlp" | "results">("nlp")
  const [nlpQuery, setNlpQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new")
  const [filterSearch, setFilterSearch] = useState("")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    "Current title": true,
    "Seniority level": true,
  })
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    "Current title": ["VP Sales", "Head of Growth"],
    "Seniority level": ["VP", "C-suite"],
  })
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [activeSignals, setActiveSignals] = useState<Record<string, boolean>>({
    "Job change signal": false,
    "Promotion signal": false,
    "Champion tracker": false,
  })
  const [pendingChange, setPendingChange] = useState(false)

  // Real Data State
  const [prospects, setProspects] = useState<ProspectProfile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [enrichedData, setEnrichedData] = useState<Record<string, any>>({})
  
  // AI Actions State
  const [isResearchOpen, setIsResearchOpen] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null)
  
  const [isScoringOpen, setIsScoringOpen] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState<PredictiveScore[]>([])

  const [isSaveSearchOpen, setIsSaveSearchOpen] = useState(false)
  const [savedSearchName, setSavedSearchName] = useState("")
  const [isSavingSearch, setIsSavingSearch] = useState(false)

  const router = useRouter()
  
  // Stubs for table compatibility
  const handleLoadMore = async () => {}
  const onEnrichReveal = async () => {}
  const handleWaterfallResult = (linkedinUrl: string, field: 'email' | 'phone', resultData: any) => {
    setEnrichedData(prev => ({
      ...prev,
      [linkedinUrl]: {
        ...prev[linkedinUrl],
        [field]: resultData
      }
    }))
  }

  const handleAddToCRM = async (rows: ProspectProfile[]) => {
    try {
      // Get integration status to determine which CRM to use
      const status = await integrationsApi.getStatus()
      const integrations = status.integrations
      
      // Determine which CRM is connected
      let crmType: 'hubspot' | 'salesforce' | 'zoho_crm' | null = null
      if (integrations.hubspot?.connected) crmType = 'hubspot'
      else if (integrations.salesforce?.connected) crmType = 'salesforce'
      else if (integrations.zoho_crm?.connected) crmType = 'zoho_crm'
      
      if (!crmType) {
        toast.error("No CRM connected. Please connect a CRM in the Integrations page.")
        return
      }
      
      // Convert prospects to contact format
      const contacts = rows.map(currentProspect => ({
        email: currentProspect.emails?.[0] || '',
        firstname: currentProspect.first_name || '',
        lastname: currentProspect.last_name || '',
        phone: '', // No phone property available in ProspectProfile
        company: currentProspect.current_employers?.[0]?.name || '',
        jobtitle: currentProspect.current_employers?.[0]?.title || '',
        linkedin: currentProspect.linkedin_profile_url || '',
      }))
      
      // Call the appropriate CRM API
      let hubspotResult, salesforceResult, zohoResult
      if (crmType === 'hubspot') {
        hubspotResult = await integrationsApi.hubspotAddContacts(contacts)
      } else if (crmType === 'salesforce') {
        salesforceResult = await integrationsApi.salesforceAddContacts(contacts)
      } else if (crmType === 'zoho_crm') {
        zohoResult = await integrationsApi.zohoCrmAddContacts(contacts)
      }
      
      const apiResult = hubspotResult || salesforceResult || zohoResult
      if (apiResult?.success) {
        toast.success(`Added ${apiResult.successful} of ${apiResult.total} contacts to ${crmType.replace('_', ' ').toUpperCase()}`)
      } else {
        toast.error(`Failed to add contacts to CRM`)
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to add contacts to CRM`)
    }
  }

  const removeChip = (filter: string, chip: string) => {
    setFilterChips((p) => ({ ...p, [filter]: (p[filter] || []).filter((c) => c !== chip) }))
    setPendingChange(true)
  }
  const toggleFilter = (label: string) => {
    setExpandedFilters((p) => ({ ...p, [label]: !p[label] }))
  }
  const toggleRow = (id: string) => setSelectedRows((p) => ({ ...p, [id]: !p[id] }))
  const selectedCount = Object.values(selectedRows).filter(Boolean).length
  const activeFilterCount = Object.values(filterChips).filter((v) => v.length > 0).length
    + Object.values(activeSignals).filter(Boolean).length

  const handleSaveSearch = async () => {
    if (!savedSearchName.trim()) {
      toast.error("Please enter a name for your search")
      return
    }

    setIsSavingSearch(true)
    try {
      const filters = {
        keyword: nlpQuery || undefined,
        current_title: filterChips["Current title"],
        seniority_level: filterChips["Seniority level"],
        functions: filterChips["Function / department"],
        location: filterChips["Location"],
        company: filterChips["Company"]?.[0],
        employees: filterChips["# Employees"],
        recently_changed_jobs: activeSignals["Job change signal"] ? true : undefined,
      }
      await savedSearchesApi.create({
        name: savedSearchName,
        search_type: "prospect",
        filters,
        nlp_query: nlpQuery || undefined
      })
      toast.success("Search saved successfully")
      setIsSaveSearchOpen(false)
      setSavedSearchName("")
    } catch (error: any) {
      toast.error(error.message || "Failed to save search")
    } finally {
      setIsSavingSearch(false)
    }
  }

  const handleResearch = async () => {
    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id])
    if (selectedIds.length === 0) {
      toast.error("Please select at least one prospect to research their company")
      return
    }
    
    const prospect = prospects.find(p => p.person_id === parseInt(selectedIds[0]))
    if (!prospect || !prospect.current_employers?.[0]) {
        toast.error("Could not find company info for this prospect")
        return
    }
    
    setIsResearchOpen(true)
    setResearching(true)
    setResearchResult(null)
    
    try {
      const researchData = await aiAgentsApi.researchCompany(prospect.current_employers[0].name, "standard")
      setResearchResult(researchData)
    } catch (error: any) {
      toast.error(error.message || "Research failed")
      setIsResearchOpen(false)
    } finally {
      setResearching(false)
    }
  }

  const handleAutoScore = async () => {
    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id])
    if (selectedIds.length === 0) {
      toast.error("Please select at least one prospect to score")
      return
    }

    setIsScoringOpen(true)
    setScoring(true)
    setScores([])

    try {
      const results: PredictiveScore[] = []
      for (const prospectIdentifier of selectedIds.slice(0, 5)) {
        const foundProspect = prospects.find(p => p.person_id === parseInt(prospectIdentifier))
        if (foundProspect) {
          const scoreData = await aiAgentsApi.scoreLeads({ 
            name: foundProspect.current_employers?.[0]?.name || foundProspect.name, 
            domain: foundProspect.current_employers?.[0]?.company_website_domain,
            industry: foundProspect.current_employers?.[0]?.company_linkedin_industry,
            country: foundProspect.location_details?.country
          })
          results.push(...scoreData)
        }
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
    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id])
    if (selectedIds.length === 0) {
      toast.error("Please select prospects for the agent to process")
      return
    }
    // Run agent = deep research on the first selected prospect's company
    const selectedProspect = prospects.find(p => p.person_id === parseInt(selectedIds[0]))
    const companyName = selectedProspect?.current_employers?.[0]?.name || selectedProspect?.name
    if (!companyName) {
      toast.error("Could not determine company for selected prospect")
      return
    }

    setIsResearchOpen(true)
    setResearching(true)
    setResearchResult(null)
    toast.info(`Running AI agent on ${selectedIds.length} prospect${selectedIds.length > 1 ? 's' : ''}...`)

    try {
      const agentResult = await aiAgentsApi.researchCompany(companyName, "deep")
      setResearchResult(agentResult)
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
    router.push(`/workflow-canvas?source=prospects${selectedIds.length > 0 ? `&ids=${selectedIds.join(",")}` : ""}`)
  }

  const handleSearch = async (query?: string) => {
    setIsLoading(true)
    setView("results")
    setPendingChange(false)
    try {
      const filters: ProspectSearchFilters = {
        keyword: query || nlpQuery || undefined,
        current_title: filterChips["Current title"]?.length ? filterChips["Current title"] : undefined,
        seniority_level: filterChips["Seniority level"]?.length ? filterChips["Seniority level"] : undefined,
        functions: filterChips["Function / department"]?.length ? filterChips["Function / department"] : undefined,
        location: filterChips["Location"]?.length ? filterChips["Location"] : undefined,
        company: filterChips["Company"]?.[0] || undefined,
        employees: filterChips["# Employees"]?.length ? filterChips["# Employees"] : undefined,
        // Signal filters — map toggle state to boolean
        recently_changed_jobs: activeSignals["Job change signal"] ? true : undefined,
        limit: 50,
      }

      // Use unified data service with Brightdata integration and fallback
      console.log('🔍 Starting search with filters:', filters)
      const result = await unifiedDataService.searchPeopleWithRetry(filters, {
        useBrightdata: true,
        enableFallback: true,
        timeout: 15000 // 15 seconds timeout
      }, 2) // 2 retries
      console.log('📊 Search result:', result)
      console.log('📊 Raw data sample:', result.data?.slice(0, 2))

      // Transform data to match expected format
      const mappedProfiles = result.data.map((p: any) => {
        // Parse location string into components
        const locationParts = (p.location || '').split(',').map((part: string) => part.trim())
        const locationDetails = {
          city: locationParts[0] || '',
          state: locationParts[1] || '',
          country: locationParts[2] || '',
          continent: '',
        }

        // Create current employer from company field
        const currentEmployers = p.company ? [{
          name: p.company,
          company_name: p.company,
          title: p.title || '',
          linkedin_id: '',
          company_id: 0,
          company_linkedin_id: '',
          company_website_domain: '',
          position_id: 0,
          description: '',
          location: p.location || '',
          start_date: '',
          end_date: undefined,
          employer_is_default: true,
          seniority_level: '',
          function_category: '',
          years_at_company: '',
          years_at_company_raw: 0,
          company_headquarters_country: '',
          company_hq_location: '',
          company_hq_location_address_components: [],
          company_headcount_range: '',
          company_industries: [],
          company_linkedin_industry: '',
          company_type: '',
          company_headcount_latest: 0,
          company_website: '',
          company_linkedin_profile_url: '',
          business_email_verified: false,
        }] : []

        return {
          person_id: p.id || 0,
          name: p.name || '',
          first_name: p.firstName || '',
          last_name: p.lastName || '',
          region: p.location || locationDetails.country || '',
          region_address_components: [],
          headline: p.title || '',
          summary: p.summary || '',
          skills: p.skills || [],
          languages: [],
          linkedin_profile_url: p.linkedin || '',
          Social_profile_url: '',
          flagship_profile_url: '',
          emails: p.email ? [p.email] : [],
          profile_picture_url: '',
          profile_picture_permalink: '',
          twitter_handle: '',
          num_of_connections: 0,
          education_background: [],
          honors: [],
          certifications: [],
          current_employers: currentEmployers,
          past_employers: [],
          last_updated: new Date().toISOString(),
          recently_changed_jobs: false,
          years_of_experience: p.experience || '',
          years_of_experience_raw: 0,
          all_employers: currentEmployers,
          updated_at: new Date().toISOString(),
          location_details: locationDetails,
          // Additional fields for card display
          id: p.id,
          title: p.title,
          company: p.company,
          location: p.location,
          email: p.email,
          phone: p.phone,
        }
      })

      console.log('Prospect search results sample:', mappedProfiles.slice(0, 2).map(p => ({
        name: p.name,
        current_employers: p.current_employers,
        region: p.region,
        location_details: p.location_details,
        years_of_experience: p.years_of_experience,
        years_of_experience_raw: p.years_of_experience_raw,
      })))

      setProspects(mappedProfiles)
      setTotalCount(result.total)
      // Calculate new count (prospects with recent job changes)
      const newProspects = mappedProfiles.filter(p => p.recently_changed_jobs).length
      setNewCount(newProspects)
      // TODO: Fetch actual saved searches count from API
      setSavedCount(0) // Placeholder until saved searches API is implemented
      // Persist for profile page
      try { localStorage.setItem("prospect_search_results", JSON.stringify(result.data)) } catch {}
      
      // Show data source info to user
      if (result.source === 'brightdata') {
        toast.success('People search completed using Brightdata dataset')
      } else {
        toast.info('People search completed using fallback API')
      }
    } catch (err) {
      toast.error("Failed to fetch prospects")
    } finally {
      setIsLoading(false)
    }
  }

  const exampleChips = ["VP Sales · Series A SaaS · EU", "CRO at recently funded fintech", "Head of Growth · dev tools · US", "GTM leaders who changed jobs last 30 days", "RevOps leads using HubSpot · 100–500 emp.", "Founders at AI SaaS · raised last 6 months"]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Filter Sidebar */}
      <aside className="w-[280px] min-w-[280px] h-full flex flex-col bg-card border-r border-border">
        {/* Quick Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={2.5} />
            <Input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search filters..."
              className="pl-9 h-8 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/40 transition-all text-[11px] font-bold rounded-lg placeholder:text-muted-foreground/30"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mx-4">
          {[
            ["total", totalCount.toLocaleString(), "Total"],
            ["new", newCount.toLocaleString(), "New"],
            ["saved", savedCount.toLocaleString(), "Saved"],
          ].map(([key, num, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                "flex-1 flex flex-col items-center py-2.5 relative transition-all",
                activeTab === key ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"
              )}
            >
              <span className="text-[15px] font-black tracking-tight">{num}</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em] mt-0.5 opacity-60">{label}</span>
              {activeTab === key && <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        {/* Scrollable Filter List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {(() => {
            const filteredUnlockedFilters = filterSearch.trim()
              ? unlockedFilters.filter(f =>
                  f.label.toLowerCase().includes(filterSearch.toLowerCase()) ||
                  (f.options && f.options.some(opt => opt.toLowerCase().includes(filterSearch.toLowerCase())))
                )
              : unlockedFilters

            const categoryConfig: Record<string, { icon: typeof UserCircle; label: string }> = {
              "Company": { icon: Building2, label: "COMPANY" },
              "Location": { icon: MapPin, label: "LOCATION" },
              "Profile Language": { icon: Globe, label: "PROFILE LANGUAGE" },
              "Experience Header": { icon: Briefcase, label: "EXPERIENCE" },
              "Contact": { icon: Mail, label: "CONTACT" },
              "CRM": { icon: Database, label: "CRM" },
            }
            // Show identity filters first without category header
            const identityFilters = filteredUnlockedFilters.filter(f => f.category === "Identity")
            const identityHeaderFilters = filteredUnlockedFilters.filter(f => f.category === "Identity Header")
            const experienceHeaderFilters = filteredUnlockedFilters.filter(f => f.category === "Experience Header")
            const otherCategories = ["Location", "Experience Header", "Contact", "Company", "CRM"].filter(cat => 
              filteredUnlockedFilters.some(f => f.category === cat)
            )
            
            return (
              <>
                {/* Identity filters — summary only (filter name + selected chips) */}
                {identityFilters.filter(f => (filterChips[f.label] || []).length > 0).map((f) => {
                  const chips = filterChips[f.label] || []
                  return (
                    <div key={f.label} className="px-4 py-2.5 border-b border-border/40">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[12px] font-bold text-foreground">{f.label}</span>
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{chips.length}</span>
                      </div>
                      <div className="text-[9px] uppercase font-black tracking-widest mb-1.5 text-muted-foreground/50">Include</div>
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map((c) => (
                          <span
                            key={c}
                            className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                          >
                            {c}
                            <button onClick={() => removeChip(f.label, c)} className="opacity-60 hover:opacity-100">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
                
                {/* Identity Header section with IDENTITY header */}
                {identityHeaderFilters.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <UserCircle className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={2} />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">IDENTITY</span>
                    </div>
                    {identityHeaderFilters.map((f) => (
                      <UnlockedFilterPanel
                        key={f.label}
                        filter={f}
                        isExpanded={!!expandedFilters[f.label]}
                        chips={filterChips[f.label] || []}
                        onToggle={() => toggleFilter(f.label)}
                        onAddChip={(val) => {
                          setFilterChips((p) => ({ ...p, [f.label]: [...(p[f.label] || []), val] }))
                          setPendingChange(true)
                        }}
                        onRemoveChip={(chip) => removeChip(f.label, chip)}
                      />
                    ))}
                  </div>
                )}

                                
                {/* Other categories with headers */}
                {otherCategories.map((cat) => {
                  const config = categoryConfig[cat || ""] || { icon: Briefcase, label: (cat || "").toUpperCase() }
                  const CatIcon = config.icon
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                        <CatIcon className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={2} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{config.label}</span>
                      </div>
                      {filteredUnlockedFilters
                        .filter((f) => f.category === cat)
                        .map((f) => (
                          <UnlockedFilterPanel
                            key={f.label}
                            filter={f}
                            isExpanded={!!expandedFilters[f.label]}
                            chips={filterChips[f.label] || []}
                            onToggle={() => toggleFilter(f.label)}
                            onAddChip={(val) => {
                              setFilterChips((p) => ({ ...p, [f.label]: [...(p[f.label] || []), val] }))
                              setPendingChange(true)
                            }}
                            onRemoveChip={(chip) => removeChip(f.label, chip)}
                          />
                        ))}
                    </div>
                  )
                })}
              </>
            )
          })()}

          {/* Signals Section */}
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-orange-500/40" strokeWidth={2} />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500/50">Signals</span>
            </div>
            {Object.values(activeSignals).filter(Boolean).length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">{Object.values(activeSignals).filter(Boolean).length}</span>
            )}
          </div>
          <div className="px-4 pb-2">
            <div className="text-[9px] uppercase font-black tracking-widest text-muted-foreground/50">Include</div>
          </div>
          {Object.values(activeSignals).filter(Boolean).length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(activeSignals).filter(([, v]) => v).map(([label]) => (
                  <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20">
                    {label === "Champion tracker" ? "New hire" : label === "Job change signal" ? "Job change" : label === "Promotion signal" ? "Promotion" : label}
                    <button onClick={() => { setActiveSignals(p => ({ ...p, [label]: false })); setPendingChange(true) }} className="opacity-60 hover:opacity-100">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {signalFilters.filter(f => f.label !== "Signals").map((f) => {
            const isActive = activeSignals[f.label]
            return (
              <div key={f.label}>
                <button
                  onClick={() => {
                    setActiveSignals(p => ({ ...p, [f.label]: !p[f.label] }))
                    setPendingChange(true)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 h-10 text-left transition-all",
                    isActive ? "bg-orange-500/8" : "hover:bg-muted/30"
                  )}
                >
                  <Sparkles className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-orange-500" : "text-muted-foreground/30")} strokeWidth={2} />
                  <span className={cn("flex-1 text-[11px] font-bold tracking-tight", isActive ? "text-orange-600" : "text-muted-foreground")}>
                    {f.label}
                  </span>
                  <div className={cn(
                    "w-7 h-3.5 rounded-full relative transition-all shrink-0",
                    isActive ? "bg-orange-500" : "bg-muted"
                  )}>
                    <div className={cn(
                      "absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all",
                      isActive ? "left-[14px]" : "left-[2px]"
                    )} />
                  </div>
                </button>
              </div>
            )
          })}

          {/* Locked Filters Section */}
          <div className="pt-3" />
          {lockedFilters.map((f) => (
            <Popover key={f.label}>
              <PopoverTrigger asChild>
                <button suppressHydrationWarning className="w-full flex items-center gap-3 px-4 h-10 text-left opacity-50 hover:opacity-80 transition-opacity group">
                  <span className="flex-1 text-[11px] font-bold tracking-tight text-muted-foreground">{f.label}</span>
                  {f.tier && tierPill(f.tier)}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-[240px] shadow-2xl rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold">Requires {f.tier}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mb-3">
                  Find high-potential prospects using advanced {f.label.toLowerCase()} intelligence.
                </p>
                <Button className="w-full h-8 text-xs font-bold">Upgrade Now</Button>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setFilterChips({})
                setActiveSignals(Object.fromEntries(signalFilters.filter(f => f.label !== "Signals").map(f => [f.label, false])) as any)
                setPendingChange(true)
              }}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] font-bold text-foreground">{activeFilterCount}</span>
            <span className="text-[11px] font-bold text-primary ml-auto cursor-pointer hover:underline">More filters</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl">
            <Button variant="ghost" size="sm" className={cn("h-8 px-4 text-[11px] font-bold rounded-lg", "bg-background shadow-sm text-foreground")}>
              Find People
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/leads/companies")} className="h-8 px-4 text-[11px] font-bold text-muted-foreground rounded-lg">
              Find Companies
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all", selectedCount > 0 ? "" : "opacity-50 cursor-not-allowed")}
              onClick={handleResearch}
              disabled={selectedCount === 0}
            >
              <Bot className="w-4 h-4" /> Research with AI{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all"
              onClick={handleCreateWorkflow}
            >
              <Zap className="w-4 h-4" /> Create Sequence
            </Button>
            <Dialog open={isSaveSearchOpen} onOpenChange={setIsSaveSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all">
                  <Bookmark className="w-4 h-4" /> Save Search
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Save Search</DialogTitle>
                  <DialogDescription>
                    Give your search a name to easily access it later.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="name" className="text-sm font-medium">Name</label>
                    <Input
                      id="name"
                      value={savedSearchName}
                      onChange={(e) => setSavedSearchName(e.target.value)}
                      placeholder="e.g. VP Sales in NY"
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
              className={cn("h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all", selectedCount > 0 ? "" : "opacity-50 cursor-not-allowed")}
              onClick={handleAutoScore}
              disabled={selectedCount === 0}
            >
              <Target className="w-4 h-4" /> Auto-Score{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all"
              onClick={() => router.push("/settings")}
            >
              <Settings className="w-4 h-4" /> Search settings
            </Button>
          </div>
        </div>

        {/* NLP Search Land */}
        {view === "nlp" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/10">
            <div className="w-full max-w-[720px] text-center">
                            <h1 className="text-3xl font-black tracking-tighter text-foreground mb-4">
                Use Outmate AI to find the right people.
              </h1>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                <div className="relative flex items-center gap-2 p-3 rounded-2xl bg-card border border-border shadow-2xl focus-within:border-primary transition-all w-full max-w-4xl">
                  <Search className="w-5 h-5 ml-2 text-muted-foreground/30" />
                  <input
                    value={nlpQuery}
                    onChange={(e) => setNlpQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. VP Sales at Series A SaaS in Europe who changed jobs last 30 days..."
                    className="flex-1 bg-transparent text-base font-bold text-foreground placeholder:text-muted-foreground/30 placeholder:text-xs outline-none px-2 min-w-0"
                  />
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground/50 hover:bg-muted rounded-xl">
                    <Mic className="w-5 h-5" />
                  </Button>
                  <Button onClick={() => handleSearch()} className="h-11 px-6 font-black bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">
                    Search
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-8 opacity-80">
                {exampleChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => { setNlpQuery(chip); handleSearch(chip); }}
                    className="text-[11px] font-bold text-muted-foreground px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:text-primary transition-all shadow-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-4">
                <div className="text-[12px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors">
                  Recently searched
                </div>
                <div className="text-[12px] font-medium text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors">
                  Recently saved
                </div>
              </div>

              <div className="mt-8 text-center">
                <div className="flex items-center justify-center gap-4 text-[12px] font-medium text-muted-foreground/70">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>Unlock advanced filters: Buying intent · People lookalikes · ICP fit score · Headcount growth</span>
                  </div>
                  <button className="text-[12px] font-medium text-white bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-lg transition-colors cursor-pointer">
                    View plans
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Page */}
        {view === "results" && (
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Search Header */}
            <div className="py-4 border-b border-border">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder="Search"
                    className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border/50 rounded-xl text-sm font-medium focus:bg-background focus:border-primary/40 transition-all outline-none"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-10 px-4 gap-2 rounded-lg border-border/50">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-sm font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 bg-primary text-primary-foreground text-xs font-bold h-5 min-w-5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>
              
              {/* Active Filter Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filterChips).map(([filterName, chips]) =>
                    chips.map((chip) => (
                      <div key={`${filterName}-${chip}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                        <span className="text-xs font-medium text-primary">{chip}</span>
                        <button 
                          onClick={() => removeChip(filterName, chip)}
                          className="w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                        >
                          <X className="w-2 h-2 text-primary" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Results Stats */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">
                  <span className="text-primary font-bold">{totalCount.toLocaleString()}</span> results
                </span>
                <span className="text-sm text-muted-foreground">
                  {activeFilterCount} active filters
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground font-bold">
                    {selectedCount} Selected
                  </Badge>
                )}
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <Button size="sm" className="h-9 px-4 font-bold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                  <Zap className="w-4 h-4 fill-current mr-1.5" />
                  Run Outreach
                </Button>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prospects.slice(0, 9).map((prospect, index) => (
                  <div key={prospect.person_id || index} className="bg-card border border-border rounded-xl p-4 hover:shadow-lg transition-shadow">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <UserCircle className="w-6 h-6 text-primary" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{prospect.name || 'John Doe'}</h3>
                          <p className="text-xs text-muted-foreground">{prospect.headline || 'VP of Sales'}</p>
                        </div>
                      </div>
                      <button className="w-6 h-6 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors">
                        <BookmarkPlus className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Company Info */}
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{prospect.current_employers?.[0]?.name || 'Tech Corp'}</span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{prospect.region || prospect.location_details?.city || 'San Francisco, CA'}</span>
                    </div>

                    {/* Contact Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-medium border-border/50">
                        <Mail className="w-3 h-3 mr-1" />
                        Email
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-medium border-border/50">
                        <Linkedin className="w-3 h-3 mr-1" />
                        LinkedIn
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-xs font-medium bg-primary text-primary-foreground">
                        Add to CRM
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Load More */}
              {prospects.length > 9 && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="px-6">
                    Load More
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Research Dialog */}
      <Dialog open={isResearchOpen} onOpenChange={setIsResearchOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Company Research Report
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
              <p className="text-sm font-medium text-muted-foreground">Calculating match scores for selected prospects...</p>
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
  )
}
