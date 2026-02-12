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
}

export const FILTER_CATEGORIES = [
    "Firmographics",
    "Financials & Funding",
    "Headcount and growth matrix",
    // "Signals and activity (Intent to Data)",
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
]

export const PINNED_FILTERS_DEFAULT = [
    "name",
    "domain",
    "industry",
    "employee_count"
]


