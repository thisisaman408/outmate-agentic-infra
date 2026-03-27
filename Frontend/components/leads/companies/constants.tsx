import { Building2, Users, MapPin, Hash, Briefcase, TrendingUp, Monitor, DollarSign, Globe, Award, Calendar, Activity, Database, FileText, Layers, CloudLightning, HelpCircle, Search, Tag, LucideIcon, Target } from "lucide-react"

export type FilterType = 'text' | 'select' | 'multi-select' | 'range' | 'date-range' | 'location' | 'industry' | 'technology' | 'category' | 'market_segment' | 'company_type' | 'year' | 'country' | 'revenue' | 'date' | 'growth_range' | 'employee_growth' | 'department_range' | 'department_growth'

export interface FilterOption {
    label: string
    value: string
    count?: number
}

export interface FilterConfig {
    id: string
    label: string
    type: FilterType
    options?: FilterOption[]
    placeholder?: string
    min?: number
    max?: number
    category: typeof FILTER_CATEGORIES[number]
    icon?: LucideIcon
    description?: string
    requiresPro?: boolean
}

export const FILTER_CATEGORIES = [
    "Firmographics",
    "Financials & Funding",
    "Headcount and growth matrix",
    "Signals and Intent",
    "Social and Content (LinkedIN Post Search)"
] as const

export const ALL_FILTERS: FilterConfig[] = [
    // Firmographics - supported by backend search
    {
        id: "name",
        label: "Company Name",
        type: "text",
        category: "Firmographics",
        icon: Building2,
        placeholder: "Enter company name..."
    },
    {
        id: "domain",
        label: "Domain",
        type: "text",
        category: "Firmographics",
        icon: Globe,
        placeholder: "e.g. google.com"
    },
    {
        id: "industry",
        label: "Industry",
        type: "industry",
        category: "Firmographics",
        icon: Briefcase,
        placeholder: "Search industries..."
    },
    {
        id: "employee_count",
        label: "Employee Count (Range)",
        type: "multi-select",
        category: "Headcount and growth matrix",
        icon: Users,
        options: [
            { label: "1-10", value: "1-10" },
            { label: "11-50", value: "11-50" },
            { label: "51-200", value: "51-200" },
            { label: "201-500", value: "201-500" },
            { label: "501-1000", value: "501-1000" },
            { label: "1001-5000", value: "1001-5000" },
            { label: "5001-10000", value: "5001-10000" },
            { label: "10001+", value: "10001+" }
        ]
    }
    ,
    {
        id: "country",
        label: "Headquarters Country",
        type: "country",
        category: "Firmographics",
        icon: MapPin,
        placeholder: "Select country"
    },
    {
        id: "region_country_code",
        label: "Operational Region Codes",
        type: "multi-select",
        category: "Firmographics",
        icon: Globe,
        options: [
            { label: "California, USA (us-ca)", value: "us-ca" },
            { label: "Georgia, USA (us-ga)", value: "us-ga" },
            { label: "New York, USA (us-ny)", value: "us-ny" },
            { label: "Texas, USA (us-tx)", value: "us-tx" },
            { label: "Ontario, Canada (ca-on)", value: "ca-on" },
            { label: "England, UK (gb-eng)", value: "gb-eng" },
            { label: "European Union (eu)", value: "eu" },
            { label: "Asia Pacific (apac)", value: "apac" }
        ]
    },
    {
        id: "company_size",
        label: "Company Size",
        type: "multi-select",
        category: "Headcount and growth matrix",
        icon: Users,
        options: [
            { label: "1-10", value: "1-10" },
            { label: "11-50", value: "11-50" },
            { label: "51-200", value: "51-200" },
            { label: "201-500", value: "201-500" },
            { label: "501-1000", value: "501-1000" },
            { label: "1001-5000", value: "1001-5000" },
            { label: "5001-10000", value: "5001-10000" },
            { label: "10001+", value: "10001+" }
        ]
    },
    {
        id: "google_category",
        label: "Google Category",
        type: "multi-select",
        category: "Firmographics",
        icon: Layers,
        options: [
            { label: "E-commerce", value: "E-commerce" },
            { label: "Technology", value: "Technology" },
            { label: "Manufacturing", value: "Manufacturing" },
            { label: "Financial Services", value: "Financial Services" },
            { label: "Logistics", value: "Logistics" }
        ]
    },
    {
        id: "linkedin_category",
        label: "Industry Category",
        type: "multi-select",
        category: "Firmographics",
        icon: Layers,
        requiresPro: true,
        options: [
            { label: "Software Development", value: "software development" },
            { label: "Military & Defense", value: "defense & space" },
            { label: "Investment Banking", value: "investment banking" },
            { label: "Marketing & Advertising", value: "marketing & advertising" }
        ]
    },
    {
        id: "topics",
        label: "Intent Topics",
        type: "text",
        category: "Signals and Intent",
        icon: Activity,
        placeholder: "e.g., cloud: cloud computing"
    },
    {
        id: "events",
        label: "Business Event Signals",
        type: "multi-select",
        category: "Signals and Intent",
        icon: Activity,
        options: [
            { label: "Hiring in Sales", value: "hiring_in_sales_department" },
            { label: "New Product", value: "new_product" },
            { label: "Funding Round", value: "new_funding_round" },
            { label: "New Office", value: "new_office" },
            { label: "Executive Move", value: "executive_move" }
        ]
    },
    {
        id: "last_occurrence",
        label: "Event Lookback Days",
        type: "text",
        category: "Signals and Intent",
        icon: Calendar,
        placeholder: "Enter days (30-90)",
        requiresPro: true
    },
    {
        id: "has_website",
        label: "Has Website",
        type: "multi-select",
        category: "Firmographics",
        icon: Globe,
        requiresPro: true,
        options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
        ]
    },
    {
        id: "is_public_company",
        label: "Publicly Traded",
        type: "multi-select",
        category: "Firmographics",
        icon: Award,
        requiresPro: true,
        options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
        ]
    },
    {
        id: "include_operating_locations",
        label: "Include Operating Locations",
        type: "multi-select",
        category: "Firmographics",
        icon: MapPin,
        requiresPro: true,
        options: [
            { label: "True (default)", value: "true" },
            { label: "False (HQ-only)", value: "false" }
        ]
    },
    {
        id: "funding_stage",
        label: "Funding Stage",
        type: "multi-select",
        category: "Financials & Funding",
        icon: DollarSign,
        options: [
            { label: "Seed", value: "seed" },
            { label: "Series A", value: "series_a" },
            { label: "Series B", value: "series_b" },
            { label: "Series C+", value: "series_c_plus" },
            { label: "Growth", value: "growth" },
            { label: "Private Equity / Late Stage", value: "late_stage" }
        ]
    },
    {
        id: "has_recent_funding",
        label: "Recent Funding Activity",
        type: "multi-select",
        category: "Financials & Funding",
        icon: DollarSign,
        options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
        ]
    },
    {
        id: "revenue_range",
        label: "Revenue Range (USD Millions)",
        type: "revenue",
        category: "Financials & Funding",
        icon: DollarSign,
        requiresPro: true
    },
    {
        id: "job_openings_count",
        label: "Active Job Count",
        type: "text",
        category: "Headcount and growth matrix",
        icon: Activity,
        placeholder: "e.g., 25",
        requiresPro: true
    },
    {
        id: "technologies",
        label: "Tech Stack / Keywords",
        type: "technology",
        category: "Social and Content (LinkedIN Post Search)",
        icon: CloudLightning,
        placeholder: "e.g., Kubernetes",
        options: [
            { label: "Kubernetes", value: "Kubernetes" },
            { label: "Salesforce", value: "Salesforce" },
            { label: "HubSpot", value: "HubSpot" },
            { label: "AWS", value: "AWS" },
            { label: "Snowflake", value: "Snowflake" },
            { label: "Stripe", value: "Stripe" },
            { label: "Figma", value: "Figma" },
            { label: "Docker", value: "Docker" },
            { label: "SAP", value: "SAP" },
            { label: "Oracle", value: "Oracle" }
        ]
    }
]

export const PINNED_FILTERS_DEFAULT = [
    "name",
    "domain",
    "country",
    "industry",
    "employee_count"
]

