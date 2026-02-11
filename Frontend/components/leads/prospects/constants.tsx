import { Building2, Users, MapPin, Hash, Briefcase, TrendingUp, Monitor, DollarSign, Globe, Award, Calendar, Activity, Database, FileText, Layers, CloudLightning, HelpCircle, Mail, Phone, UserCheck, UserX, Clock, Link, MessageSquare } from "lucide-react"

export type FilterType =
    | "text"
    | "select"
    | "multi-select"
    | "range"
    | "date-range"
    | "boolean"
    | "location"
    | "industry"
    | "technology"
    | "language"
    | "school"

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
    icon?: any
    description?: string
    category: string
    supportsOperator?: boolean
}

export const FILTER_CATEGORIES = [
    "Job & Role (Professional Info)",
    "Company Criteria",
    "Location & Demographics",
    "Experience & Education",
    // "Signals & Activity (Intent)",
    // "Skills & Expertise",
    // "Others"
] as const

export const ALL_FILTERS: FilterConfig[] = [
    // Lists
    {
        id: "lists",
        label: "Lists",
        type: "multi-select",
        category: "Others",
        icon: FileText,
        options: [
            { label: "My Lists", value: "my_lists" },
            { label: "Team Lists", value: "team_lists" }
        ]
    },
    // // Persona
    // {
    //     id: "persona",
    //     label: "Persona",
    //     type: "multi-select",
    //     category: "Job & Role (Professional Info)",
    //     icon: Users,
    //     options: [
    //         { label: "Decision Maker", value: "decision_maker" },
    //         { label: "Influencer", value: "influencer" },
    //         { label: "Champion", value: "champion" }
    //     ]
    // },
    // Email Status
    {
        id: "email_status",
        label: "Email Status",
        type: "multi-select",
        category: "Others",
        icon: Mail,
        options: [
            { label: "Verified", value: "verified" },
            { label: "Guessed", value: "guessed" },
            { label: "Unavailable", value: "unavailable" }
        ]
    },
    // Job Titles
    {
        id: "current_title",
        label: "Current Title",
        type: "text",
        category: "Job & Role (Professional Info)",
        icon: Briefcase,
        placeholder: "CEO, CTO, VP Sales..."
    },
    {
        id: "past_title",
        label: "Past Title",
        type: "text",
        category: "Job & Role (Professional Info)",
        icon: Briefcase,
        placeholder: "Ex-Founder, Former VP..."
    },
    {
        id: "function",
        label: "Function / Department",
        type: "multi-select",
        category: "Job & Role (Professional Info)",
        icon: Layers,
        options: [
            { label: "Accounting", value: "Accounting" },
            { label: "Administrative", value: "Administrative" },
            { label: "Arts and Design", value: "Arts and Design" },
            { label: "Business Development", value: "Business Development" },
            { label: "Community and Social Services", value: "Community and Social Services" },
            { label: "Consulting", value: "Consulting" },
            { label: "Education", value: "Education" },
            { label: "Engineering", value: "Engineering" },
            { label: "Entrepreneurship", value: "Entrepreneurship" },
            { label: "Finance", value: "Finance" },
            { label: "Healthcare Services", value: "Healthcare Services" },
            { label: "Human Resources", value: "Human Resources" },
            { label: "Information Technology", value: "Information Technology" },
            { label: "Legal", value: "Legal" },
            { label: "Marketing", value: "Marketing" },
            { label: "Media and Communication", value: "Media and Communication" },
            { label: "Military and Protective Services", value: "Military and Protective Services" },
            { label: "Operations", value: "Operations" },
            { label: "Product Management", value: "Product Management" },
            { label: "Program and Project Management", value: "Program and Project Management" },
            { label: "Purchasing", value: "Purchasing" },
            { label: "Quality Assurance", value: "Quality Assurance" },
            { label: "Real Estate", value: "Real Estate" },
            { label: "Research", value: "Research" },
            { label: "Sales", value: "Sales" },
            { label: "Customer Success and Support", value: "Customer Success and Support" }
        ]
    },
    {
        id: "seniority_level",
        label: "Seniority Level",
        type: "multi-select",
        category: "Job & Role (Professional Info)",
        icon: Award,
        supportsOperator: true,
        options: [
            { label: "Owner / Partner", value: "Owner / Partner" },
            { label: "CXO", value: "CXO" },
            { label: "Vice President", value: "Vice President" },
            { label: "Director", value: "Director" },
            { label: "Experienced Manager", value: "Experienced Manager" },
            { label: "Entry Level Manager", value: "Entry Level Manager" },
            { label: "Strategic", value: "Strategic" },
            { label: "Senior", value: "Senior" },
            { label: "Entry Level", value: "Entry Level" },
            { label: "In Training", value: "In Training" }
        ]
    },
    {
        id: "keyword",
        label: "Keyword",
        type: "text",
        category: "Job & Role (Professional Info)",
        icon: Hash,
        placeholder: "Search keywords..."
    },
    // People Lookalikes
    {
        id: "people_lookalikes",
        label: "People Lookalikes",
        type: "text",
        category: "Others",
        icon: Users,
        placeholder: "Find similar people..."
    },
    // Company
    {
        id: "company",
        label: "Company",
        type: "text",
        category: "Company Criteria",
        icon: Building2,
        placeholder: "Enter company name..."
    },
    // Company Lookalikes
    {
        id: "company_lookalikes",
        label: "Company Lookalikes",
        type: "text",
        category: "Others",
        icon: Building2,
        placeholder: "Find similar companies..."
    },
    // Education
    {
        id: "education",
        label: "Education",
        type: "school",
        category: "Experience & Education",
        icon: Award,
        placeholder: "Search schools..."
    },
    // Location
    {
        id: "location",
        label: "Location",
        type: "location",
        category: "Location & Demographics",
        icon: MapPin,
        placeholder: "City, Country, Region..."
    },
    // # Employees
    {
        id: "employees",
        label: "# Employees",
        type: "range",
        category: "Company Criteria",
        icon: Users,
        options: [
            { label: "1-10", value: "1-10" },
            { label: "11-50", value: "11-50" },
            { label: "51-200", value: "51-200" },
            { label: "201-500", value: "201-500" },
            { label: "501-1000", value: "501-1000" },
            { label: "1000+", value: "1000_plus" }
        ]
    },
    // Industry & Keywords
    {
        id: "industry",
        label: "Industry & Keywords",
        type: "industry",
        category: "Company Criteria",
        icon: Briefcase,
        placeholder: "Search industries..."
    },
    // Market Segments
    {
        id: "market_segments",
        label: "Market Segments",
        type: "text",
        category: "Company Criteria",
        icon: Layers,
        placeholder: "Search market segments..."
    },
    // // SIC and NAICS
    // {
    //     id: "sic_naics",
    //     label: "SIC and NAICS",
    //     type: "text",
    //     category: "Company Criteria",
    //     icon: Hash,
    //     placeholder: "Enter codes..."
    // },
    // First Name
    {
        id: "first_name",
        label: "First Name",
        type: "text",
        category: "Location & Demographics",
        icon: UserCheck,
        placeholder: "Enter first name..."
    },
    // Last Name
    {
        id: "last_name",
        label: "Last Name",
        type: "text",
        category: "Location & Demographics",
        icon: UserCheck,
        placeholder: "Enter last name..."
    },
    // Profile Language
    {
        id: "profile_languages",
        label: "Profile Language",
        type: "language",
        category: "Location & Demographics",
        icon: Globe,
        placeholder: "Search languages..."
    },
    // // Buying Intent
    // {
    //     id: "buying_intent",
    //     label: "Buying Intent",
    //     type: "select",
    //     category: "Signals & Activity (Intent)",
    //     icon: TrendingUp,
    //     options: [
    //         { label: "High", value: "high" },
    //         { label: "Medium", value: "medium" },
    //         { label: "Low", value: "low" }
    //     ]
    // },
    // Scores
    {
        id: "scores",
        label: "Scores",
        type: "range",
        category: "Others",
        icon: Award,
        min: 0,
        max: 100,
        options: [
            { label: "0-20", value: "0-20" },
            { label: "21-40", value: "21-40" },
            { label: "41-60", value: "41-60" },
            { label: "61-80", value: "61-80" },
            { label: "81-100", value: "81-100" }
        ]
    },
    // Owner
    {
        id: "owner",
        label: "Owner",
        type: "select",
        category: "Others",
        icon: UserCheck,
        options: [
            { label: "Me", value: "me" },
            { label: "Unassigned", value: "unassigned" }
        ]
    },
    // Technologies
    {
        id: "technologies",
        label: "Technologies",
        type: "technology",
        category: "Company Criteria",
        icon: Monitor,
        placeholder: "Search technologies..."
    },
    // Revenue
    {
        id: "revenue",
        label: "Revenue",
        type: "select",
        category: "Company Criteria",
        icon: DollarSign,
        options: [
            { label: "$0 - $1M", value: "0-1M" },
            { label: "$1M - $10M", value: "1M-10M" },
            { label: "$10M - $50M", value: "10M-50M" },
            { label: "$50M - $100M", value: "50M-100M" },
            { label: "$100M+", value: "100M+" }
        ]
    },
    // Funding
    {
        id: "funding",
        label: "Funding",
        type: "multi-select",
        category: "Company Criteria",
        icon: TrendingUp,
        options: [
            { label: "Any", value: "" },
            { label: "Seed", value: "seed" },
            { label: "Series Unknown", value: "series_unknown" },
            { label: "Grant", value: "grant" },
            { label: "Pre-Seed", value: "pre_seed" },
            { label: "Series A", value: "series_a" },
            { label: "Private Equity", value: "private_equity" },
            { label: "Debt Financing", value: "debt_financing" },
            { label: "Non-equity Assistance", value: "non_equity_assistance" },
            { label: "Series B", value: "series_b" },
            { label: "Angel", value: "angel" },
            { label: "Post-IPO Equity", value: "post_ipo_equity" },
            { label: "Series C", value: "series_c" },
            { label: "Post-IPO Debt", value: "post_ipo_debt" },
            { label: "Undisclosed", value: "undisclosed" },
            { label: "Corporate Round", value: "corporate_round" },
            { label: "Equity Crowdfunding", value: "equity_crowdfunding" },
            { label: "Convertible Note", value: "convertible_note" },
            { label: "Series D", value: "series_d" },
            { label: "Secondary Market", value: "secondary_market" },
            { label: "Series E", value: "series_e" },
            { label: "Initial Coin Offering", value: "initial_coin_offering" },
            { label: "Product Crowdfunding", value: "product_crowdfunding" },
            { label: "Post-IPO Secondary", value: "post_ipo_secondary" },
            { label: "Series F", value: "series_f" },
            { label: "Series G", value: "series_g" },
            { label: "Series H", value: "series_h" },
            { label: "Series I", value: "series_i" },
            { label: "Series J", value: "series_j" }
        ]
    },
    // // Changed Jobs Recently
    // {
    //     id: "recently_changed_jobs",
    //     label: "Changed Jobs Recently",
    //     type: "boolean",
    //     category: "Signals & Activity (Intent)",
    //     icon: Activity,
    // },
    // // Posted on LinkedIn
    // {
    //     id: "posted_on_linkedin",
    //     label: "Posted on LinkedIn",
    //     type: "boolean",
    //     category: "Signals & Activity (Intent)",
    //     icon: MessageSquare,
    // },
    // // In The News
    // {
    //     id: "in_the_news",
    //     label: "In The News",
    //     type: "boolean",
    //     category: "Signals & Activity (Intent)",
    //     icon: Globe,
    // },
    // Phone Status
    {
        id: "phone_status",
        label: "Phone Status/Confidence",
        type: "multi-select",
        category: "Others",
        icon: Phone,
        options: [
            { label: "Mobile", value: "mobile" },
            { label: "Direct", value: "direct" },
            { label: "Verified", value: "verified" }
        ]
    },
    // Total Years of Experience
    {
        id: "years_experience",
        label: "Total Years of Experience",
        type: "range",
        category: "Experience & Education",
        icon: Clock,
        options: [
            { label: "Less than 1 year", value: "less_than_1_year" },
            { label: "1 to 2 years", value: "1_to_2_years" },
            { label: "3 to 5 years", value: "3_to_5_years" },
            { label: "6 to 10 years", value: "6_to_10_years" },
            { label: "More than 10 years", value: "more_than_10_years" }
        ]
    },
    // Years at Current Company
    {
        id: "years_at_current_company",
        label: "Years at Current Company",
        type: "range",
        category: "Experience & Education",
        icon: Clock,
        options: [
            { label: "Less than 1 year", value: "less_than_1_year" },
            { label: "1 to 2 years", value: "1_to_2_years" },
            { label: "3 to 5 years", value: "3_to_5_years" },
            { label: "6 to 10 years", value: "6_to_10_years" },
            { label: "More than 10 years", value: "more_than_10_years" }
        ]
    },
    // Years in Current Position
    {
        id: "years_in_current_position",
        label: "Years in Current Position",
        type: "range",
        category: "Experience & Education",
        icon: Clock,
        options: [
            { label: "Less than 1 year", value: "less_than_1_year" },
            { label: "1 to 2 years", value: "1_to_2_years" },
            { label: "3 to 5 years", value: "3_to_5_years" },
            { label: "6 to 10 years", value: "6_to_10_years" },
            { label: "More than 10 years", value: "more_than_10_years" }
        ]
    }
]

export const PINNED_FILTERS_DEFAULT = [
    "current_title",
    "past_title",
    "function",
    "seniority_level",  // Added - supports Include/Exclude operator
    "location",
    "first_name",
    "last_name",
    "profile_languages",
]

// Note: I'm importing all icons that might be needed. 
import { Target } from "lucide-react" 
