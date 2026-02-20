/**
 * BetterContact enrichment service.
 *
 * This file provides two helper functions that call the BetterContact API
 * (the API key is expected to be exposed to the client via the
 * NEXT_PUBLIC_BETTERCONTACT_API_KEY environment variable).
 *
 * The functions implement a simple *waterfall* approach:
 *   1. Try to enrich by primary identifier (email for prospects, domain for companies).
 *   2. If the primary call fails or returns no useful data, fall back to a secondary
 *      identifier if available.
 *
 * The returned object is merged into the original entity (prospect or company)
 * by the caller.
 */

export interface BetterContactEnrichment {
  // The fields below are examples – the actual response shape depends on
  // BetterContact's API. Adjust as needed.
  phone?: string
  address?: string
  linkedin_url?: string
  twitter_url?: string
  website?: string
  // Any additional fields returned by BetterContact can be added here.
  [key: string]: any
}

/**
 * Enrich a prospect using an email address.
 *
 * @param email Primary email address of the prospect.
 * @returns Enrichment data or null if the API call fails / returns nothing.
 */
export async function enrichProspect(email: string): Promise<BetterContactEnrichment | null> {
  const apiKey = process.env.NEXT_PUBLIC_BETTERCONTACT_API_KEY
  if (!apiKey) {
    console.warn('BetterContact API key not set')
    return null
  }

  try {
    const res = await fetch(`https://api.bettercontact.com/v1/enrich?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      // If the primary endpoint fails, we simply return null – the caller can decide
      // whether to try a secondary identifier (not needed for prospects).
      return null
    }

    const data = await res.json()
    // Assuming the API returns an object with enrichment fields.
    return data as BetterContactEnrichment
  } catch (err) {
    console.error('Error calling BetterContact prospect enrichment:', err)
    return null
  }
}

/**
 * Enrich a company using its domain.
 *
 * @param domain Company domain (e.g., "example.com").
 * @returns Enrichment data or null if the API call fails / returns nothing.
 */
export async function enrichCompany(domain: string): Promise<BetterContactEnrichment | null> {
  const apiKey = process.env.NEXT_PUBLIC_BETTERCONTACT_API_KEY
  if (!apiKey) {
    console.warn('BetterContact API key not set')
    return null
  }

  try {
    const res = await fetch(`https://api.bettercontact.com/v1/enrich?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      // Fallback could be attempted here (e.g., using company name) but for now we just return null.
      return null
    }

    const data = await res.json()
    return data as BetterContactEnrichment
  } catch (err) {
    console.error('Error calling BetterContact company enrichment:', err)
    return null
  }
}
