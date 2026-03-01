// API service for leads management - integrated with Product 4 backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const DEFAULT_LEADS_LIMIT = 3
const DEFAULT_LEAD_FILTERS: LeadFilters = {
  industry: "software",
  companySize: "11-50",
  country_code: "us",
  google_category: "software company",
  linkedin_category: "software development",
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
  industry?: string | string[]
  companySize?: string
  techStack?: string | string[]
  minScore?: number
  country_code?: string | string[]
  google_category?: string | string[]
  linkedin_category?: string | string[]
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

// Transform backend company data to frontend Lead format
function transformCompanyToLead(company: any): Lead {
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
      // Transform frontend filters to backend format
      const backendFilters: Record<string, any> = {}

      if (request.filters?.industry) {
        backendFilters.industry = Array.isArray(request.filters.industry)
          ? request.filters.industry
          : [request.filters.industry]
      }

      if (request.filters?.location) {
        // Parse location string (e.g., "San Francisco, CA")
        const locationParts = request.filters.location.split(',').map(s => s.trim())
        if (locationParts.length >= 2) {
          backendFilters.location = {
            city: locationParts[0],
            state: locationParts[1]
          }
        } else if (locationParts.length === 1) {
          backendFilters.location = {
            country: locationParts[0]
          }
        }
      }

      if (request.filters?.companySize) {
        backendFilters.company_size = [request.filters.companySize]
        backendFilters.employees = [request.filters.companySize]
      }

      if (request.filters?.techStack) {
        backendFilters.technologies = request.filters.techStack.split(',').map(s => s.trim())
      }

      if (request.filters?.country_code) {
        backendFilters.country_code = Array.isArray(request.filters.country_code)
          ? request.filters.country_code.map((v) => String(v))
          : [String(request.filters.country_code)]
      }

      if (request.filters?.google_category) {
        backendFilters.google_category = Array.isArray(request.filters.google_category)
          ? request.filters.google_category
          : [request.filters.google_category]
      }

      if (request.filters?.linkedin_category) {
        backendFilters.linkedin_category = Array.isArray(request.filters.linkedin_category)
          ? request.filters.linkedin_category
          : [request.filters.linkedin_category]
      }

      if (request.filters?.country_code) {
        backendFilters.country_code = Array.isArray(request.filters.country_code)
          ? request.filters.country_code
          : [request.filters.country_code]
      }

      if (request.filters?.google_category) {
        backendFilters.google_category = Array.isArray(request.filters.google_category)
          ? request.filters.google_category
          : [request.filters.google_category]
      }

      if (request.filters?.linkedin_category) {
        backendFilters.linkedin_category = Array.isArray(request.filters.linkedin_category)
          ? request.filters.linkedin_category
          : [request.filters.linkedin_category]
      }

      // Call backend API
      const response = await fetch(`${API_BASE_URL}/api/leads/search/companies`, {
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
    const filterInput = request?.filters
    const mergedFilters: LeadFilters = {
      industry: filterInput?.industry ?? DEFAULT_LEAD_FILTERS.industry,
      location: filterInput?.location ?? DEFAULT_LEAD_FILTERS.location,
      companySize: filterInput?.companySize,
      techStack: filterInput?.techStack,
      minScore: filterInput?.minScore,
    }

    const finalRequest: GenerateLeadsRequest = {
      prompt: request?.prompt ?? "",
      filters: mergedFilters,
      limit: request?.limit ?? DEFAULT_LEADS_LIMIT,
    }

    return leadsApi.generateLeads(finalRequest)
  },

  updateLeadStatus: async (leadId: string, status: Lead["status"]): Promise<void> => {
    // This would call a backend endpoint to update lead status
    // For now, just log it
    console.log(`Updated lead ${leadId} to status ${status}`)
    return Promise.resolve()
  },
}
