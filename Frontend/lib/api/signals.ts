import axios from 'axios';
import { authService } from '@/lib/auth'

const API_URL = '/api/v1/signals';

const getAuthHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (typeof window !== 'undefined') {
        const token = authService.getToken()
        if (token) {
            headers.Authorization = `Bearer ${token}`
        }
    }
    return headers
}

export interface Signal {
    _id: string;
    name: string;
    type: 'x_mentions' | 'x_profiles' | 'x_hashtags' | 'x_trends' | 'monitor_rss_feed' | 'monitor_google_search_results' | 'monitor_professional_posts' | 'monitor_interactions_with_professional_post';
    configuration: {
        target?: string;
        maxResults?: number;
        frequency?: string;
        language?: string;
        country?: string;
        companiesFilter?: string;
        peopleFilter?: string;
        keywords?: string;
        postUrls?: string;
        interactionType?: string;
        sortBy?: string;
        timeFrame?: string;
        duplicateHandling?: string;
        adbeatAccount?: string;
        searchType?: string;
        startDate?: string;
        endDate?: string;
        adKeywords?: string;
        adKeywordOperator?: string;
        adKeywordsExclude?: string;
        prioritizeResultsBy?: string;
        platform?: string;
        adCategory?: string;
        adCreativeType?: string;
        adCreativeSize?: string;
        removeRetweets?: boolean;
        [key: string]: any;
    };
    category?: string;
    status: string;
    created_at: string;
    last_run_at: string | null;
}

export interface SignalResult {
    _id: string;
    signal_id: string;
    title: string;
    description: string;
    source_url: string;
    metadata: any;
    found_at: string;
}

export const signalsApi = {
    getSignals: async (): Promise<Signal[]> => {
        const response = await axios.get(API_URL, { headers: getAuthHeaders() });
        return response.data;
    },

    createSignal: async (signal: Partial<Signal>): Promise<Signal> => {
        const response = await axios.post(API_URL, signal, { headers: getAuthHeaders(), timeout: 20000 });
        return response.data;
    },

    runSignal: async (id: string): Promise<any> => {
        const response = await axios.post(`${API_URL}/${id}/run`, {}, { headers: getAuthHeaders() });
        return response.data;
    },

    getSignalResults: async (id: string): Promise<SignalResult[]> => {
        const response = await axios.get(`${API_URL}/${id}/results`, { headers: getAuthHeaders() });
        return response.data;
    },

    previewSignal: async (type: string, configuration: any): Promise<any[]> => {
        const response = await axios.post(`${API_URL}/preview`, { type, configuration }, { headers: getAuthHeaders() });
        return response.data;
    }
};
