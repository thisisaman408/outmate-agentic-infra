/**
 * BetterContact Waterfall Enrichment Service.
 * Calls the backend API which handles the async BetterContact flow.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface ProspectEnrichmentResult {
  success: boolean
  email?: string
  email_status?: string
  phone?: string
  error?: string
  not_found?: boolean
  credits_consumed?: number
  credits_left?: number
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
      headers: { "Content-Type": "application/json" },
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

    return await res.json()
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
      headers: { "Content-Type": "application/json" },
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

    // Return only the requested field to make enrichment field-specific
    const fieldResult: CompanyEnrichmentResult = {
      success: result.success,
      error: result.error,
      not_found: result.not_found,
      credits_consumed: result.credits_consumed,
      credits_left: result.credits_left
    }

    if (field === 'email') {
      fieldResult.email = result.email
    } else if (field === 'phone') {
      fieldResult.phone = result.phone
    }

    return fieldResult
  } catch (err: any) {
    console.error("BetterContact company enrichment error:", err)
    return { success: false, error: err.message || "Network error" }
  }
}
