"use client"

import { useState, useEffect } from "react"
import { Database, Sparkles, Zap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterSidebar } from "@/components/leads/companies/filter-sidebar"
import { CompaniesResultsTable } from "@/components/leads/companies/companies-results-table"
import type { CompanyData } from "@/components/leads/companies/companies-results-table"
import { searchCache } from "@/lib/cache/search-cache"
import { PINNED_FILTERS_DEFAULT } from "@/components/leads/companies/constants"
import { useSearchParams } from "next/navigation"
import { saveSearchToHistory, getSearchHistoryItem } from "@/lib/stores/searchHistoryStore"
import { NlpSearchBar } from "@/components/leads/nlp-search-bar"
import { enrichCompany, type CompanyEnrichmentResult } from "@/lib/services/betterContactService"

export default function InDbCompanySearchPage() {
  const params = useSearchParams()
  const historyId = params.get('historyId') || undefined
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [restoredFilters, setRestoredFilters] = useState<Record<string, any> | undefined>(undefined)
  const [autoSearch, setAutoSearch] = useState(false)
  const [restored, setRestored] = useState(false)

  // Enrichment state
  const [enrichingRows, setEnrichingRows] = useState<Record<string, boolean>>({})
  const [enrichedData, setEnrichedData] = useState<Record<string, CompanyEnrichmentResult>>({})
  const [isBulkEnriching, setIsBulkEnriching] = useState(false)

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
    filters: Record<string, any>
  ) => {
    if (results && results.length > 0) {
      searchCache.set(results)
    }

    const mapped: CompanyData[] = results.map(mapCompany)

    setCompanies(mapped)
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
  const handleNlpSearch = async (filters: Record<string, any>) => {
    setIsLoading(true)
    setHasSearched(false)
    setCompanies([])

    try {
      const response = await fetch(`/api/leads/search/companies`, {
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
      <FilterSidebar
        onSearch={handleSearch}
        initialFilters={restoredFilters}
        autoSearchOnMount={restored ? false : autoSearch}
        defaultPinnedIds={PINNED_FILTERS_DEFAULT}
        searchOptions={{ limit: 3, page: 1 }}
        hideCategoryHeaders
      />
      <div className="flex-1 flex flex-col min-w-0 p-4">
        <div className="mb-4 flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">In-DB Company Search</h1>
            <p className="text-sm text-muted-foreground">
              Search and filter companies from Explorium&apos;s business dataset. Use the filters on the left or describe what you need below.
            </p>
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
          onEnrichReveal={async (companyId, field) => {
            if (enrichedData[companyId]?.[field] || enrichingRows[companyId]) return
            // Find the company for this id
            const company = companies.find(c => (c.domain || c.id) === companyId)
            if (!company) return
            setEnrichingRows(prev => ({ ...prev, [companyId]: true }))
            // Set loading state in enrichCache
            setEnrichedData(prev => ({ ...prev, [companyId]: { success: false } as any }))
            const result = await enrichCompany(company.name, company.domain, field)
            setEnrichedData(prev => ({ ...prev, [companyId]: result }))
            setEnrichingRows(prev => ({ ...prev, [companyId]: false }))
          }}
          enrichCache={Object.fromEntries(
            Object.entries(enrichedData).map(([key, data]) => [
              key,
              enrichingRows[key]
                ? { loading: true }
                : data?.success && !data?.not_found
                  ? { email: data.email, phone: data.phone, contact_name: data.contact_name, contact_title: data.contact_title }
                  : {}
            ])
          )}
        />
      </div>
    </div>
  )
}
