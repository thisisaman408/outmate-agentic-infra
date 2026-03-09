// API service for leads management - integrated with Product 4 backend

import { authService } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const DEFAULT_LEADS_LIMIT = 3
const DEFAULT_LEAD_FILTERS: LeadFilters = {
  industry: "software",
  companySize: "11-50",
  country_code: "us",
}

export interface Lead {
  id: string
  companyName: string
  industry: string
  employees: string
  contactName: string
  title: string
  email: string
  phone?: string
  location: string
  techStack?: string[]
  signalsCount: number
  score: number
  status: "new" | "contacted" | "qualified" | "unqualified"
  addedAt: string
  linkedin?: string
  experience?: string[]
}

export interface LeadFilters {
  location?: string
  region_country_code?: string | string[]
  industry?: string | string[]
  companySize?: string | string[]
  techStack?: string | string[]
  minScore?: number
  country_code?: string | string[]
  google_category?: string | string[]
  linkedin_category?: string | string[]
  company_type?: string | string[]
  funding_stage?: string | string[]
  keywords?: string | string[]
}

export interface GenerateLeadsRequest {
  prompt: string
  filters?: LeadFilters
  limit?: number
}

// Backend API response types
interface CompanySearchResponse {
  success: boolean
  source?: 'cache' | 'api'
  data?: {
    companies: Array<{
      id: string
      domain: string
      name: string
      industry: string
      employee_count: number | string
      revenue: number | string
      location: {
        country: string
        state: string
        city: string
      }
      technologies: string[]
      linkedin_url: string
      quality_score: number
    }>
    meta: {
      total_results: number
      returned_results: number
      credits_used: number
      remaining_credits: number
      execution_time_ms: number
    }
  }
  search_id?: string
  error?: {
    code: string
    message: string
    details?: any
  }
}

const fetchWithAuth = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value)
    }
  })
  return fetch(url, { ...init, headers })
}

const ensureArray = (value?: string | string[] | undefined): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }
  const arr = Array.isArray(value) ? value : [value]
  const normalized = arr
    .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
    .filter((v) => v)
  return normalized.length > 0 ? normalized : undefined
}


// Transform backend company data to frontend Lead format
export function transformCompanyToLead(company: any): Lead {
  const location = company.location
    ? `${company.location.city || ''}${company.location.city && company.location.state ? ', ' : ''}${company.location.state || ''}${(company.location.city || company.location.state) && company.location.country ? ', ' : ''}${company.location.country || ''}`
    : "Unknown"

  const contactName =
    company.contact_name ||
    company.contactName ||
    company.contactNameDisplay ||
    "Signal team"

  const contactTitle =
    company.contact_title ||
    company.contactTitle ||
    company.title ||
    "Team"

  const contactEmail =
    company.contact_email ||
    company.email ||
    company.work_email ||
    company.business_email ||
    company.personal_email ||
    `${company.domain?.replace(/^https?:\/\//, "") || "hello"}@${company.domain || "outmate.ai"}`

  const signalsCount = company.signals_count ?? company.signalsCount ?? 0
  const score = company.score ?? company.quality_score ?? 50

  return {
    id: company.id,
    companyName: company.name,
    industry: company.industry || "Unknown",
    employees: typeof company.employee_count === 'number'
      ? company.employee_count.toString()
      : company.employee_count || "Unknown",
    contactName,
    title: contactTitle,
    email: contactEmail,
    location: location.trim() || "Unknown",
    techStack: company.technologies || [],
    signalsCount,
    score,
    status: "new",
    addedAt: new Date().toISOString(),
    linkedin: company.linkedin_url,
  }
}

export const leadsApi = {
  generateLeads: async (request: GenerateLeadsRequest): Promise<Lead[]> => {
    try {
      const inputFilters = request.filters ?? {}
      const backendFilters: Record<string, any> = { ...inputFilters }

      const industryValues = ensureArray(inputFilters.industry)
      if (industryValues) {
        backendFilters.industry = industryValues
      }

      const location = inputFilters.location
      if (location) {
        backendFilters.location = location
      }

      const sizeValues = ensureArray(inputFilters.companySize)
      if (sizeValues) {
        backendFilters.company_size = sizeValues
        backendFilters.employees = sizeValues
        delete backendFilters.companySize
      }

      const regionValues = ensureArray(inputFilters.region_country_code)
      if (regionValues) {
        backendFilters.region_country_code = regionValues
      }

      const countryValues = ensureArray(inputFilters.country_code)
      if (countryValues) {
        backendFilters.country_code = countryValues
      }

      const googleCategory = ensureArray(inputFilters.google_category)
      if (googleCategory) {
        backendFilters.google_category = googleCategory
      }

      const linkedinCategory = ensureArray(inputFilters.linkedin_category)
      if (linkedinCategory) {
        backendFilters.linkedin_category = linkedinCategory
      }

      const keywords = ensureArray(inputFilters.keywords)
      if (keywords) {
        backendFilters.keywords = keywords
      }

      const companyType = ensureArray(inputFilters.company_type)
      if (companyType) {
        backendFilters.company_type = companyType
      }

      const fundingStages = ensureArray(inputFilters.funding_stage)
      if (fundingStages) {
        backendFilters.funding_stage = fundingStages
      }

      const techStack = inputFilters.techStack
      if (techStack) {
        backendFilters.technologies = Array.isArray(techStack)
          ? techStack
          : techStack.split(',').map((s) => s.trim()).filter((s) => s)
      }

      // Call backend API
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/leads/search/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: backendFilters,
          options: {
            limit: request.limit ?? DEFAULT_LEADS_LIMIT,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result: CompanySearchResponse = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch companies')
      }

      // Transform backend response to frontend Lead format
      return result.data.companies.map(transformCompanyToLead)

    } catch (error) {
      console.error('Error generating leads:', error)
      throw error
    }
  },

  getLeads: async (request?: GenerateLeadsRequest): Promise<Lead[]> => {
    const mergedFilters: LeadFilters = {
      ...(request?.filters ?? {}),
    }

    if (!mergedFilters.industry) {
      mergedFilters.industry = DEFAULT_LEAD_FILTERS.industry
    }
    if (!mergedFilters.companySize) {
      mergedFilters.companySize = DEFAULT_LEAD_FILTERS.companySize
    }
    if (!mergedFilters.country_code) {
      mergedFilters.country_code = DEFAULT_LEAD_FILTERS.country_code
    }

    return leadsApi.generateLeads({
      prompt: request?.prompt ?? "",
      filters: mergedFilters,
      limit: request?.limit ?? DEFAULT_LEADS_LIMIT,
    })
  },

  updateLeadStatus: async (leadId: string, status: Lead["status"]): Promise<void> => {
    // This would call a backend endpoint to update lead status
    // For now, just log it
    console.log(`Updated lead ${leadId} to status ${status}`)
    return Promise.resolve()
  },
}
