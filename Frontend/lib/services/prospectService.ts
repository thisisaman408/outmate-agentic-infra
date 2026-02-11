/**
 * Prospect Search API Service
 * Handles all API calls related to prospect searching via backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== TYPE DEFINITIONS ====================

export interface ProspectSearchFilters {
    current_title?: string[];
    past_title?: string[];
    location?: string[];
    industry?: string[];
    functions?: string[];
    seniority_level?: string[];
    seniority_level_operator?: 'in' | 'not_in';
    keyword?: string;
    limit?: number;
    cursor?: string | null;
    // New filters
    name?: string;
    first_name?: string;
    last_name?: string;
    profile_languages?: string[];
    company?: string;
    employees?: string[];
}

export interface ProspectProfile {
    person_id: number;
    name: string;
    first_name: string;
    last_name: string;
    region: string;
    region_address_components: string[];
    headline: string;
    summary: string;
    skills: string[];
    languages: string[];
    linkedin_profile_url: string;
    flagship_profile_url: string;
    emails: string[];
    profile_picture_url: string;
    profile_picture_permalink: string;
    twitter_handle: string;
    num_of_connections: number;
    education_background: EducationItem[];
    honors: any[];
    certifications: any[];
    current_employers: EmployerItem[];
    past_employers: EmployerItem[];
    last_updated: string;
    recently_changed_jobs: boolean;
    years_of_experience: string;
    years_of_experience_raw: number;
    all_employers: EmployerItem[];
    updated_at: string;
    location_details: {
        city: string;
        state: string;
        country: string;
        continent: string;
    };
}

export interface EducationItem {
    degree_name: string;
    institute_name: string;
    institute_linkedin_id: string;
    institute_linkedin_url: string;
    institute_logo_url: string;
    field_of_study: string;
    activities_and_societies: string;
    start_date: string;
    end_date: string;
}

export interface EmployerItem {
    name: string;
    linkedin_id: string;
    company_id: number;
    company_linkedin_id: string;
    company_website_domain: string;
    position_id: number;
    title: string;
    description: string;
    location: string;
    start_date: string;
    end_date?: string;
    employer_is_default: boolean;
    seniority_level: string;
    function_category: string;
    years_at_company: string;
    years_at_company_raw: number;
    company_headquarters_country: string;
    company_hq_location: string;
    company_hq_location_address_components: string[];
    company_headcount_range: string;
    company_industries: string[];
    company_linkedin_industry: string;
    company_type: string;
    company_headcount_latest: number;
    company_website: string;
    company_linkedin_profile_url: string;
    business_email_verified: boolean;
}

export interface ProspectSearchResponse {
    profiles: ProspectProfile[];
    total_count: number;
    next_cursor: string | null;
    query?: any;
}

export interface ProspectSearchError {
    detail: string;
    status_code?: number;
    error_type?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Search for prospects using filters
 * @param filters Search filters (titles, location, industry, etc.)
 * @returns Promise with search results
 */
export async function searchProspects(
    filters: ProspectSearchFilters
): Promise<ProspectSearchResponse> {
    try {
        console.log("🚀 [Frontend] Request Config:", JSON.stringify(filters, null, 2));

        const response = await fetch(`${API_BASE_URL}/api/prospects/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(filters),
        });

        if (!response.ok) {
            const error: ProspectSearchError = await response.json();
            throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ProspectSearchResponse = await response.json();
        console.log("✅ [Frontend] API Response:", JSON.stringify(data, null, 2));

        return data;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to search prospects. Please try again.');
    }
}

/**
 * Get prospect by ID (from cached results)
 * Note: This finds the prospect from the current search results
 * @param profiles Array of profiles from search results
 * @param personId Person ID to find
 * @returns Prospect profile or undefined
 */
export function getProspectFromResults(
    profiles: ProspectProfile[],
    personId: number
): ProspectProfile | undefined {
    return profiles.find((p) => p.person_id === personId);
}

/**
 * Format years of experience for display
 * @param years Raw years count
 * @returns Formatted string
 */
export function formatExperience(years: number): string {
    if (years === 0) return 'Entry level';
    if (years === 1) return '1 year';
    if (years < 3) return '1-2 years';
    if (years < 6) return '3-5 years';
    if (years < 11) return '6-10 years';
    return '10+ years';
}

/**
 * Get initials from name for avatar fallback
 * @param name Full name
 * @returns Initials (2 letters)
 */
export function getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Calculate duration between dates
 * @param startDate Start date string
 * @param endDate End date string (or 'Present')
 * @returns Duration string (e.g., "2 years 3 months")
 */
export function calculateDuration(startDate: string, endDate?: string): string {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    const months = (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
        return remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    }

    const yearStr = years === 1 ? '1 year' : `${years} years`;
    if (remainingMonths === 0) return yearStr;

    const monthStr = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    return `${yearStr} ${monthStr} `;
}

/**
 * Format date for display
 * @param dateString ISO date string
 * @returns Formatted date (e.g., "Jan 2020")
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${month} ${year} `;
}
