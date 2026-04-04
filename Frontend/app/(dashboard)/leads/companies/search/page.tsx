
"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Database, Sparkles, Zap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterSidebar } from "@/components/leads/companies/filter-sidebar"
import { CompaniesResultsTable } from "@/components/leads/companies/companies-results-table"
import type { CompanyData } from "@/components/leads/companies/companies-results-table"
import { searchCache } from "@/lib/cache/search-cache"
import { ALL_FILTERS, PINNED_FILTERS_DEFAULT } from "@/components/leads/companies/constants"
import { useSearchParams } from "next/navigation"
import { saveSearchToHistory, getSearchHistoryItem } from "@/lib/stores/searchHistoryStore"
import { NlpSearchBar } from "@/components/leads/nlp-search-bar"
import { enrichCompany, type CompanyEnrichmentResult } from "@/lib/services/betterContactService"
import { CsvImportButton } from "@/components/shared/csv-import-button"
import { normalizeCsvRecord } from "@/lib/utils/csv"
import { useToast } from "@/hooks/use-toast"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { useAgentHighlight } from "@/hooks/use-agent-highlight"
import { cn } from "@/lib/utils"

function InDbCompanySearchPageContent() {
  const params = useSearchParams()
  const historyId = params.get('historyId') || undefined
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [restoredFilters, setRestoredFilters] = useState<Record<string, any> | undefined>(undefined)
  const [autoSearch, setAutoSearch] = useState(false)
  const [restored, setRestored] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // ── Copilot automation agent bridge ──────────────────────────────────────
  const copilotFilters = useCoPilotAgentStore(s => s.appliedFilters?.['companies'])
  const isFilterHighlighted = useAgentHighlight('companies-filters-panel')
  const lastCopilotCompanyKey = useRef<string>('')

  useEffect(() => {
    if (!copilotFilters || Object.keys(copilotFilters).length === 0) return
    const key = JSON.stringify(copilotFilters)
    if (key === lastCopilotCompanyKey.current) return
    lastCopilotCompanyKey.current = key

    // Map copilot store keys → company API filter keys
    const mapped: Record<string, any> = {}
    if (copilotFilters.industry) {
      const ind = copilotFilters.industry
      mapped.industry = Array.isArray(ind) ? ind : [String(ind)]
    }
    if (copilotFilters.company_size) {
      const sz = copilotFilters.company_size
      mapped.employee_count = Array.isArray(sz) ? sz : [String(sz)]
    }
    if (copilotFilters.location) mapped.country = copilotFilters.location
    if (copilotFilters.funding_stage) {
      const fs = copilotFilters.funding_stage
      mapped.funding_stage = Array.isArray(fs) ? fs : [String(fs)]
    }
    if (copilotFilters.tech_stack) {
      const ts = copilotFilters.tech_stack
      mapped.technologies = Array.isArray(ts) ? ts : [String(ts)]
    }
    if (copilotFilters.name) mapped.name = String(copilotFilters.name)
    if (copilotFilters.domain) mapped.domain = String(copilotFilters.domain)
    if (copilotFilters.keywords) mapped.keyword = String(copilotFilters.keywords)

    if (Object.keys(mapped).length === 0) return

    // Show applied filters in sidebar and kick off search directly (avoids timing issues)
    setRestoredFilters(mapped)
    handleNlpSearch(mapped)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotFilters])
  // ─────────────────────────────────────────────────────────────────────────

  // Enrichment state
  const [enrichingRows, setEnrichingRows] = useState<Record<string, boolean>>({})
  const [enrichedData, setEnrichedData] = useState<Record<string, CompanyEnrichmentResult>>({})
  const [isBulkEnriching, setIsBulkEnriching] = useState(false)
  const [waterfallAttempts, setWaterfallAttempts] = useState<Record<string, { email?: boolean; phone?: boolean }>>({})

  const mapCompany = (c: any): CompanyData => ({
    id: String(c.id ?? c.domain ?? ""),
    name: c.name ?? "",
    domain: c.domain ?? "",
    website: c.website,
    logo_url: c.logo_url ?? c.linkedin_logo_url ?? c.business_logo ?? c.logo ?? (c.domain ? `https://logo.clearbit.com/${c.domain}` : undefined),
    description: c.description ?? c.company_description ?? c.business_description,
    industry: c.industry ?? c.linkedin_industry_category ?? c.primary_industry,
    sub_industry: c.sub_industry,
    linkedin_industry_category: c.linkedin_industry_category,
    company_type: c.company_type ?? c.business_type ?? c.type,
    founded_year: c.founded_year ?? c.year_founded,
    employee_count_exact: c.employee_count_exact ?? c.linkedin_headcount,
    employee_count_range: c.employee_count_range ?? c.employee_range,
    revenue_exact: c.revenue_exact ?? c.yearly_revenue_exact ?? c.yearly_revenue ?? c.yearly_revenue_usd ?? c.revenue_usd ?? c.annual_revenue_usd,
    revenue_range: c.revenue_range ?? c.yearly_revenue_range ?? c.estimated_revenue_range,
    funding_stage: c.funding_stage ?? c.last_funding_round_type ?? c.last_funding_stage,
    funding_total: c.funding_total ?? c.known_funding_total_value ?? c.total_funding_usd,
    last_funding_date: c.last_funding_date ?? c.last_funding_round_date ?? c.first_funding_round_date,
    has_recent_funding: c.has_recent_funding,
    investors: (Array.isArray(c.investors) && c.investors.length > 0) ? c.investors : (c.investor_list ?? []),
    investors_count: c.investors_count ?? (Array.isArray(c.investors) && c.investors.length > 0 ? c.investors.length : undefined),
    headquarters_country: c.headquarters_country ?? c.country_name,
    headquarters_state: c.headquarters_state ?? c.region_name ?? c.headquarters_state,
    headquarters_city: c.headquarters_city ?? c.city_name ?? c.headquarters_city,
    street: c.street,
    zip_code: c.zip_code ?? c.zip,
    locations: Array.isArray(c.locations) && c.locations.length > 0 ? c.locations : [],
    headquarters_address: c.headquarters_address ?? c.hq_address ?? c.location_display,
    location_display: c.location_display,
    phone: Array.isArray(c.phone) ? c.phone.join(', ') : c.phone,
    email: Array.isArray(c.email) ? c.email.join(', ') : c.email,
    personal_email: c.personal_email,
    work_email: c.work_email,
    linkedin_url: c.linkedin_url ?? c.linkedin_profile ?? c.company_linkedin_url,
    twitter_url: c.twitter_url,
    facebook_url: c.facebook_url,
    instagram_url: c.instagram_url,
    follower_count: c.follower_count ?? c.linkedin_followers,
    technologies: (Array.isArray(c.technologies) && c.technologies.length > 0) ? c.technologies : (c.full_tech_stack ?? c.technologies_used),
    is_tech_heavy: c.is_tech_heavy,
    employee_growth_6m: c.employee_growth_6m,
    employee_growth_12m: c.employee_growth_12m,
    employee_growth_6m_percent: c.employee_growth_6m_percent,
    employee_growth_12m_percent: c.employee_growth_12m_percent,
    growth_category: c.growth_category,
    job_openings_count: c.job_openings_count,
    web_traffic: c.web_traffic,
    seo_score: c.seo_score,
    decision_makers_count: c.decision_makers_count,
    locations_distribution_count: c.locations_distribution_count || (Array.isArray(c.locations) ? c.locations.length : 0),
    acquisition_status: c.acquisition_status,
    data_quality_score: c.data_quality_score ?? c.quality_score ?? c.data_quality_score,
    provider_source: c.provider_source,
    enriched: c.enriched,
    ticker: c.ticker,
    stock_symbol: c.stock_symbol,
    naics: c.naics ?? c.naics_code,
    naics_description: c.naics_description,
    sic_code: c.sic_code,
    sic_code_description: c.sic_code_description,
    last_enriched_at: c.last_enriched_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
    last_raised_amount: c.last_raised_amount,
    market_cap: c.market_cap,
    fiscal_year_end: c.fiscal_year_end,
    number_of_locations: c.number_of_locations,
    alexa_rank: c.alexa_rank,
    social_insights: c.social_insights,
  })

  const handleSearch = async (
    results: any[],
    loading: boolean,
    searched: boolean,
    filters: Record<string, any>,
    matchList?: string[]
  ) => {
    if (results && results.length > 0) {
      searchCache.set(results)
    }

    const mapped: CompanyData[] = results.map(mapCompany)

    let limited = mapped
    const normalizedMatchTokens = (matchList || [])
      .map((value) => value)
      .map((value) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim())
      .map((value) => value.split(/\s+/).filter(Boolean))
      .filter((tokens) => tokens.length > 0)

    if (normalizedMatchTokens.length > 0) {
      const narrowed = mapped.filter((c) => {
        const nameTokens = (c.name || c.domain || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(Boolean)
        const domainTokens = (c.domain || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(Boolean)
        const companyTokenSet = new Set([...nameTokens, ...domainTokens])
        return normalizedMatchTokens.some((matchTokens) =>
          matchTokens.every((token) => token && companyTokenSet.has(token))
        )
      })
      if (narrowed.length > 0) {
        limited = narrowed
      }
    }

    setCompanies(limited)
    setEnrichedData({}) // Reset enrichment on new search

    if (!loading && searched) {
      try {
        saveSearchToHistory(filters, mapped, mapped.length, null, 'companies', '/leads/companies/search')
      } catch (e) {
        console.warn('Failed to save companies search to history', e)
      }
    }

    setIsLoading(loading)
    setHasSearched(searched)
  }

  // NLP search: limit 3
  const { toast } = useToast()

  const handleNlpSearch = async (filters: Record<string, any>) => {
    setIsLoading(true)
    setHasSearched(false)
    setCompanies([])

    try {
      const response = await fetch(`/api/v1/leads/search/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, options: { limit: 3 } }),
      })

      if (!response.ok) throw new Error(`Search failed: ${response.status}`)

      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || "Search failed")

      const rawCompanies = result.data?.companies || []
      const limited = rawCompanies.slice(0, 3)
      handleSearch(limited, false, true, filters)
    } catch (e) {
      console.error("[NLP Company Search] Error:", e)
      setIsLoading(false)
      setHasSearched(true)
    }
  }

  // Enrich a single company row
  const fetchCompaniesForFilters = async (filters: Record<string, any>) => {
    const response = await fetch(`/api/v1/leads/search/companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters,
        options: { limit: 3, page: 1 }
      })
    })
    if (!response.ok) throw new Error(`Import search failed: ${response.status}`)

    const result = await response.json()
    if (!result.success) throw new Error(result.error?.message || "Import search failed")

    return result.data?.companies || []
  }

  const handleImportRecords = async (records: Record<string, string>[]) => {
    if (!records.length) {
      toast({
        title: "No rows found",
        description: "CSV must contain at least one row with filter columns.",
        variant: "destructive"
      })
      return
    }

    const matchableKeys = ["name", "domain"]
    const parsedRows: Array<{ filters: Record<string, string>; matchTokens: string[] }> = []

    records.forEach((record) => {
      const normalized = normalizeCsvRecord(record)
      const rowFilters: Record<string, string> = {}
      const rowTokens: string[] = []

      Object.entries(normalized).forEach(([key, value]) => {
        if (!value) return

        const mappedKey = mapCsvHeaderToFilterKey(key)
        if (!mappedKey) return

        const addValues = Array.isArray(value) ? value : [value]
        const firstValue = addValues.find(Boolean)
        if (!firstValue) return

        rowFilters[mappedKey] = firstValue
        if (matchableKeys.includes(mappedKey)) {
          rowTokens.push(firstValue)
        }
      })

      if (rowFilters.name || rowFilters.domain) {
        parsedRows.push({ filters: rowFilters, matchTokens: rowTokens })
      }
    })

    if (!parsedRows.length) {
      toast({
        title: "Import failed",
        description: "CSV rows must include Company Name or Domain values.",
        variant: "destructive"
      })
      return
    }

    setIsImporting(true)
    setIsLoading(true)
    setHasSearched(false)
    setCompanies([])

    try {
      const collectedCompanies: any[] = []
      const combinedMatchTokens: string[] = []
      const aggregatedFilters: Record<string, string[]> = {}

      for (const { filters, matchTokens } of parsedRows) {
        combinedMatchTokens.push(...matchTokens)

        Object.entries(filters).forEach(([key, value]) => {
          if (!aggregatedFilters[key]) {
            aggregatedFilters[key] = []
          }
          if (!aggregatedFilters[key].includes(value)) {
            aggregatedFilters[key].push(value)
          }
        })

        const fetched = await fetchCompaniesForFilters(filters)
        collectedCompanies.push(...fetched)

        if (collectedCompanies.length >= 3) {
          break
        }
      }

      const limited = collectedCompanies.slice(0, 3)
      handleSearch(limited, false, true, aggregatedFilters, combinedMatchTokens.filter(Boolean))

      toast({
        title: "Import complete",
        description: `Imported ${limited.length} companies from CSV filters.`
      })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import CSV filters.",
        variant: "destructive"
      })
      setIsLoading(false)
      setHasSearched(true)
    } finally {
      setIsImporting(false)
    }
  }

  function mapCsvHeaderToFilterKey(header: string): string | undefined {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, " ").trim()
    const mapping: Record<string, string> = {
      "company name": "name",
      "company": "name",
      "name": "name",
      "domain": "domain",
      "website": "domain",
      "company domain": "domain",
      "company website": "domain"
    }
    for (const key of Object.keys(mapping)) {
      if (normalized === key || normalized.includes(key)) {
        return mapping[key]
      }
    }
    return undefined
  }

  const handleEnrichRow = async (company: CompanyData) => {
    const key = company.domain || company.id
    if (!key || enrichingRows[key] || enrichedData[key]) return

    setEnrichingRows(prev => ({ ...prev, [key]: true }))
    const result = await enrichCompany(company.name, company.domain)
    setEnrichedData(prev => ({ ...prev, [key]: result }))
    setEnrichingRows(prev => ({ ...prev, [key]: false }))
  }

  // Bulk enrich all companies
  const handleBulkEnrich = async () => {
    setIsBulkEnriching(true)
    for (const company of companies) {
      const key = company.domain || company.id
      if (!key || enrichedData[key]) continue
      setEnrichingRows(prev => ({ ...prev, [key]: true }))
      const result = await enrichCompany(company.name, company.domain)
      setEnrichedData(prev => ({ ...prev, [key]: result }))
      setEnrichingRows(prev => ({ ...prev, [key]: false }))
    }
    setIsBulkEnriching(false)
  }

  const handleCompanyWaterfallResult = (companyId: string, field: 'email' | 'phone', result: Record<string, any>) => {
    if (!companyId || !result) return
    setEnrichedData(prev => {
      const existing = prev[companyId] || {}
      const updated = { ...existing, success: result.success, not_found: result.not_found }
      if (result.email) {
        updated.email = {
          email: result.email,
          credits_consumed: result.credits_consumed,
        }
      }
      if (result.phone) {
        updated.phone = {
          phone: result.phone,
          credits_consumed: result.credits_consumed,
        }
      }
      return {
        ...prev,
        [companyId]: updated,
      }
    })

    setWaterfallAttempts(prev => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        [field]: true,
      },
    }))
  }

  // Attempt to restore from historyId on first render
  useEffect(() => {
    if (!historyId) return
    const item = getSearchHistoryItem(historyId)
    if (item && (item.type === 'companies' || item.route?.includes('/leads/companies'))) {
      setRestoredFilters(item.filters || {})
      try {
        const mapped: CompanyData[] = (item.results || []).map(mapCompany)
        setCompanies(mapped)
        setHasSearched(true)
        setIsLoading(false)
        setRestored(true)
      } catch (e) {
        console.warn('Failed to map restored companies from history', e)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyId])

  const enrichedCount = Object.values(enrichedData).filter(r => r.success && !r.not_found).length

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div id="companies-filters-panel" className={cn('transition-all duration-300', isFilterHighlighted && 'ring-2 ring-primary ring-offset-2 rounded-xl')}>
        <FilterSidebar
          onSearch={handleSearch}
          initialFilters={restoredFilters}
          autoSearchOnMount={restored ? false : autoSearch}
          defaultPinnedIds={PINNED_FILTERS_DEFAULT}
          searchOptions={{ limit: 3, page: 1 }}
          hideCategoryHeaders
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0 p-4">
        <div className="mb-4 flex flex-col gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">In-DB Company Search</h1>
            <p className="text-sm text-muted-foreground">
              Search and filter companies from our business intelligence dataset. Use the filters on the left or describe what you need below.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <CsvImportButton label="Import filters" onRecordsParsed={handleImportRecords} />
            {isImporting && <span className="text-xs text-muted-foreground">Applying CSV filters...</span>}
          </div>
        </div>

        {/* NLP Search Bar */}
        <div className="mb-4 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Search</span>
            <span className="text-xs text-muted-foreground">Describe the companies you&apos;re looking for in plain English</span>
          </div>
          <NlpSearchBar intent="company" onFiltersExtracted={handleNlpSearch} />
        </div>

        {/* Results Area */}
        <CompaniesResultsTable
          companies={companies}
          isLoading={isLoading}
          hasSearched={hasSearched}
          tableId={restored ? "companies-history" : "companies-v2"}
          onEnrichReveal={async (companyId, field) => {
            console.log('[Zap] onEnrichReveal called', { companyId, field, alreadyEnriched: !!enrichedData[companyId]?.[field], enriching: !!enrichingRows[companyId] })
            if (enrichedData[companyId]?.[field] || enrichingRows[companyId]) return
            const company = companies.find(c => (c.domain || c.id) === companyId)
            console.log('[Zap] company found:', !!company, company?.name, company?.domain)
            if (!company) return
            setEnrichingRows(prev => ({ ...prev, [companyId]: true }))
            const result = await enrichCompany(company.name, company.domain, field)
            handleCompanyWaterfallResult(companyId, field, result)
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
                    contact_name: data.contact_name,
                    contact_title: data.contact_title,
                  }
                  : {}
            ])
          )}
          enrichingRows={enrichingRows}
          onWaterfallResult={handleCompanyWaterfallResult}
          waterfallAttempts={waterfallAttempts}
        />
      </div>
    </div>
  )
}

export default function InDbCompanySearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InDbCompanySearchPageContent />
    </Suspense>
  )
}
