/**
 * BetterContact Waterfall Enrichment Service.
 * Calls the backend API which handles the async BetterContact flow.
 */

import { authService } from "@/lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) headers[key] = value
  })
  return headers
}

export interface ProspectEnrichmentResult {
  success: boolean
  email?: string
  email_status?: string
  phone?: string
  error?: string
  not_found?: boolean
  credits_consumed?: number
  credits_left?: number
  confidence?: 'verified' | 'inferred'
}

export interface CompanyEnrichmentResult {
  success: boolean
  contact_name?: string
  contact_title?: string
  email?: string
  phone?: string
  linkedin_url?: string
  error?: string
  not_found?: boolean
  credits_consumed?: number
  credits_left?: number
  confidence?: 'verified' | 'inferred'
}

export async function enrichProspectContactOut(
  linkedinUrl: string,
  includePhone: boolean = true
): Promise<ProspectEnrichmentResult> {
  try {
    const res = await fetch(`${API}/api/v1/contactout/reveal-contact`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        linkedin_url: linkedinUrl,
        include_phone: includePhone
      }),
    })

    if (!res.ok) {
      return { success: false, error: `ContactOut error: ${res.status}` }
    }

    const result = await res.json()
    if (result.success && result.data) {
      return {
        success: true,
        email: result.data.emails?.[0] || result.data.work_emails?.[0] || result.data.personal_emails?.[0],
        phone: result.data.phones?.[0],
        confidence: 'verified'
      }
    }
    return { success: false, not_found: true }
  } catch (err: any) {
    console.error("ContactOut prospect enrichment error:", err)
    return { success: false, error: err.message || "Network error" }
  }
}

export async function enrichCompanyContactOut(
  domain: string,
  includePhone: boolean = true
): Promise<CompanyEnrichmentResult> {
  try {
    const res = await fetch(`${API}/api/v1/contactout/reveal-company-contact`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        domain: domain,
        include_phone: includePhone
      }),
    })

    if (!res.ok) {
      return { success: false, error: `ContactOut error: ${res.status}` }
    }

    const result = await res.json()
    if (result.success && result.data) {
      return {
        success: true,
        email: result.data.emails?.[0] || result.data.work_emails?.[0] || result.data.personal_emails?.[0],
        phone: result.data.phones?.[0],
        not_found: false
      }
    }
    return { success: false, not_found: true }
  } catch (err: any) {
    console.error("ContactOut company enrichment error:", err)
    return { success: false, error: err.message || "Network error" }
  }
}

export async function enrichProspect(
  firstName: string,
  lastName: string,
  companyName?: string,
  companyDomain?: string,
  linkedinUrl?: string,
  field?: 'email' | 'phone'
): Promise<ProspectEnrichmentResult> {
  console.log('Calling enrichProspect API:', { firstName, lastName, companyName, companyDomain, linkedinUrl, field })
  try {
    const res = await fetch(`${API}/api/v1/bettercontact/enrich-prospect`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        company_name: companyName || "",
        company_domain: companyDomain || "",
        linkedin_url: linkedinUrl || "",
        field: field || 'email'  // Default to email if not specified
      }),
    })

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` }
    }

    const result = await res.json()
    return { ...result, confidence: result.success ? 'verified' : 'inferred' }
  } catch (err: any) {
    console.error("BetterContact prospect enrichment error:", err)
    return { success: false, error: err.message || "Network error" }
  }
}

export async function enrichCompany(
  companyName: string,
  companyDomain?: string,
  field?: 'email' | 'phone'
): Promise<CompanyEnrichmentResult> {
  console.log('Calling enrichCompany API:', { companyName, companyDomain, field })
  try {
    const res = await fetch(`${API}/api/v1/bettercontact/enrich-company`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        company_name: companyName,
        company_domain: companyDomain || "",
        field: field || 'email'  // Default to email if not specified
      }),
    })

    console.log('enrichCompany API response status:', res.status)
    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` }
    }

    const result = await res.json()
    console.log('enrichCompany API result:', result)

    // Return both email and phone when available to avoid wasting API calls
    return {
      success: result.success,
      email: result.email,
      phone: result.phone,
      contact_name: result.contact_name,
      contact_title: result.contact_title,
      linkedin_url: result.linkedin_url,
      error: result.error,
      not_found: result.not_found,
      credits_consumed: result.credits_consumed,
      credits_left: result.credits_left,
    }
  } catch (err: any) {
    console.error("BetterContact company enrichment error:", err)
    return { success: false, error: err.message || "Network error" }
  }
}
