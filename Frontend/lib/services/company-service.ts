/**
 * Company Search API Service
 * Handles all API calls related to company searching via backend
 */

// Type definitions for company search
export interface CompanySearchFilters {
  name?: string;
  industry?: string[];
  location?: string[];
  size?: string[];
  revenue?: string[];
  keyword?: string;
  limit?: number;
  cursor?: string | null;
}

export interface CompanyProfile {
  id: string;
  name: string;
  domain: string;
  description: string;
  industry: string;
  size: string;
  location: string;
  founded: string;
  website: string;
  linkedin: string;
  funding: string;
  revenue: string;
}

export interface CompanySearchResponse {
  companies: CompanyProfile[];
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface CompanySearchError {
  detail: string;
  status_code?: number;
  error_type?: string;
}

/**
 * Search for companies using filters
 * @param filters Search filters (name, industry, location, etc.)
 * @returns Promise with search results
 */
export async function searchCompanies(
  filters: CompanySearchFilters
): Promise<CompanySearchResponse> {
  try {
    console.log("🚀 [Frontend] Company Search Request:", JSON.stringify(filters, null, 2));

    // This would be the actual API call to your backend
    // For now, returning mock data to match the expected structure
    const response = await fetch('/api/companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [Frontend] Company search failed:', error);
    throw error;
  }
}
