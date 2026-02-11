// API service for leads management - integrated with Product 4 backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  industry?: string
  companySize?: string
  techStack?: string
  minScore?: number
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

  return {
    id: company.id,
    companyName: company.name,
    industry: company.industry || "Unknown",
    employees: typeof company.employee_count === 'number'
      ? company.employee_count.toString()
      : company.employee_count || "Unknown",
    contactName: "Contact Discovery In Progress", // Placeholder - would need prospect search
    title: "—",
    email: "—",
    location: location.trim() || "Unknown",
    techStack: company.technologies || [],
    signalsCount: 0, // Would need signal enrichment
    score: company.quality_score || 50,
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
        backendFilters.industry = [request.filters.industry]
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
        backendFilters.employees = [request.filters.companySize]
      }

      if (request.filters?.techStack) {
        backendFilters.technologies = request.filters.techStack.split(',').map(s => s.trim())
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
            limit: request.limit || 50
          }
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

  getLeads: async (filters?: LeadFilters): Promise<Lead[]> => {
    // For now, this can use the same implementation as generateLeads
    // In the future, this might fetch from a saved leads table
    return leadsApi.generateLeads({
      prompt: "",
      filters,
      limit: 100
    })
  },

  updateLeadStatus: async (leadId: string, status: Lead["status"]): Promise<void> => {
    // This would call a backend endpoint to update lead status
    // For now, just log it
    console.log(`Updated lead ${leadId} to status ${status}`)
    return Promise.resolve()
  },
}
