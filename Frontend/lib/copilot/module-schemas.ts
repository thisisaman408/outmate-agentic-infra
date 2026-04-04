/**
 * MODULE SCHEMAS
 * Defines all 12 platform modules that Co-Pilot can automate
 * Each module has: route, API endpoint, required/optional fields, validation, credit cost
 */

export interface FieldValidation {
  type: 'string' | 'enum' | 'number' | 'boolean' | 'array'
  required?: boolean
  pattern?: RegExp
  validator?: (value: unknown) => boolean
  examples?: string[]
}

export interface ModuleSchema {
  // Identity
  name: string
  module: string
  route: string

  // API
  apiEndpoint: string
  httpMethod: 'GET' | 'POST'
  creditCost: number

  // Filter schema
  required: string[]
  optional: string[]
  defaults: Record<string, unknown>
  validation: Record<string, FieldValidation>

  // UI hints
  description: string
  icon?: string
}

/**
 * ALL 12 MODULE SCHEMAS
 * Ordered by implementation phase
 */

// ────────────────────────────────────────────────────────────────
// PHASE 1: Prospects + Intents (Priority)
// ────────────────────────────────────────────────────────────────

export const ProspectsSchema: ModuleSchema = {
  name: 'Prospects',
  module: 'prospects',
  route: '/leads/prospects',
  apiEndpoint: '/api/v1/leads/search-prospects',
  httpMethod: 'POST',
  creditCost: 1,

  // No required fields — all filters are optional
  required: [],
  optional: [
    'current_title', 'job_title',
    'past_title',
    'functions', 'department',
    'seniority_level', 'seniority', 'seniority_operator',
    'location',
    'first_name', 'last_name',
    'profile_languages', 'languages',
    'company',
    'employees', 'company_size',
    'industry',
    'keyword', 'keywords',
    'tech_stack',
    'experience_level',
  ],

  defaults: {},

  validation: {
    current_title: {
      type: 'array',
      examples: ['VP of Sales', 'CTO', 'Head of Marketing', 'Product Manager'],
    },
    job_title: {
      type: 'array',
      examples: ['VP of Sales', 'CTO', 'Director of Engineering'],
    },
    past_title: {
      type: 'array',
      examples: ['Founder', 'VP Engineering', 'Product Lead'],
    },
    functions: {
      type: 'array',
      examples: ['Sales', 'Engineering', 'Marketing', 'Finance', 'Operations'],
    },
    department: {
      type: 'array',
      examples: ['Sales', 'Engineering', 'Marketing'],
    },
    seniority_level: {
      type: 'array',
      examples: ['CXO', 'Vice President', 'Director', 'Senior', 'Owner / Partner'],
    },
    seniority: {
      type: 'array',
      examples: ['CXO', 'Vice President', 'Director'],
    },
    seniority_operator: {
      type: 'enum',
      validator: (v) => ['in', 'not_in', 'include', 'exclude'].includes(String(v)),
      examples: ['in', 'not_in'],
    },
    location: {
      type: 'array',
      examples: ['San Francisco', 'United States', 'London', 'India'],
    },
    first_name: {
      type: 'string',
      examples: ['John', 'Sarah'],
    },
    last_name: {
      type: 'string',
      examples: ['Smith', 'Johnson'],
    },
    profile_languages: {
      type: 'array',
      examples: ['English', 'Spanish', 'French'],
    },
    languages: {
      type: 'array',
      examples: ['English', 'Spanish'],
    },
    company: {
      type: 'string',
      examples: ['Salesforce', 'HubSpot', 'Stripe'],
    },
    employees: {
      type: 'array',
      examples: ['51-200', '201-500', '1000+'],
    },
    company_size: {
      type: 'array',
      examples: ['51-200', '201-500', '1000+'],
    },
    industry: {
      type: 'array',
      examples: ['technology', 'fintech', 'healthcare', 'ecommerce', 'saas'],
    },
    keyword: {
      type: 'string',
      examples: ['AI', 'machine learning', 'product-led growth'],
    },
    keywords: {
      type: 'string',
      examples: ['AI', 'product-led growth'],
    },
    tech_stack: {
      type: 'array',
      examples: ['Salesforce', 'HubSpot', 'React', 'Python'],
    },
    experience_level: {
      type: 'enum',
      validator: (v) => ['junior', 'mid', 'senior', 'executive'].includes(String(v)),
      examples: ['senior', 'executive'],
    },
  },

  description: 'Search individual contacts by job title, seniority, department, company size, industry, location, name, and more',
}

export const IntentsSchema: ModuleSchema = {
  name: 'Intent Signals',
  module: 'intents',
  route: '/signals/intents',
  apiEndpoint: '/api/v1/signals/intents/search',
  httpMethod: 'POST',
  creditCost: 2,

  required: ['topic'],
  optional: ['timeframe', 'threshold', 'priority'],

  defaults: {
    timeframe: 'last_30_days',
    threshold: 'medium',
  },

  validation: {
    topic: {
      type: 'string',
      pattern: /^[a-zA-Z\s,]{2,50}$/,
      examples: ['AI adoption', 'digital transformation', 'cloud migration'],
    },
    timeframe: {
      type: 'enum',
      validator: (v) =>
        ['last_7_days', 'last_30_days', 'last_90_days', 'last_year'].includes(
          String(v)
        ),
      examples: ['last_30_days', 'last_90_days'],
    },
    threshold: {
      type: 'enum',
      validator: (v) => ['high', 'medium', 'low'].includes(String(v)),
      examples: ['medium', 'high'],
    },
    priority: {
      type: 'enum',
      validator: (v) =>
        ['urgent', 'high', 'medium', 'low'].includes(String(v)),
      examples: ['high', 'urgent'],
    },
  },

  description: 'Find companies showing buying intent signals for specific topics',
}

// ────────────────────────────────────────────────────────────────
// PHASE 2: Extended Modules
// ────────────────────────────────────────────────────────────────

export const CompaniesSchema: ModuleSchema = {
  name: 'Companies',
  module: 'companies',
  route: '/leads/companies/search',
  apiEndpoint: '/api/v1/leads/search/companies',
  httpMethod: 'POST',
  creditCost: 1,

  // All filters optional — use what the user provides
  required: [],
  optional: [
    'name', 'domain', 'industry', 'headquarters_country', 'location',
    'employee_count_range', 'company_size', 'funding_stage', 'recent_funding_activity',
    'operational_regions', 'google_categories',
    'intent_topics', 'business_event_signals',
    'tech_stack_keywords', 'tech_stack',
    'ai_search', 'keywords',
  ],

  defaults: {},

  validation: {
    name: { type: 'string', examples: ['Salesforce', 'HubSpot'] },
    domain: { type: 'string', examples: ['salesforce.com', 'hubspot.com'] },
    industry: { type: 'array', examples: ['technology', 'fintech', 'healthcare', 'ecommerce', 'SaaS'] },
    headquarters_country: { type: 'string', examples: ['United States', 'United Kingdom', 'India'] },
    location: { type: 'string', examples: ['US', 'California', 'London'] },
    employee_count_range: {
      type: 'array',
      examples: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'],
    },
    company_size: {
      type: 'array',
      examples: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'],
    },
    funding_stage: {
      type: 'array',
      examples: ['Seed', 'Series A', 'Series B', 'Series C+', 'Growth', 'Private Equity / Late Stage'],
    },
    recent_funding_activity: { type: 'boolean', examples: ['true', 'false'] },
    operational_regions: {
      type: 'array',
      examples: ['us-ca', 'us-ga', 'us-ny', 'us-tx', 'ca-on', 'gb-eng', 'eu', 'apac'],
    },
    google_categories: {
      type: 'array',
      examples: ['E-commerce', 'Technology', 'Manufacturing', 'Financial Services', 'Logistics'],
    },
    intent_topics: { type: 'string', examples: ['cloud computing', 'AI adoption', 'cybersecurity'] },
    business_event_signals: {
      type: 'array',
      examples: ['Hiring in Sales', 'New Product', 'Funding Round', 'New Office', 'Executive Move'],
    },
    tech_stack_keywords: { type: 'string', examples: ['Kubernetes', 'Snowflake', 'React'] },
    tech_stack: { type: 'string', examples: ['React', 'Python', 'AI/ML'] },
    ai_search: { type: 'string', examples: ['B2B SaaS companies in the US with 50-500 employees that use Snowflake'] },
    keywords: { type: 'string', examples: ['automation', 'machine learning'] },
  },

  description: 'Search companies by industry, size, funding stage, location, signals, and tech stack. Supports AI natural-language search.',
}

export const CompanyIdentificationSchema: ModuleSchema = {
  name: 'Company Identification',
  module: 'company_identification',
  route: '/leads/companies/identification',
  apiEndpoint: '/api/v1/crustdata/identify',
  httpMethod: 'POST',
  creditCost: 1,

  required: [],
  optional: ['company_name', 'domain', 'profile_url', 'company_profile_url', 'company_id', 'num_results', 'exact_match'],

  defaults: { num_results: 10 },

  validation: {
    company_name: { type: 'string', examples: ['Salesforce', 'HubSpot', 'Stripe'] },
    domain: { type: 'string', examples: ['salesforce.com', 'hubspot.com'] },
    profile_url: { type: 'string', examples: ['https://linkedin.com/company/salesforce'] },
    company_profile_url: { type: 'string', examples: ['https://crunchbase.com/organization/salesforce'] },
    company_id: { type: 'string', examples: ['12345'] },
    num_results: { type: 'number', examples: ['5', '10', '25'] },
    exact_match: { type: 'boolean', examples: ['true', 'false'] },
  },

  description: 'Identify a specific company by name, website domain, LinkedIn/Crunchbase URL, or company ID',
}

export const CompanyEnrichmentSchema: ModuleSchema = {
  name: 'Company Enrichment',
  module: 'company_enrichment',
  route: '/leads/companies/enrichment',
  apiEndpoint: '/api/v1/crustdata/enrich',
  httpMethod: 'GET',
  creditCost: 1,

  required: [],
  optional: ['domains', 'company_names', 'company_ids', 'profile_urls', 'fields', 'exact_match', 'realtime'],

  defaults: {},

  validation: {
    domains: { type: 'string', examples: ['salesforce.com,hubspot.com'] },
    company_names: { type: 'string', examples: ['"Salesforce, Inc.","HubSpot"'] },
    company_ids: { type: 'string', examples: ['12345,67890'] },
    profile_urls: { type: 'string', examples: ['https://linkedin.com/company/salesforce'] },
    fields: { type: 'string', examples: ['headcount,funding_and_investment,web_traffic'] },
    exact_match: { type: 'boolean', examples: ['true', 'false'] },
    realtime: { type: 'boolean', examples: ['true', 'false'] },
  },

  description: 'Enrich one or more companies with detailed firmographic data: headcount, funding, revenue, tech stack, and more',
}

export const CompanySocialPostsSchema: ModuleSchema = {
  name: 'Social Posts by Company',
  module: 'company_social_posts',
  route: '/leads/companies/linkedin-posts',
  apiEndpoint: '/api/v1/crustdata/linkedin_posts',
  httpMethod: 'GET',
  creditCost: 1,

  required: [],
  optional: ['domain', 'company_name', 'company_id', 'profile_url', 'post_url', 'fields', 'page', 'limit', 'post_types'],

  defaults: { limit: '5', page: '1', post_types: 'repost, original' },

  validation: {
    domain: { type: 'string', examples: ['salesforce.com', 'hubspot.com'] },
    company_name: { type: 'string', examples: ['Salesforce', 'HubSpot'] },
    company_id: { type: 'string', examples: ['12345'] },
    profile_url: { type: 'string', examples: ['https://linkedin.com/company/salesforce'] },
    post_url: { type: 'string', examples: ['https://linkedin.com/posts/...'] },
    fields: { type: 'string', examples: ['reactors', 'comments', 'reactors,comments'] },
    page: { type: 'string', examples: ['1', '2', '3'] },
    limit: { type: 'enum', validator: (v) => ['5', '10', '25'].includes(String(v)), examples: ['5', '10', '25'] },
    post_types: { type: 'string', examples: ['repost, original', 'original'] },
  },

  description: 'Get recent LinkedIn posts and engagement metrics for a specific company',
}

export const SocialKeywordSearchSchema: ModuleSchema = {
  name: 'Social Posts Keyword Search',
  module: 'social_keyword_search',
  route: '/leads/companies/keyword-search',
  apiEndpoint: '/api/v1/crustdata/keyword_search',
  httpMethod: 'GET',
  creditCost: 1,

  required: ['keyword'],
  optional: ['exact_match', 'sort_by', 'date_range', 'page', 'limit', 'author_industry', 'author_title'],

  defaults: { sort_by: 'relevance', date_range: 'past-month', page: '1', limit: '5' },

  validation: {
    keyword: { type: 'string', examples: ['AI innovation', 'machine learning AND startup', 'cloud OR SaaS'] },
    exact_match: { type: 'boolean', examples: ['true', 'false'] },
    sort_by: {
      type: 'enum',
      validator: (v) => ['relevance', 'date'].includes(String(v)),
      examples: ['relevance', 'date'],
    },
    date_range: {
      type: 'enum',
      validator: (v) => ['past-month', 'past-week', 'past-year'].includes(String(v)),
      examples: ['past-month', 'past-week', 'past-year'],
    },
    page: { type: 'string', examples: ['1', '2'] },
    limit: { type: 'enum', validator: (v) => ['5', '10', '25'].includes(String(v)), examples: ['5', '10', '25'] },
    author_industry: { type: 'string', examples: ['Software Development, Technology'] },
    author_title: { type: 'string', examples: ['CEO, Founder, Manager'] },
  },

  description: 'Search LinkedIn posts across all companies containing specific keywords. Supports Boolean filters (AND, OR).',
}

export const EventsSchema: ModuleSchema = {
  name: 'Events',
  module: 'events',
  route: '/signals/events',
  apiEndpoint: '/api/v1/signals/events',
  httpMethod: 'GET',
  creditCost: 1,

  required: [],
  optional: ['event_type', 'company', 'date_range', 'severity'],

  defaults: {
    date_range: 'last_30_days',
  },

  validation: {
    event_type: {
      type: 'enum',
      validator: (v) =>
        ['hiring', 'funding', 'product_launch', 'expansion'].includes(String(v)),
      examples: ['hiring', 'funding'],
    },
    date_range: {
      type: 'enum',
      validator: (v) =>
        ['last_7_days', 'last_30_days', 'last_90_days'].includes(String(v)),
      examples: ['last_30_days'],
    },
    severity: {
      type: 'enum',
      validator: (v) => ['critical', 'high', 'medium'].includes(String(v)),
      examples: ['high', 'critical'],
    },
  },

  description: 'Track company events like funding, hiring, and product launches',
}

export const TrackersSchema: ModuleSchema = {
  name: 'Trackers',
  module: 'trackers',
  route: '/signals/trackers',
  apiEndpoint: '/api/v1/signals/trackers',
  httpMethod: 'GET',
  creditCost: 0,

  required: [],
  optional: ['tracker_type', 'keywords', 'sources'],

  defaults: {},

  validation: {
    tracker_type: {
      type: 'enum',
      validator: (v) =>
        ['keyword', 'company', 'person', 'topic'].includes(String(v)),
      examples: ['keyword', 'company'],
    },
    sources: {
      type: 'array',
      examples: ['news', 'social', 'web', 'events'],
    },
  },

  description: 'View and manage keyword, company, and topic trackers',
}

export const WebsightsSchema: ModuleSchema = {
  name: 'Websights',
  module: 'websights',
  route: '/signals/websights',
  apiEndpoint: '/api/v1/signals/websights/search',
  httpMethod: 'POST',
  creditCost: 2,

  required: ['domain'],
  optional: ['date_range', 'visitor_type', 'page_filters'],

  defaults: {
    date_range: 'last_30_days',
  },

  validation: {
    domain: {
      type: 'string',
      pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      examples: ['example.com', 'tech-startup.io'],
    },
    date_range: {
      type: 'enum',
      validator: (v) =>
        ['last_7_days', 'last_30_days', 'last_90_days'].includes(String(v)),
      examples: ['last_30_days'],
    },
    visitor_type: {
      type: 'enum',
      validator: (v) =>
        ['company', 'person', 'anonymous'].includes(String(v)),
      examples: ['company', 'person'],
    },
  },

  description: 'Analyze website visitors and traffic patterns by company',
}

export const FormCompletionsSchema: ModuleSchema = {
  name: 'Form Completions',
  module: 'form_complete',
  route: '/signals/form-complete',
  apiEndpoint: '/api/v1/signals/form-complete',
  httpMethod: 'POST',
  creditCost: 1,

  required: ['domain'],
  optional: ['date_range', 'form_type'],

  defaults: {
    date_range: 'last_30_days',
  },

  validation: {
    domain: {
      type: 'string',
      pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      examples: ['example.com'],
    },
    date_range: {
      type: 'enum',
      validator: (v) =>
        ['last_7_days', 'last_30_days', 'last_90_days'].includes(String(v)),
      examples: ['last_30_days'],
    },
    form_type: {
      type: 'enum',
      validator: (v) =>
        ['contact', 'signup', 'demo', 'newsletter'].includes(String(v)),
      examples: ['demo', 'contact'],
    },
  },

  description: 'Track form submissions and user interest signals',
}

export const CampaignsSchema: ModuleSchema = {
  name: 'Campaigns',
  module: 'campaigns',
  route: '/campaigns',
  apiEndpoint: '/api/v1/campaigns',
  httpMethod: 'POST',
  creditCost: 3,

  required: ['campaign_name', 'target_segment'],
  optional: ['email_template', 'schedule', 'status'],

  defaults: {},

  validation: {
    campaign_name: {
      type: 'string',
      pattern: /^[a-zA-Z0-9\s\-]{3,100}$/,
      examples: ['Q2 Fintech Outreach', 'AI Adoption Campaign'],
    },
    target_segment: {
      type: 'string',
      examples: ['prospects', 'intents', 'custom_list'],
    },
    email_template: {
      type: 'string',
      examples: ['cold_outreach', 'personalized', 'case_study'],
    },
    status: {
      type: 'enum',
      validator: (v) =>
        ['draft', 'scheduled', 'active', 'paused', 'completed'].includes(
          String(v)
        ),
      examples: ['draft', 'active'],
    },
  },

  description: 'Create and manage email outreach campaigns',
}

export const WorkflowsSchema: ModuleSchema = {
  name: 'Workflows',
  module: 'workflows',
  route: '/workflows',
  apiEndpoint: '/api/v1/workflows',
  httpMethod: 'POST',
  creditCost: 2,

  required: ['workflow_name', 'trigger_type'],
  optional: ['actions', 'condition', 'status'],

  defaults: {},

  validation: {
    workflow_name: {
      type: 'string',
      pattern: /^[a-zA-Z0-9\s\-]{3,100}$/,
      examples: ['Auto Email Prospects', 'Track Funding Events'],
    },
    trigger_type: {
      type: 'enum',
      validator: (v) =>
        ['intent', 'event', 'schedule', 'form_completion'].includes(String(v)),
      examples: ['intent', 'event'],
    },
    status: {
      type: 'enum',
      validator: (v) =>
        ['draft', 'active', 'paused'].includes(String(v)),
      examples: ['draft', 'active'],
    },
  },

  description: 'Automate prospect engagement with trigger-based workflows',
}

export const AIAgentsSchema: ModuleSchema = {
  name: 'AI Agents',
  module: 'ai_agents',
  route: '/ai-agents',
  apiEndpoint: '/api/v1/agents/deploy',
  httpMethod: 'POST',
  creditCost: 5,

  required: ['agent_type'],
  optional: ['configuration', 'deploy_schedule'],

  defaults: {},

  validation: {
    agent_type: {
      type: 'enum',
      validator: (v) =>
        ['research', 'outreach', 'analysis', 'follow_up'].includes(String(v)),
      examples: ['research', 'outreach'],
    },
  },

  description: 'Deploy autonomous AI agents for research and outreach',
}

export const GlobalSearchSchema: ModuleSchema = {
  name: 'Global Search',
  module: 'global_search',
  route: '/ai-powered-search',
  apiEndpoint: '/api/v1/search/global',
  httpMethod: 'POST',
  creditCost: 1,

  required: ['query'],
  optional: ['modules', 'filters'],

  defaults: {},

  validation: {
    query: {
      type: 'string',
      pattern: /^[a-zA-Z0-9\s\-,]{2,200}$/,
      examples: ['fintech companies', 'AI adoption signals'],
    },
  },

  description: 'Search across all platform modules with a single query',
}

// ────────────────────────────────────────────────────────────────
// COPILOT FORM SCHEMAS — Meeting Prep, Pipeline Alerts, Email Optimizer
// These are used by fill_copilot_form to know what fields each page accepts
// ────────────────────────────────────────────────────────────────

export const MeetingPrepSchema: ModuleSchema = {
  name: 'Meeting Prep',
  module: 'meeting_prep',
  route: '/copilot/meeting-prep',
  apiEndpoint: '/api/copilot/meeting-prep',
  httpMethod: 'POST',
  creditCost: 2,

  required: ['company_name'],
  optional: ['company_domain', 'prospect_name', 'prospect_title'],

  defaults: {},

  validation: {
    company_name: {
      type: 'string',
      examples: ['Acme Corp', 'Salesforce', 'HubSpot'],
    },
    company_domain: {
      type: 'string',
      examples: ['acme.com', 'salesforce.com'],
    },
    prospect_name: {
      type: 'string',
      examples: ['Jane Doe', 'John Smith'],
    },
    prospect_title: {
      type: 'string',
      examples: ['VP of Sales', 'CTO', 'Head of Marketing'],
    },
  },

  description: 'Generate a pre-call brief with company snapshot, talking points, discovery questions, and risk factors',
}

export const PipelineAlertsSchema: ModuleSchema = {
  name: 'Pipeline Alerts',
  module: 'pipeline_alerts',
  route: '/copilot/pipeline-alerts',
  apiEndpoint: '/api/copilot/pipeline-risk',
  httpMethod: 'POST',
  creditCost: 1,

  required: ['deals'],
  optional: [],

  defaults: {},

  validation: {
    deals: {
      type: 'array',
      examples: [
        '[{"company":"Acme Corp","stage":"Proposal","last_activity":"2026-04-04","value":10000}]',
      ],
    },
  },

  description: 'Scan a list of deals for pipeline risk — identifies stuck deals, health score, and recommended actions',
}

export const EmailOptimizerSchema: ModuleSchema = {
  name: 'Email Optimizer',
  module: 'email_optimizer',
  route: '/copilot/campaign-optimizer',
  apiEndpoint: '/api/copilot/email-optimizer',
  httpMethod: 'POST',
  creditCost: 2,

  required: ['subject_line', 'email_body'],
  optional: ['lead_name', 'lead_company', 'lead_role', 'lead_domain', 'open_rate', 'reply_rate'],

  defaults: {},

  validation: {
    subject_line: {
      type: 'string',
      examples: ['Quick question about your outreach', 'Saw you just raised Series B'],
    },
    email_body: {
      type: 'string',
      examples: ['Hi Sarah, I wanted to reach out because...'],
    },
    lead_name: {
      type: 'string',
      examples: ['Sarah Chen', 'John Smith'],
    },
    lead_company: {
      type: 'string',
      examples: ['Acme Corp', 'Salesforce'],
    },
    lead_role: {
      type: 'string',
      examples: ['VP of Sales', 'CTO'],
    },
    lead_domain: {
      type: 'string',
      examples: ['acme.com', 'salesforce.com'],
    },
    open_rate: {
      type: 'number',
      examples: ['18', '25'],
    },
    reply_rate: {
      type: 'number',
      examples: ['2', '5'],
    },
  },

  description: 'Score and rewrite an email. Add lead context (name + company) for a hyper-personalized rewrite with follow-up sequence',
}

// ────────────────────────────────────────────────────────────────
// WATCHER SCHEMAS — 3 types matching the real backend API
// ────────────────────────────────────────────────────────────────

/**
 * EVENT WATCHER — discover new companies matching business event criteria
 * Backend: POST /api/v1/watchers/event
 */
export const EventWatcherSchema: ModuleSchema = {
  name: 'Event Watcher',
  module: 'event_watcher',
  route: '/leads/watcher',
  apiEndpoint: '/api/v1/watchers/event',
  httpMethod: 'POST',
  creditCost: 0,

  required: ['name', 'event_types'],
  optional: [
    'description',
    'funding_stage',
    'min_funding_amount', 'max_funding_amount',
    'job_level', 'department',
    'company_size', 'industry',
    'location', 'keywords',
    'technology_category',
    'notification_email', 'notification_slack',
  ],

  defaults: {},

  validation: {
    name: {
      type: 'string',
      pattern: /^.{3,100}$/,
      examples: ['Series A SaaS Tracker', 'Fintech Funding Watcher'],
    },
    description: {
      type: 'string',
      examples: ['Watch for Series A funding in SaaS companies'],
    },
    event_types: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'ipo_announcement', 'new_funding_round', 'new_investment',
            'merger_and_acquisitions', 'cost_cutting', 'team_expansion',
            'team_reduction', 'product_launch', 'acquisition',
          ].includes(x)
        ),
      examples: [['new_funding_round', 'team_expansion']],
    },
    funding_stage: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['seed', 'series_a', 'series_b', 'series_c', 'series_d_plus', 'ipo'].includes(x)
        ),
      examples: [['series_a', 'series_b']],
    },
    job_level: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['c_level', 'vp', 'director', 'manager', 'individual'].includes(x)
        ),
      examples: [['c_level', 'vp', 'director']],
    },
    department: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['sales', 'marketing', 'engineering', 'product', 'customer_success', 'hr', 'finance'].includes(x)
        ),
      examples: [['sales', 'marketing']],
    },
    company_size: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'].includes(x)
        ),
      examples: [['201-500', '501-1000']],
    },
    industry: {
      type: 'array',
      examples: [['saas', 'fintech', 'healthcare']],
    },
    location: {
      type: 'array',
      examples: [['United States', 'United Kingdom']],
    },
    keywords: {
      type: 'array',
      examples: [['AI', 'machine learning', 'automation']],
    },
    technology_category: {
      type: 'array',
      examples: [['CRM', 'Marketing Automation']],
    },
    notification_email: {
      type: 'boolean',
      examples: ['true', 'false'],
    },
    notification_slack: {
      type: 'string',
      examples: ['https://hooks.slack.com/services/...'],
    },
  },

  description: 'Monitor companies that match specific business events (funding rounds, hiring, IPO, product launches, etc.)',
}

/**
 * ACCOUNT WATCHER — track changes at a specific company
 * Backend: POST /api/v1/watchers/account
 */
export const AccountWatcherSchema: ModuleSchema = {
  name: 'Account Watcher',
  module: 'account_watcher',
  route: '/leads/watcher',
  apiEndpoint: '/api/v1/watchers/account',
  httpMethod: 'POST',
  creditCost: 0,

  required: ['name', 'account_name', 'account_domain', 'triggers'],
  optional: ['description', 'notification_email', 'notification_slack'],

  defaults: {},

  validation: {
    name: {
      type: 'string',
      pattern: /^.{3,100}$/,
      examples: ['Watch Salesforce', 'HubSpot Intelligence'],
    },
    description: {
      type: 'string',
      examples: ['Get alerts when Salesforce changes leadership or raises funding'],
    },
    account_name: {
      type: 'string',
      examples: ['Salesforce', 'HubSpot', 'Stripe'],
    },
    account_domain: {
      type: 'string',
      pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      examples: ['salesforce.com', 'hubspot.com', 'stripe.com'],
    },
    triggers: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'Website Changes', 'Funding Events', 'Job Changes',
            'Technology Changes', 'News Mentions', 'Web Traffic Changes',
          ].includes(x)
        ),
      examples: [['Funding Events', 'Job Changes', 'News Mentions']],
    },
    notification_email: {
      type: 'boolean',
      examples: ['true', 'false'],
    },
    notification_slack: {
      type: 'string',
      examples: ['https://hooks.slack.com/services/...'],
    },
  },

  description: 'Get alerts when a specific company changes its website, hires, raises funding, or appears in news',
}

/**
 * LEAD WATCHER — track activity signals for a specific person
 * Backend: POST /api/v1/watchers/lead
 */
export const LeadWatcherSchema: ModuleSchema = {
  name: 'Lead Watcher',
  module: 'lead_watcher',
  route: '/leads/watcher',
  apiEndpoint: '/api/v1/watchers/lead',
  httpMethod: 'POST',
  creditCost: 0,

  required: ['name', 'lead_name', 'lead_company', 'triggers'],
  optional: ['description', 'lead_title', 'lead_email', 'notification_email'],

  defaults: {},

  validation: {
    name: {
      type: 'string',
      pattern: /^.{3,100}$/,
      examples: ['Watch John Smith', 'Track Sarah Johnson'],
    },
    description: {
      type: 'string',
      examples: ['Alert me when John Smith changes jobs or publishes content'],
    },
    lead_name: {
      type: 'string',
      examples: ['John Smith', 'Sarah Johnson'],
    },
    lead_company: {
      type: 'string',
      examples: ['Salesforce', 'HubSpot'],
    },
    lead_title: {
      type: 'string',
      examples: ['VP of Sales', 'CTO', 'Head of Marketing'],
    },
    lead_email: {
      type: 'string',
      examples: ['john@salesforce.com'],
    },
    triggers: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'Role Change', 'Company Change', 'Job Anniversary',
            'Content Published', 'Speaking Engagements', 'Social Media Activity',
          ].includes(x)
        ),
      examples: [['Role Change', 'Content Published', 'Speaking Engagements']],
    },
    notification_email: {
      type: 'boolean',
      examples: ['true', 'false'],
    },
  },

  description: 'Get alerts when a specific lead changes jobs, publishes content, speaks at events, or shows other buying signals',
}

/**
 * WATCHER LIST — filter the watcher list sidebar
 * Used by set_filters(module: 'watcher_list', filters: {...}) to apply sidebar filters
 */
export const WatcherListSchema: ModuleSchema = {
  name: 'Watcher List Filters',
  module: 'watcher_list',
  route: '/leads/watcher',
  apiEndpoint: '/api/v1/watchers/',
  httpMethod: 'GET',
  creditCost: 0,

  required: [],
  optional: [
    // shared
    'status',
    // event tab
    'event_type', 'funding_stage', 'job_level', 'department', 'company_size',
    // account tab
    'trigger_types', 'account_industry',
    // lead tab
    'lead_trigger_types', 'lead_seniority', 'lead_department',
  ],

  defaults: {},

  validation: {
    status: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) => ['active', 'paused'].includes(x)),
      examples: [['active'], ['paused'], ['active', 'paused']],
    },
    event_type: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'ipo_announcement', 'new_funding_round', 'new_investment',
            'merger_and_acquisitions', 'cost_cutting', 'team_expansion',
            'team_reduction', 'product_launch', 'acquisition',
          ].includes(x)
        ),
      examples: [['new_funding_round', 'team_expansion']],
    },
    funding_stage: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['seed', 'series_a', 'series_b', 'series_c', 'series_d_plus', 'ipo'].includes(x)
        ),
      examples: [['series_a', 'series_b']],
    },
    job_level: {
      type: 'array',
      examples: [['c_level', 'vp']],
    },
    department: {
      type: 'array',
      examples: [['sales', 'marketing']],
    },
    company_size: {
      type: 'array',
      examples: [['201-500', '501-1000']],
    },
    trigger_types: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'website_content_changes', 'funding', 'job_changes',
            'technology_changes', 'news_mentions', 'web_traffic',
          ].includes(x)
        ),
      examples: [['funding', 'job_changes']],
    },
    account_industry: {
      type: 'array',
      examples: [['saas', 'fintech']],
    },
    lead_trigger_types: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          [
            'prospect_changed_role', 'prospect_changed_company',
            'prospect_job_start_anniversary', 'content_published',
            'speaking_engagement', 'social_activity',
          ].includes(x)
        ),
      examples: [['prospect_changed_role', 'content_published']],
    },
    lead_seniority: {
      type: 'array',
      validator: (v) =>
        Array.isArray(v) &&
        (v as string[]).every((x) =>
          ['c_level', 'vp', 'director', 'manager'].includes(x)
        ),
      examples: [['c_level', 'vp']],
    },
    lead_department: {
      type: 'array',
      examples: [['sales', 'marketing']],
    },
  },

  description: 'Filter the watcher list by status, event type, triggers, and other criteria',
}

/**
 * SCHEMA REGISTRY
 * All modules indexed by module name for quick access
 */
export const MODULE_SCHEMAS: Record<string, ModuleSchema> = {
  prospects: ProspectsSchema,
  companies: CompaniesSchema,
  company_identification: CompanyIdentificationSchema,
  company_enrichment: CompanyEnrichmentSchema,
  company_social_posts: CompanySocialPostsSchema,
  social_keyword_search: SocialKeywordSearchSchema,
  intents: IntentsSchema,
  events: EventsSchema,
  trackers: TrackersSchema,
  websights: WebsightsSchema,
  form_complete: FormCompletionsSchema,
  campaigns: CampaignsSchema,
  workflows: WorkflowsSchema,
  ai_agents: AIAgentsSchema,
  global_search: GlobalSearchSchema,
  // Copilot form schemas
  meeting_prep: MeetingPrepSchema,
  pipeline_alerts: PipelineAlertsSchema,
  email_optimizer: EmailOptimizerSchema,
  // Watcher sub-schemas (3 types + list filter)
  event_watcher: EventWatcherSchema,
  account_watcher: AccountWatcherSchema,
  lead_watcher: LeadWatcherSchema,
  watcher_list: WatcherListSchema,
  // Legacy alias kept for backwards-compat
  watcher: EventWatcherSchema,
}

/**
 * UTILITY FUNCTIONS
 */

export function getModuleSchema(module: string): ModuleSchema | undefined {
  return MODULE_SCHEMAS[module]
}

export function getModuleByRoute(route: string): ModuleSchema | undefined {
  return Object.values(MODULE_SCHEMAS).find((s) => s.route === route)
}

export function validateFilters(
  module: string,
  filters: Record<string, unknown>
): Record<string, unknown> | null {
  const schema = getModuleSchema(module)
  if (!schema) return null

  const validated: Record<string, unknown> = {}

  // Check required fields
  for (const field of schema.required) {
    if (!(field in filters)) {
      throw new Error(`Missing required field for ${module}: ${field}`)
    }
    validated[field] = filters[field]
  }

  // Validate optional fields
  for (const field of schema.optional) {
    if (field in filters) {
      const value = filters[field]
      const fieldValidation = schema.validation[field]

      if (fieldValidation?.validator) {
        const isValid = fieldValidation.validator(value)
        if (!isValid) {
          throw new Error(`Invalid value for ${field}: ${value}`)
        }
      } else if (fieldValidation?.pattern) {
        const isValid = fieldValidation.pattern.test(String(value))
        if (!isValid) {
          throw new Error(`Invalid value for ${field}: ${value}`)
        }
      }

      validated[field] = value
    }
  }

  return validated
}
