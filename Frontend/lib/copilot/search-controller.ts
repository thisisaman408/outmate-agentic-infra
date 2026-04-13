/**
 * SEARCH EXECUTION CONTROLLER
 * Executes real API searches for each module using applied filters from store.
 * Called by tool-handlers.ts when Claude triggers execute_search.
 */

'use client'

import { useCoPilotAgentStore, ExecutionResult } from './agent-store'
import { leadsApi, LeadFilters } from '@/lib/api/leads'
import { signalsApi } from '@/lib/api/signals'
import { getModuleSchema } from './module-schemas'
import { authService } from '@/lib/auth'

const BACKEND_BASE = ''

export interface SearchResult {
  module: string
  status: 'success' | 'error'
  resultCount: number
  results: unknown[]
  summary: string
  error?: string
  timestamp: number
}

/**
 * Maps agent store filter keys → leadsApi filter shape
 */
function mapProspectFilters(filters: Record<string, unknown>): LeadFilters {
  const mapped: LeadFilters = {}

  if (filters.industry) mapped.industry = filters.industry as string | string[]
  if (filters.company_size) mapped.companySize = filters.company_size as string | string[]
  if (filters.location) mapped.location = filters.location as string
  if (filters.job_title) {
    // job_title maps to keywords search on backend
    mapped.keywords = filters.job_title as string
  }
  if (filters.tech_stack) mapped.techStack = filters.tech_stack as string | string[]
  if (filters.funding_stage) mapped.funding_stage = filters.funding_stage as string | string[]
  if (filters.keywords) mapped.keywords = filters.keywords as string

  return mapped
}

export class SearchController {
  private store: typeof useCoPilotAgentStore

  constructor() {
    this.store = useCoPilotAgentStore
  }

  /**
   * Execute search for a given module using its current applied filters.
   * Updates the store's executionResults on success or error.
   */
  async executeSearch(module: string): Promise<SearchResult> {
    const schema = getModuleSchema(module)
    if (!schema) {
      return this._errorResult(module, `Unknown module: ${module}`)
    }

    const filters = this.store.getState().appliedFilters[module] || {}

    try {
      switch (module) {
        case 'prospects':
          return await this._searchProspects(filters)
        case 'companies':
          return await this._searchCompanies(filters)
        case 'company_identification':
          return await this._searchCompanyIdentification(filters)
        case 'company_enrichment':
          return await this._searchCompanyEnrichment(filters)
        case 'company_social_posts':
          return await this._searchCompanySocialPosts(filters)
        case 'social_keyword_search':
          return await this._searchSocialKeyword(filters)
        case 'intents':
          return await this._searchIntents(filters)
        case 'events':
          return await this._searchEvents(filters)
        case 'websights':
          return await this._searchWebsights(filters)
        case 'form_complete':
          return await this._searchFormCompletions(filters)
        case 'trackers':
          return await this._searchTrackers(filters)
        case 'global_search':
          return await this._searchGlobal(filters)
        case 'watcher':
          return this._searchWatcher()
        default:
          return this._errorResult(module, `Search not yet implemented for module: ${module}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      return this._errorResult(module, msg)
    }
  }

  // ── Prospects ──────────────────────────────────────────────────────────

  private async _searchProspects(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const leadFilters = mapProspectFilters(filters)
    const results = await leadsApi.getLeads({ prompt: '', filters: leadFilters })

    const count = Array.isArray(results) ? results.length : 0
    const summary = count > 0
      ? `Found ${count} prospect${count !== 1 ? 's' : ''} matching your criteria.`
      : 'No prospects found — try broadening your filters.'

    const execResult: ExecutionResult = {
      module: 'prospects',
      status: 'success',
      resultCount: count,
      results: results as unknown[],
      timestamp: Date.now(),
    }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'prospects', status: 'success', resultCount: count, results: results as unknown[], summary, timestamp: Date.now() }
  }

  // ── Companies (In-DB Search) ──────────────────────────────────────────

  private async _searchCompanies(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const mapped: Record<string, unknown> = {}
    if (filters.industry) mapped.industry = filters.industry
    if (filters.company_size) mapped.employee_count = filters.company_size
    if (filters.employee_count_range) mapped.employee_count = filters.employee_count_range
    if (filters.location) mapped.country = filters.location
    if (filters.headquarters_country) mapped.country = filters.headquarters_country
    if (filters.funding_stage) mapped.funding_stage = filters.funding_stage
    if (filters.recent_funding_activity !== undefined) mapped.recent_funding_activity = filters.recent_funding_activity
    if (filters.tech_stack) mapped.technologies = filters.tech_stack
    if (filters.tech_stack_keywords) mapped.tech_stack_keywords = filters.tech_stack_keywords
    if (filters.name) mapped.name = String(filters.name)
    if (filters.domain) mapped.domain = String(filters.domain)
    if (filters.keywords) mapped.keyword = String(filters.keywords)
    if (filters.operational_regions) mapped.operational_regions = filters.operational_regions
    if (filters.google_categories) mapped.google_categories = filters.google_categories
    if (filters.intent_topics) mapped.intent_topics = filters.intent_topics
    if (filters.business_event_signals) mapped.business_event_signals = filters.business_event_signals
    if (filters.ai_search) mapped.ai_search = String(filters.ai_search)

    const token = typeof window !== 'undefined' ? authService.getToken() : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BACKEND_BASE}/api/v1/leads/search/companies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filters: mapped, options: { limit: 10 } }),
    })

    if (!res.ok) throw new Error(`Companies API returned ${res.status}`)

    const data = await res.json()
    const results: unknown[] = Array.isArray(data)
      ? data
      : (data.results ?? data.companies ?? data.data ?? [])
    const count = results.length
    const summary = count > 0
      ? `Found ${count} compan${count !== 1 ? 'ies' : 'y'} matching your criteria.`
      : 'No companies found — try broadening your filters.'

    const execResult: ExecutionResult = {
      module: 'companies',
      status: 'success',
      resultCount: count,
      results,
      timestamp: Date.now(),
    }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'companies', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
  }

  // ── Company Identification ─────────────────────────────────────────────

  private async _searchCompanyIdentification(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const body: Record<string, unknown> = {
      exact_match: filters.exact_match ?? false,
      count: filters.num_results ?? 10,
    }
    if (filters.company_name) body.query_company_name = filters.company_name
    if (filters.domain) body.query_company_website = filters.domain
    if (filters.profile_url) body.query_company_linkedin_url = filters.profile_url
    if (filters.company_profile_url) body.query_company_crunchbase_url = filters.company_profile_url
    if (filters.company_id) body.query_company_id = filters.company_id

    const token = typeof window !== 'undefined' ? authService.getToken() : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BACKEND_BASE}/api/v1/crustdata/identify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Company Identification API returned ${res.status}`)

    const data = await res.json()
    const results: unknown[] = Array.isArray(data) ? data : []
    const count = results.length
    const identifier = String(filters.company_name || filters.domain || filters.profile_url || filters.company_id || 'company')
    const summary = count > 0
      ? `Found ${count} match${count !== 1 ? 'es' : ''} for "${identifier}".`
      : `No company found for "${identifier}" — try a different identifier.`

    const execResult: ExecutionResult = { module: 'company_identification', status: 'success', resultCount: count, results, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'company_identification', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
  }

  // ── Company Enrichment ────────────────────────────────────────────────

  private async _searchCompanyEnrichment(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const params = new URLSearchParams()
    if (filters.domains) params.append('company_domain', String(filters.domains))
    if (filters.company_names) params.append('company_name', String(filters.company_names))
    if (filters.company_ids) params.append('company_id', String(filters.company_ids))
    if (filters.profile_urls) params.append('company_linkedin_url', String(filters.profile_urls))
    if (filters.fields) params.append('fields', String(filters.fields))
    if (filters.exact_match) params.append('exact_match', 'true')
    if (filters.realtime) params.append('enrich_realtime', 'true')

    const token = typeof window !== 'undefined' ? authService.getToken() : null
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BACKEND_BASE}/api/v1/crustdata/enrich?${params.toString()}`, { headers })

    if (!res.ok) throw new Error(`Company Enrichment API returned ${res.status}`)

    const data = await res.json()
    const results: unknown[] = Array.isArray(data) ? data : [data]
    const count = results.length
    const identifier = String(filters.domains || filters.company_names || filters.company_ids || 'companies')
    const summary = count > 0
      ? `Enriched ${count} compan${count !== 1 ? 'ies' : 'y'} for "${identifier}".`
      : `No enrichment data found for "${identifier}".`

    const execResult: ExecutionResult = { module: 'company_enrichment', status: 'success', resultCount: count, results, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'company_enrichment', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
  }

  // ── Company Social Posts ──────────────────────────────────────────────

  private async _searchCompanySocialPosts(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const params = new URLSearchParams()
    if (filters.domain) params.append('company_domain', String(filters.domain))
    if (filters.company_name) params.append('company_name', String(filters.company_name))
    if (filters.company_id) params.append('company_id', String(filters.company_id))
    if (filters.profile_url) params.append('company_linkedin_url', String(filters.profile_url))
    if (filters.post_url) params.append('linkedin_post_url', String(filters.post_url))
    if (filters.fields) params.append('fields', String(filters.fields))
    params.append('page', String(filters.page || '1'))
    params.append('limit', String(filters.limit || '5'))
    params.append('post_types', String(filters.post_types || 'repost, original'))

    const token = typeof window !== 'undefined' ? authService.getToken() : null
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BACKEND_BASE}/api/v1/crustdata/linkedin_posts?${params.toString()}`, { headers })

    if (!res.ok) throw new Error(`LinkedIn Posts API returned ${res.status}`)

    const data = await res.json()
    const results: unknown[] = data.posts ?? (Array.isArray(data) ? data : [])
    const count = results.length
    const identifier = String(filters.company_name || filters.domain || filters.profile_url || 'company')
    const summary = count > 0
      ? `Found ${count} LinkedIn post${count !== 1 ? 's' : ''} from ${identifier}.`
      : `No LinkedIn posts found for ${identifier}.`

    const execResult: ExecutionResult = { module: 'company_social_posts', status: 'success', resultCount: count, results, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'company_social_posts', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
  }

  // ── Social Posts Keyword Search ───────────────────────────────────────

  private async _searchSocialKeyword(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const body: Record<string, unknown> = {
      keyword: filters.keyword,
      exact_keyword_match: Boolean(filters.exact_match ?? false),
      sort_by: filters.sort_by || 'relevance',
      date_posted: filters.date_range || 'past-month',
      page: parseInt(String(filters.page || '1')),
      limit: parseInt(String(filters.limit || '5')),
    }
    const advFilters: Record<string, unknown>[] = []
    if (filters.author_industry) {
      advFilters.push({ filter_type: 'AUTHOR_INDUSTRY', type: 'in', value: String(filters.author_industry).split(',').map(s => s.trim()) })
    }
    if (filters.author_title) {
      advFilters.push({ filter_type: 'AUTHOR_TITLE', type: 'in', value: String(filters.author_title).split(',').map(s => s.trim()) })
    }
    if (advFilters.length > 0) body.filters = advFilters

    const token = typeof window !== 'undefined' ? authService.getToken() : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BACKEND_BASE}/api/v1/crustdata/linkedin_posts/keyword_search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Social Keyword Search API returned ${res.status}`)

    const data = await res.json()
    const results: unknown[] = data.posts ?? (Array.isArray(data) ? data : [])
    const count = results.length
    const kw = String(filters.keyword || '')
    const summary = count > 0
      ? `Found ${count} LinkedIn post${count !== 1 ? 's' : ''} mentioning "${kw}".`
      : `No posts found for "${kw}" — try different keywords or a broader date range.`

    const execResult: ExecutionResult = { module: 'social_keyword_search', status: 'success', resultCount: count, results, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'social_keyword_search', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
  }

  // ── Intents ───────────────────────────────────────────────────────────

  private async _searchIntents(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    // Use previewSignal for intent queries so we don't mutate existing signals
    const topic = (filters.topic as string) || ''
    const config: Record<string, unknown> = { topic }
    if (filters.timeframe) config.timeframe = filters.timeframe
    if (filters.threshold) config.threshold = filters.threshold

    const results = await signalsApi.previewSignal('intent', config)
    const count = Array.isArray(results) ? results.length : 0
    const summary = count > 0
      ? `Found ${count} intent signal${count !== 1 ? 's' : ''} for "${topic}".`
      : `No intent signals found for "${topic}" — try a broader topic or different timeframe.`

    const execResult: ExecutionResult = {
      module: 'intents',
      status: 'success',
      resultCount: count,
      results: Array.isArray(results) ? results : [],
      timestamp: Date.now(),
    }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'intents', status: 'success', resultCount: count, results: Array.isArray(results) ? results : [], summary, timestamp: Date.now() }
  }

  // ── Events ────────────────────────────────────────────────────────────

  private async _searchEvents(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const eventType = (filters.event_type as string) || 'all'
    const results = await signalsApi.previewSignal('event', { event_type: eventType, ...filters })
    const count = Array.isArray(results) ? results.length : 0
    const summary = count > 0
      ? `Found ${count} event${count !== 1 ? 's' : ''}.`
      : 'No events found for the given criteria.'

    const execResult: ExecutionResult = {
      module: 'events',
      status: 'success',
      resultCount: count,
      results: Array.isArray(results) ? results : [],
      timestamp: Date.now(),
    }
    this.store.setState((s) => { s.executionResults.push(execResult) })

    return { module: 'events', status: 'success', resultCount: count, results: Array.isArray(results) ? results : [], summary, timestamp: Date.now() }
  }

  // ── Websights ─────────────────────────────────────────────────────────

  private async _searchWebsights(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const domain = (filters.domain as string) || ''
    const dateRange = (filters.date_range as string) || 'last_30_days'

    try {
      const token = typeof window !== 'undefined' ? authService.getToken() : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`${BACKEND_BASE}/api/v1/signals/websights/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain, date_range: dateRange, ...filters }),
      })

      if (!res.ok) throw new Error(`API returned ${res.status}`)

      const data = await res.json()
      const results: unknown[] = Array.isArray(data) ? data : (data.results ?? data.visitors ?? [])
      const count = results.length
      const summary = count > 0
        ? `Found ${count} visitor record${count !== 1 ? 's' : ''} for ${domain}.`
        : `No website visitor data found for ${domain} in the ${dateRange.replace(/_/g, ' ')}.`

      const execResult: ExecutionResult = { module: 'websights', status: 'success', resultCount: count, results, timestamp: Date.now() }
      this.store.setState((s) => { s.executionResults.push(execResult) })
      return { module: 'websights', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
    } catch {
      const summary = domain
        ? `Websights data for ${domain} is available at /signals/websights. Navigate there to view visitor analytics.`
        : 'Navigate to /signals/websights to view your website visitor analytics.'
      const execResult: ExecutionResult = { module: 'websights', status: 'success', resultCount: 0, results: [], timestamp: Date.now() }
      this.store.setState((s) => { s.executionResults.push(execResult) })
      return { module: 'websights', status: 'success', resultCount: 0, results: [], summary, timestamp: Date.now() }
    }
  }

  // ── Form Completions ──────────────────────────────────────────────────

  private async _searchFormCompletions(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const domain = (filters.domain as string) || ''
    const dateRange = (filters.date_range as string) || 'last_30_days'

    try {
      const token = typeof window !== 'undefined' ? authService.getToken() : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`${BACKEND_BASE}/api/v1/signals/form-complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain, date_range: dateRange, ...filters }),
      })

      if (!res.ok) throw new Error(`API returned ${res.status}`)

      const data = await res.json()
      const results: unknown[] = Array.isArray(data) ? data : (data.results ?? data.submissions ?? [])
      const count = results.length
      const formType = (filters.form_type as string) || 'all'
      const summary = count > 0
        ? `Found ${count} form submission${count !== 1 ? 's' : ''} (type: ${formType}) for ${domain}.`
        : `No form submissions found for ${domain} in the ${dateRange.replace(/_/g, ' ')}.`

      const execResult: ExecutionResult = { module: 'form_complete', status: 'success', resultCount: count, results, timestamp: Date.now() }
      this.store.setState((s) => { s.executionResults.push(execResult) })
      return { module: 'form_complete', status: 'success', resultCount: count, results, summary, timestamp: Date.now() }
    } catch {
      const summary = domain
        ? `Form completion data for ${domain} is available at /signals/form-complete.`
        : 'Navigate to /signals/form-complete to view form submission signals.'
      const execResult: ExecutionResult = { module: 'form_complete', status: 'success', resultCount: 0, results: [], timestamp: Date.now() }
      this.store.setState((s) => { s.executionResults.push(execResult) })
      return { module: 'form_complete', status: 'success', resultCount: 0, results: [], summary, timestamp: Date.now() }
    }
  }

  // ── Trackers ──────────────────────────────────────────────────────────

  private async _searchTrackers(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const signals = await signalsApi.getSignals()
    const keyword = ((filters.keyword as string) || '').toLowerCase()
    const category = ((filters.category as string) || '').toLowerCase()

    let filtered = signals
    if (keyword) {
      filtered = signals.filter(
        (s) =>
          s.name.toLowerCase().includes(keyword) ||
          JSON.stringify(s.configuration).toLowerCase().includes(keyword)
      )
    }
    if (category) {
      filtered = filtered.filter((s) => s.category?.toLowerCase() === category)
    }

    const count = filtered.length
    const summary = count > 0
      ? `Found ${count} tracker${count !== 1 ? 's' : ''}${keyword ? ` matching "${keyword}"` : ''}.`
      : `No trackers found${keyword ? ` for "${keyword}"` : ''}. Visit /signals/trackers to create one.`

    const execResult: ExecutionResult = { module: 'trackers', status: 'success', resultCount: count, results: filtered, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })
    return { module: 'trackers', status: 'success', resultCount: count, results: filtered, summary, timestamp: Date.now() }
  }

  // ── Global Search ─────────────────────────────────────────────────────

  private async _searchGlobal(
    filters: Record<string, unknown>
  ): Promise<SearchResult> {
    const query = (filters.query as string) || ''

    const [prospectsSettled, intentsSettled] = await Promise.allSettled([
      this._searchProspects({ keywords: query }),
      this._searchIntents({ topic: query }),
    ])

    const prospects = prospectsSettled.status === 'fulfilled' ? prospectsSettled.value.results : []
    const intents = intentsSettled.status === 'fulfilled' ? intentsSettled.value.results : []
    const combined = [...prospects, ...intents]
    const count = combined.length

    const summary = count > 0
      ? `Found ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} and ${intents.length} intent signal${intents.length !== 1 ? 's' : ''} for "${query}".`
      : `No results found across prospects or intents for "${query}".`

    const execResult: ExecutionResult = { module: 'global_search', status: 'success', resultCount: count, results: combined, timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })
    return { module: 'global_search', status: 'success', resultCount: count, results: combined, summary, timestamp: Date.now() }
  }

  // ── Watcher ───────────────────────────────────────────────────────────

  private _searchWatcher(): SearchResult {
    const summary = 'Watcher monitors are at /leads/watcher. Navigate there to view tracked accounts and leads, or create a new watcher.'
    const execResult: ExecutionResult = { module: 'watcher', status: 'success', resultCount: 0, results: [], timestamp: Date.now() }
    this.store.setState((s) => { s.executionResults.push(execResult) })
    return { module: 'watcher', status: 'success', resultCount: 0, results: [], summary, timestamp: Date.now() }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private _errorResult(module: string, message: string): SearchResult {
    const execResult: ExecutionResult = {
      module,
      status: 'error',
      error: message,
      timestamp: Date.now(),
    }
    this.store.setState((s) => { s.executionResults.push(execResult) })
    return { module, status: 'error', resultCount: 0, results: [], summary: message, error: message, timestamp: Date.now() }
  }

  /**
   * Get summary of the most recent execution result for a module
   */
  getSummary(module: string): string {
    const results = this.store.getState().executionResults
    const last = [...results].reverse().find((r) => r.module === module)
    if (!last) return 'No search has been run yet.'
    if (last.status === 'error') return `Search failed: ${last.error}`
    const count = last.resultCount ?? 0
    return `Found ${count} result${count !== 1 ? 's' : ''} in ${module}.`
  }
}

// Singleton
let searchControllerInstance: SearchController | null = null

export function getSearchController(): SearchController {
  if (!searchControllerInstance) {
    searchControllerInstance = new SearchController()
  }
  return searchControllerInstance
}
