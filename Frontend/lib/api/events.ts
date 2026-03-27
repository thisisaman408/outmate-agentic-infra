import axios from 'axios'
import { authService } from '@/lib/auth'

const BASE_API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_URL = `${BASE_API}/api/v1/events`;

const getAuthHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (typeof window !== 'undefined') {
        const token = authService.getToken()
        if (token) headers.Authorization = `Bearer ${token}`
    }
    return headers
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventImpact = 'high' | 'medium' | 'low'
export type EntityType = 'business' | 'prospect'

export interface ExploriumEventCard {
    id: string
    entityId: string
    entityName: string
    entityType: EntityType
    eventType: string
    eventLabel: string
    category: string
    timestamp: string
    description: string
    sourceUrl?: string
    impact: EventImpact
    metadata: Record<string, any>
}

export interface EventEnrollment {
    entityId: string
    entityName?: string
    entityType: EntityType
    eventTypes: string[]
}

export interface BusinessEventsMeta {
    key: string
    label: string
    impact: EventImpact
    category: string
}

export interface ProspectEventsMeta {
    key: string
    label: string
    impact: EventImpact
}

export interface EventsMetadata {
    business_event_types: BusinessEventsMeta[]
    prospect_event_types: ProspectEventsMeta[]
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface FetchBusinessEventsPayload {
    business_ids: string[]
    event_types?: string[]
    timestamp_from?: string
    force_refresh?: boolean
}

export interface EnrollBusinessPayload {
    business_ids: string[]
    event_types: string[]
    business_name?: string
}

export interface UpdateBusinessEnrollmentPayload {
    business_id: string
    event_types: string[]
}

export interface FetchProspectEventsPayload {
    prospect_ids: string[]
    event_types?: string[]
    timestamp_from?: string
    force_refresh?: boolean
}

export interface EnrollProspectPayload {
    prospect_ids: string[]
    event_types: string[]
    prospect_names?: string[]  // Optional parallel list of display names for the enrolled prospects
}

export interface UpdateProspectEnrollmentPayload {
    prospect_id: string
    event_types: string[]
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const eventsApi = {
    // ---- Business Events ----

    async fetchBusinessEvents(payload: FetchBusinessEventsPayload): Promise<{ events: ExploriumEventCard[]; count: number; error?: string | null }> {
        const { data } = await axios.post(`${API_URL}/businesses/events`, payload, {
            headers: getAuthHeaders(),
            timeout: 30000,
        })
        return data
    },

    async addBusinessEnrollment(payload: EnrollBusinessPayload): Promise<any> {
        const { data } = await axios.post(`${API_URL}/businesses/enrollments`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    async updateBusinessEnrollment(payload: UpdateBusinessEnrollmentPayload): Promise<any> {
        const { data } = await axios.patch(`${API_URL}/businesses/enrollments`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    async deleteBusinessEnrollment(businessId: string): Promise<any> {
        const { data } = await axios.delete(`${API_URL}/businesses/enrollments`, {
            headers: getAuthHeaders(),
            data: { business_id: businessId },
            timeout: 15000,
        })
        return data
    },

    async getBusinessEnrollments(): Promise<any> {
        const { data } = await axios.get(`${API_URL}/businesses/enrollments`, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    // ---- Prospect Events ----

    async fetchProspectEvents(payload: FetchProspectEventsPayload): Promise<{ events: ExploriumEventCard[]; count: number; error?: string | null }> {
        const { data } = await axios.post(`${API_URL}/prospects/events`, payload, {
            headers: getAuthHeaders(),
            timeout: 30000,
        })
        return data
    },

    async addProspectEnrollment(payload: EnrollProspectPayload): Promise<any> {
        const { data } = await axios.post(`${API_URL}/prospects/enrollments`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    async updateProspectEnrollment(payload: UpdateProspectEnrollmentPayload): Promise<any> {
        const { data } = await axios.patch(`${API_URL}/prospects/enrollments`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    async deleteProspectEnrollment(prospectId: string): Promise<any> {
        const { data } = await axios.delete(`${API_URL}/prospects/enrollments`, {
            headers: getAuthHeaders(),
            data: { prospect_id: prospectId },
            timeout: 15000,
        })
        return data
    },

    async getProspectEnrollments(): Promise<any> {
        const { data } = await axios.get(`${API_URL}/prospects/enrollments`, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    // ---- Business Match ----

    async matchBusiness(payload: { name?: string; domain?: string }): Promise<{ matches: { business_id: string; name: string; domain?: string }[] }> {
        const { data } = await axios.post(`${API_URL}/businesses/match`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    // ---- Prospect Match ----

    async matchProspect(payload: { full_name?: string; email?: string; linkedin?: string; company_name?: string }): Promise<{ matches: { prospect_id: string; name: string; company?: string; email?: string }[]; error?: string }> {
        const { data } = await axios.post(`${API_URL}/prospects/match`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000,
        })
        return data
    },

    // ---- Metadata ----

    async getMetadata(): Promise<EventsMetadata> {
        const { data } = await axios.get(`${API_URL}/metadata`, {
            headers: getAuthHeaders(),
        })
        return data
    },
}
