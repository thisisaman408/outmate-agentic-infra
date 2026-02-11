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
    // --- Firmographics ---
    {
        id: "name",
        label: "Company Name",
        type: "text",
        category: "Firmographics",
        icon: Building2,
        placeholder: "Enter company name..."
    },
    {
        id: "website_domain",
        label: "Website Domain",
        type: "text",
        category: "Firmographics",
        icon: Globe,
        placeholder: "e.g. google.com"
    },
    {
        id: "industry",
        label: "Industry & Keywords",
        type: "industry",
        category: "Firmographics",
        icon: Briefcase,
        placeholder: "Search industries & keywords..."
    },
    {
        id: "categories",
        label: "Categories",
        type: "category",
        category: "Firmographics",
        icon: Tag,
        placeholder: "Search categories..."
    },
    {
        id: "market_segments",
        label: "Market Segments",
        type: "market_segment",
        category: "Firmographics",
        icon: Layers,
        placeholder: "Search market segments..."
    },
    {
        id: "company_type",
        label: "Company Type",
        type: "company_type",
        category: "Firmographics",
        icon: Building2,
        placeholder: "Search company types..."
    },
    {
        id: "founded_year",
        label: "Year Founded",
        type: "year",
        category: "Firmographics",
        icon: Calendar,
        placeholder: "Type year..."
    },
    {
        id: "acquisition_status",
        label: "Acquisition Status",
        type: "select",
        category: "Firmographics",
        icon: Activity,
        options: [
            { label: "Acquired", value: "acquired" },
            { label: "Not Acquired", value: "" }
        ]
    },
    // {
    //     id: "fortune_rank",
    //     label: "Fortune Rank",
    //     type: "select",
    //     category: "Firmographics",
    //     icon: Award,
    //     options: [
    //         { label: "Fortune 500", value: "500" },
    //         { label: "Fortune 1000", value: "1000" }
    //     ]
    // },
    {
        id: "location",
        label: "Account Location",
        type: "location",
        category: "Firmographics",
        icon: MapPin,
        placeholder: "Select Region, Country, State..."
    },
    {
        id: "largest_headcount_country",
        label: "Largest Headcount Country",
        type: "country",
        category: "Firmographics",
        icon: MapPin,
        placeholder: "Search country..."
    },

    // --- Financials & Funding ---
    {
        id: "revenue",
        label: "Annual Revenue",
        type: "revenue",
        category: "Financials & Funding",
        icon: DollarSign,
    },
    {
        id: "estimated_revenue",
        label: "Estimated Revenue (USD)",
        type: "text",
        category: "Financials & Funding",
        icon: DollarSign,
        placeholder: "Enter amount..."
    },
    {
        id: "total_investment",
        label: "Total Investment",
        type: "text",
        category: "Financials & Funding",
        icon: DollarSign,
        placeholder: "Enter amount..."
    },
    {
        id: "funding_stage",
        label: "Funding Round Type",
        type: "multi-select",
        category: "Financials & Funding",
        icon: TrendingUp,
        options: [
            { label: "Any", value: "" },
            { label: "Seed", value: "Seed" },
            { label: "Series Unknown", value: "Series Unknown" },
            { label: "Grant", value: "Grant" },
            { label: "Pre-Seed", value: "Pre-Seed" },
            { label: "Series A", value: "Series A" },
            { label: "Private Equity", value: "Private Equity" },
            { label: "Debt Financing", value: "Debt Financing" },
            { label: "Non-equity Assistance", value: "Non-equity Assistance" },
            { label: "Series B", value: "Series B" },
            { label: "Angel", value: "Angel" },
            { label: "Post-IPO Equity", value: "Post-IPO Equity" },
            { label: "Series C", value: "Series C" },
            { label: "Post-IPO Debt", value: "Post-IPO Debt" },
            { label: "Undisclosed", value: "Undisclosed" },
            { label: "Corporate Round", value: "Corporate Round" },
            { label: "Equity Crowdfunding", value: "Equity Crowdfunding" },
            { label: "Convertible Note", value: "Convertible Note" },
            { label: "Series D", value: "Series D" },
            { label: "Secondary Market", value: "Secondary Market" },
            { label: "Series E", value: "Series E" },
            { label: "Initial Coin Offering", value: "Initial Coin Offering" },
            { label: "Product Crowdfunding", value: "Product Crowdfunding" },
            { label: "Post-IPO Secondary", value: "Post-IPO Secondary" },
            { label: "Series F", value: "Series F" },
            { label: "Series G", value: "Series G" },
            { label: "Series H", value: "Series H" },
            { label: "Series I", value: "Series I" },
            { label: "Series J", value: "Series J" }
        ]
    },
    {
        id: "last_funding",
        label: "Last Funding Date",
        type: "date",
        category: "Financials & Funding",
        icon: Calendar,
        placeholder: "Select date..."
    },
    {
        id: "investors",
        label: "Investors",
        type: "text",
        category: "Financials & Funding",
        icon: Users,
        placeholder: "Search investors..."
    },

    // --- Headcount and growth matrix ---
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
            { label: "501-1,000", value: "501-1,000" },
            { label: "1,001-5,000", value: "1,001-5,000" },
            { label: "5,001-10,000", value: "5,001-10,000" },
            { label: "10,001+", value: "10,001+" }
        ]
    },
    {
        id: "employee_count_exact",
        label: "Employee Count (Exact)",
        type: "text",
        category: "Headcount and growth matrix",
        icon: Users,
        placeholder: "Enter exact number..."
    },
    {
        id: "headcount_growth",
        label: "Headcount Growth (Total)",
        type: "growth_range",
        category: "Headcount and growth matrix",
        icon: TrendingUp,
    },
    {
        id: "growth_6m",
        label: "Growth (6 months)",
        type: "employee_growth",
        category: "Headcount and growth matrix",
        icon: TrendingUp,
    },
    {
        id: "growth_12m",
        label: "Growth (12 months)",
        type: "employee_growth",
        category: "Headcount and growth matrix",
        icon: TrendingUp,
    },
    {
        id: "department_headcount",
        label: "Department Headcount",
        type: "department_range",
        category: "Headcount and growth matrix",
        icon: Users,
    },
    {
        id: "department_headcount_growth",
        label: "Department Headcount Growth",
        type: "department_growth",
        category: "Headcount and growth matrix",
        icon: TrendingUp,
    },

    // --- Signals and activity (Intent to Data) ---
    // {
    //     id: "job_opportunities",
    //     label: "Job Opportunities",
    //     type: "multi-select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Briefcase,
    //     options: [
    //         { label: "Hiring on Linkedin", value: "Hiring on Linkedin" }
    //     ]
    // },
    // {
    //     id: "account_activities",
    //     label: "Account Activities",
    //     type: "multi-select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Activity,
    //     options: [
    //         { label: "Recent Funding (Past 12 Months)", value: "Funding events in past 12 months" },
    //         { label: "Senior Leadership Changes (Past 3 Months)", value: "Senior leadership changes in last 3 months" }
    //     ]
    // },
    // {
    //     id: "news",
    //     label: "In the News",
    //     type: "text",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: FileText,
    //     placeholder: "Search news keywords..."
    // },
    // {
    //     id: "num_of_followers",
    //     label: "Number of Followers",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Users,
    //     options: [
    //         { label: "1-50", value: "1-50" },
    //         { label: "51-100", value: "51-100" },
    //         { label: "101-1000", value: "101-1000" },
    //         { label: "1001-5000", value: "1001-5000" },
    //         { label: "5001+", value: "5001+" }
    //     ]
    // },
    // {
    //     id: "follower_metrics.growth_6m",
    //     label: "Follower Growth (6 Months)",
    //     type: "employee_growth",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: TrendingUp,
    // },
    // --- Social and Content (LinkedIN Post Search) ---
    {
        id: "linkedin_topic",
        label: "Topic/Keyword",
        type: "text",
        category: "Social and Content (LinkedIN Post Search)",
        icon: Search,
        placeholder: "Enter topic or keyword..."
    },
    {
        id: "mentioning_company",
        label: "Mentioning Company",
        type: "text",
        category: "Social and Content (LinkedIN Post Search)",
        icon: Building2,
        placeholder: "Enter company name..."
    },
    {
        id: "mentioning_member",
        label: "Mentioning Member",
        type: "text",
        category: "Social and Content (LinkedIN Post Search)",
        icon: Users,
        placeholder: "Enter member name..."
    },
    {
        id: "content_type",
        label: "Content Type",
        type: "select",
        category: "Social and Content (LinkedIN Post Search)",
        icon: FileText,
        options: [
            { label: "Post", value: "post" },
            { label: "Article", value: "article" },
            { label: "Video", value: "video" }
        ]
    },
    {
        id: "date_posted",
        label: "Date Posted",
        type: "date-range",
        category: "Social and Content (LinkedIN Post Search)",
        icon: Calendar,
        placeholder: "Select date..."
    },

    // --- Existing filters not in specific list, map to closest or Misc ---
    // {
    //     id: "technologies",
    //     label: "Technologies",
    //     type: "technology",
    //     category: "Firmographics",
    //     icon: Monitor,
    //     placeholder: "Search technologies (e.g. Salesforce)..."
    // },
    // {
    //     id: "ai_filters",
    //     label: "AI Filters",
    //     type: "text",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: CloudLightning,
    //     placeholder: "Describe your ideal customer profile using AI..."
    // },
    // {
    //     id: "signals",
    //     label: "Signals",
    //     type: "multi-select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Activity,
    //     options: [
    //         { label: "New Product Launch", value: "new_product" },
    //         { label: "Management Change", value: "management_change" },
    //         { label: "Merger & Acquisition", value: "ma" },
    //         { label: "Funding Round", value: "funding_round" }
    //     ]
    // },
    // {
    //     id: "buying_intent",
    //     label: "Buying Intent",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Target,
    //     options: [
    //         { label: "High", value: "high" },
    //         { label: "Medium", value: "medium" },
    //         { label: "Low", value: "low" }
    //     ]
    // },
    // {
    //     id: "sic_naics",
    //     label: "SIC and NAICS",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Hash,
    //     placeholder: "Search SIC or NAICS codes..."
    // },
    // {
    //     id: "website_visitors",
    //     label: "Website Visitors",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Globe,
    //     options: [
    //         { label: "Visited in last 24h", value: "24h" },
    //         { label: "Visited in last 7d", value: "7d" },
    //         { label: "Visited in last 30d", value: "30d" }
    //     ]
    // },
    // {
    //     id: "scores",
    //     label: "Scores",
    //     type: "range",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Award,
    //     min: 0,
    //     max: 100,
    //     options: [
    //         { label: "0-20", value: "0-20" },
    //         { label: "21-40", value: "21-40" },
    //         { label: "41-60", value: "41-60" },
    //         { label: "61-80", value: "61-80" },
    //         { label: "81-100", value: "81-100" }
    //     ]
    // },
    // {
    //     id: "owner",
    //     label: "Owner",
    //     type: "select",
    //     category: "Firmographics",
    //     icon: Users,
    //     options: [
    //         { label: "Me", value: "me" },
    //         { label: "Unassigned", value: "unassigned" }
    //     ]
    // },
    // {
    //     id: "stage",
    //     label: "Stage",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Layers,
    //     options: [
    //         { label: "Cold", value: "cold" },
    //         { label: "Approached", value: "approached" },
    //         { label: "Replied", value: "replied" },
    //         { label: "Interested", value: "interested" },
    //         { label: "Closed", value: "closed" }
    //     ]
    // },
    // {
    //     id: "custom_fields",
    //     label: "Account Custom Fields",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Database,
    //     placeholder: "Search custom fields..."
    // },
    // {
    //     id: "company_info",
    //     label: "Company Info",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Building2,
    //     placeholder: "Search company info..."
    // },
    // {
    //     id: "employees_by_dept",
    //     label: "# Employees by Dept.",
    //     type: "range",
    //     category: "Headcount and growth matrix",
    //     icon: Users,
    //     options: [
    //         { label: "Engineering: 10+", value: "eng_10_plus" },
    //         { label: "Sales: 10+", value: "sales_10_plus" }
    //     ]
    // },
    // {
    //     id: "job_titles",
    //     label: "Job Titles",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Briefcase,
    //     placeholder: "CEO, CTO, VP Sales..."
    // },
    // {
    //     id: "languages",
    //     label: "Languages",
    //     type: "multi-select",
    //     category: "Firmographics",
    //     icon: Globe,
    //     options: [
    //         { label: "English", value: "en" },
    //         { label: "Spanish", value: "es" },
    //         { label: "French", value: "fr" },
    //         { label: "German", value: "de" }
    //     ]
    // },
    // {
    //     id: "retail_locations",
    //     label: "Retail Locations",
    //     type: "range",
    //     category: "Firmographics",
    //     icon: MapPin,
    //     options: [
    //         { label: "1-10", value: "1-10" },
    //         { label: "11-50", value: "11-50" },
    //         { label: "50+", value: "50_plus" }
    //     ]
    // },
    // {
    //     id: "engagement",
    //     label: "Engagement Activity",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Activity,
    //     options: [
    //         { label: "Opened Email", value: "opened_email" },
    //         { label: "Clicked Link", value: "clicked_link" }
    //     ]
    // },
    // {
    //     id: "sequence",
    //     label: "Sequence",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: Layers,
    //     options: [
    //         { label: "Active in Sequence", value: "active" },
    //         { label: "Finished Sequence", value: "finished" }
    //     ]
    // },
    // {
    //     id: "workflows",
    //     label: "Workflows",
    //     type: "select",
    //     category: "Signals and activity (Intent to Data)",
    //     icon: CloudLightning,
    //     placeholder: "Select workflow..."
    // },
    // {
    //     id: "created_source",
    //     label: "Created Source",
    //     type: "select",
    //     category: "Firmographics",
    //     icon: Database,
    //     options: [
    //         { label: "App", value: "app" },
    //         { label: "API", value: "api" },
    //         { label: "Import", value: "import" }
    //     ]
    // },
    // {
    //     id: "source",
    //     label: "Source",
    //     type: "select",
    //     category: "Firmographics",
    //     icon: Database,
    //     options: [
    //         { label: "LinkedIn", value: "linkedin" },
    //         { label: "Manual", value: "manual" }
    //     ]
    // },
    // {
    //     id: "csv_import",
    //     label: "Account CSV Import",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: FileText,
    //     placeholder: "Search import batch..."
    // },
    // {
    //     id: "created_date",
    //     label: "Account Created Date",
    //     type: "date-range",
    //     category: "Firmographics",
    //     icon: Calendar,
    //     placeholder: "Select date range..."
    // },
    // {
    //     id: "misc",
    //     label: "Misc.",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: HelpCircle,
    //     placeholder: "Search miscellaneous..."
    // },
    // {
    //     id: "parent_accounts",
    //     label: "Parent Accounts",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Building2,
    //     placeholder: "Search parent account..."
    // },
    // {
    //     id: "territories",
    //     label: "Territories",
    //     type: "select",
    //     category: "Firmographics",
    //     icon: MapPin,
    //     options: [
    //         { label: "North America", value: "na" },
    //         { label: "EMEA", value: "emea" },
    //         { label: "APAC", value: "apac" }
    //     ]
    // },
    // {
    //     id: "lists",
    //     label: "Lists",
    //     type: "multi-select",
    //     category: "Firmographics",
    //     icon: FileText,
    //     options: [
    //         { label: "My Lists", value: "my_lists" },
    //         { label: "Team Lists", value: "team_lists" }
    //     ]
    // },
    // {
    //     id: "lookalikes",
    //     label: "Lookalikes",
    //     type: "text",
    //     category: "Firmographics",
    //     icon: Users,
    //     placeholder: "Enter company to find lookalikes..."
    // }
]

export const PINNED_FILTERS_DEFAULT = [
    "name",
    "location",
    "employee_count",
    "industry",
    "categories",
    "revenue",
    "company_type"
]


