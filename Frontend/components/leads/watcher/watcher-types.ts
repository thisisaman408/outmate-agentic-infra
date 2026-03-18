export type WatcherStatus = "active" | "paused" | "draft"
export type WatcherType = "event" | "account" | "lead"

// Event types from Explorium Event-Based APIs
export type EventType =
    | "ipo_announcement"
    | "new_funding_round"
    | "new_investment"
    | "merger_and_acquisitions"
    | "cost_cutting"
    | "team_expansion"
    | "team_reduction"
    | "product_launch"
    | "acquisition"
    | "website_content_changes"

// Base watcher interface
export interface BaseWatcher {
    id: string
    name: string
    description: string | null
    status: WatcherStatus
    createdAt: string
    updatedAt: string
    last_triggered_at?: string
    match_count?: number
    new_matches_count?: number
    notificationSettings?: {
        email: boolean
        slack: boolean
        webhook?: string
    }
}

// Event-Based Discovery Watcher
export interface EventWatcher extends BaseWatcher {
    type: "event"
    criteria: {
        event_type?: EventType[]
        funding_stage?: string[]
        min_funding_amount?: number
        max_funding_amount?: number
        job_level?: string[]
        department?: string[]
        technology_category?: string[]
        company_size?: string[]
        industry?: string[]
        location?: string[]
        keywords?: string[]
    }
    matches?: EventMatch[]
}

export interface EventMatch {
    id: string
    company: {
        name: string
        domain: string
        logo?: string
    }
    event: {
        type: EventType
        description: string
        date: Date
        metadata?: Record<string, any>
    }
    matchedAt: Date
    score?: number
}

// Account Watching Watcher
export interface AccountWatcher extends BaseWatcher {
    type: "account"
    accountId: string
    accountName: string
    accountDomain: string
    accountLogo?: string
    accountIndustry?: string
    triggers: WatcherTrigger[]
    recentUpdates: AccountUpdate[]
}

export type WatcherTrigger =
    | "funding"
    | "job_changes"
    | "technology_changes"
    | "news_mentions"
    | "web_traffic"
    | "financial_events"
    | "leadership_changes"
    | "product_updates"

export interface AccountUpdate {
    id: string
    type: WatcherTrigger
    title: string
    description: string
    date: Date
    metadata?: Record<string, any>
    severity?: "low" | "medium" | "high"
}

// Lead Watching Watcher
export interface LeadWatcher extends BaseWatcher {
    type: "lead"
    leadId: string
    leadName: string
    leadTitle: string
    leadCompany: string
    leadEmail?: string
    leadLinkedin?: string
    leadAvatar?: string
    triggers: LeadTrigger[]
    recentUpdates: LeadUpdate[]
}

export type LeadTrigger =
    | "job_change"
    | "content_published"
    | "speaking_engagement"
    | "promotion"
    | "award"
    | "social_activity"
    | "company_change"

export interface LeadUpdate {
    id: string
    type: LeadTrigger
    title: string
    description: string
    date: Date
    url?: string
    metadata?: Record<string, any>
}

// Union type for all watchers
export type Watcher = EventWatcher | AccountWatcher | LeadWatcher

// Filter state
export interface WatcherFilters {
    // Common filters
    status?: WatcherStatus[]
    search?: string
    dateRange?: {
        from: Date
        to: Date
    }

    // Event-specific filters
    event_type?: EventType[]
    funding_stage?: string[]
    job_level?: string[]
    department?: string[]
    technology_category?: string[]
    company_size?: string[]

    // Account-specific filters
    trigger_types?: WatcherTrigger[]
    account_industry?: string[]

    // Lead-specific filters
    lead_trigger_types?: LeadTrigger[]
    lead_seniority?: string[]
    lead_department?: string[]
}

// API Response types
export interface CreateWatcherRequest {
    name: string
    description: string
    type: WatcherType
    criteria?: any
    triggers?: string[]
    notificationSettings?: {
        email: boolean
        slack: boolean
        webhook?: string
    }
}

export interface WatcherListResponse {
    watchers: Watcher[]
    total: number
    page: number
    pageSize: number
}

export interface WatcherDetailResponse {
    watcher: Watcher
    matches?: EventMatch[] | AccountUpdate[] | LeadUpdate[]
    analytics?: {
        totalMatches: number
        matchesThisWeek: number
        matchesThisMonth: number
        trendingUp: boolean
    }
}

// CrustData API specific types
export interface CrustDataEventCriteria {
    event_types?: string[]
    company_filters?: {
        size?: string[]
        industry?: string[]
        location?: string[]
        funding_stage?: string[]
    }
    person_filters?: {
        title?: string[]
        seniority?: string[]
        department?: string[]
    }
    technology_filters?: {
        categories?: string[]
        products?: string[]
    }
}

export interface CrustDataWatcherWebhook {
    url: string
    headers?: Record<string, string>
    events: string[]
}