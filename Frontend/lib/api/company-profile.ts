// Company Profile API client — one row per user describing what they
// sell and how agents should pitch it.  Every agent (Voice / Social /
// Co-Pilot) reads from this.

const API = "/api/v1/company-profile"

export interface CompanyProfile {
  company_name: string
  website_url: string
  one_liner: string
  product_description: string
  pricing_summary: string
  icp_description: string
  objection_handling: string
  key_differentiators: string
  additional_context: string
  agent_persona_name: string
  agent_persona_role: string
  calendar_booking_url: string
}

export interface CompanyProfileOut extends CompanyProfile {
  id: string | null
  created_at: string | null
  updated_at: string | null
}

async function fetchJson<T>(opts?: RequestInit): Promise<T> {
  const res = await fetch(API, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Company Profile API ${res.status}: ${body}`)
  }
  return res.json()
}

export const getCompanyProfile = () => fetchJson<CompanyProfileOut>()
export const updateCompanyProfile = (payload: CompanyProfile) =>
  fetchJson<CompanyProfileOut>({ method: "PUT", body: JSON.stringify(payload) })

export const EMPTY_PROFILE: CompanyProfile = {
  company_name: "",
  website_url: "",
  one_liner: "",
  product_description: "",
  pricing_summary: "",
  icp_description: "",
  objection_handling: "",
  key_differentiators: "",
  additional_context: "",
  agent_persona_name: "Alex",
  agent_persona_role: "GTM Specialist",
  calendar_booking_url: "",
}
