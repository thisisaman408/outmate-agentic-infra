/**
 * Company Search API Service
 * Handles all API calls related to company searching via backend
 */

const API_BASE_URL = '';

// ==================== TYPE DEFINITIONS ====================

export interface CompanySearchFilters {
    market_segments?: string[];
    industries?: string[];
    categories?: string[];
    company_types?: string[];
    locations?: string[];
    employees?: string[];
    limit?: number;
    cursor?: string | null;
    // Add other filters as needed
}

export interface CompanyProfile {
    company_id: number;
    company_name: string;
    company_website: string;
    company_linkedin_url: string;
    company_logo_url: string;
    description: string;
    hq_location: string;
    company_type: string;
    year_founded: number;
    employee_count_range: string;
    employee_count_latest: number;
    industries: string[];
    markets: string[];
    // Add other fields as needed based on API response
}

export interface CompanySearchResponse {
    companies: CompanyProfile[];
    total_count: number;
    next_cursor: string | null;
    query?: any;
}

export interface CompanySearchError {
    detail: string;
    status_code?: number;
    error_type?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Search for companies using filters
 * @param filters Search filters 
 * @returns Promise with search results
 */
export async function searchCompanies(
    filters: CompanySearchFilters
): Promise<CompanySearchResponse> {
    try {
        console.log("🚀 [Frontend] Request Config:", JSON.stringify(filters, null, 2));

        const response = await fetch(`${API_BASE_URL}/api/v1/companies/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(filters),
        });

        if (!response.ok) {
            const error: CompanySearchError = await response.json();
            throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: CompanySearchResponse = await response.json();
        console.log("✅ [Frontend] API Response:", JSON.stringify(data, null, 2));

        return data;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to search companies. Please try again.');
    }
}
