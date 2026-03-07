"use client"

import { Card } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    ExternalLink,
    Building2,
    Search,
    ChevronLeft,
    ChevronRight,
    Columns3,
    Download,
    Loader2,
    Zap,
    Lock,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const CONTACTOUT_EMAIL_COST = 1
const CONTACTOUT_PHONE_COST = 1

const formatCreditsLabel = (value?: number, fallback = "~1 credit") => {
    if (typeof value === "number") {
        return `${value} credit${value === 1 ? "" : "s"}`
    }
    return fallback
}

// Complete company data interface matching all backend columns
export interface CompanyData {
    id: string
    // Basic Info
    name: string
    domain: string
    website?: string
    description?: string
    logo_url?: string

    // Firmographic
    industry?: string
    sub_industry?: string
    linkedin_industry_category?: string
    employee_count_range?: string
    employee_count_exact?: number
    revenue_range?: string
    revenue_exact?: number
    founded_year?: number
    company_type?: string
    ticker?: string
    stock_symbol?: string
    exchange?: string
    market_cap?: number
    fiscal_year_end?: string
    number_of_locations?: number

    // Location
    headquarters_country?: string
    headquarters_state?: string
    headquarters_city?: string
    headquarters_address?: string
    street?: string
    zip_code?: string
    location_display?: string
    locations?: string[]
    locations_distribution_count?: number

    // Revealable Contact Info
    phone?: string
    email?: string
    personal_email?: string
    work_email?: string

    // Tech
    technologies?: string[]

    // Funding
    funding_stage?: string
    funding_total?: number
    last_funding_date?: string
    has_recent_funding?: boolean
    investors_count?: number
    investors?: string | string[]
    last_raised_amount?: number

    // Social
    linkedin_url?: string
    twitter_url?: string
    facebook_url?: string
    instagram_url?: string
    follower_count?: number

    // Metrics & Performance
    employee_growth_6m?: number
    employee_growth_12m?: number
    employee_growth_6m_percent?: number
    employee_growth_12m_percent?: number
    growth_category?: string
    job_openings_count?: number
    web_traffic?: number
    seo_score?: number
    decision_makers_count?: number
    acquisition_status?: string
    data_quality_score?: number
    alexa_rank?: number
    is_tech_heavy?: boolean

    // Metadata & Classification
    provider_source?: string
    external_id?: string
    enriched?: boolean
    last_enriched_at?: string
    created_at?: string
    updated_at?: string
    taxonomy?: string | string[]
    naics?: string
    naics_description?: string
    sic_code?: string
    sic_code_description?: string
    social_insights?: string[]
    raw_data?: Record<string, any>
}

// Column configuration
interface ColumnConfig {
    key: keyof CompanyData | string
    label: string
    visible: boolean
    width?: string
    render?: (value: any, row: CompanyData) => React.ReactNode
    category: 'basic' | 'firmographic' | 'location' | 'funding' | 'metrics' | 'metadata' | 'social'
}

// Define all available columns
const DEFAULT_COLUMNS: ColumnConfig[] = [
    // Basic Info - Always visible by default
    { key: 'name', label: 'Company', visible: true, width: '200px', category: 'basic' },
    { key: 'domain', label: 'Domain', visible: true, width: '150px', category: 'basic' },
    { key: 'industry', label: 'Industry', visible: true, width: '180px', category: 'basic' },

    // Firmographic
    { key: 'employee_count_exact', label: 'Employees', visible: true, width: '100px', category: 'firmographic' },
    { key: 'employee_count_range', label: 'Emp. Range', visible: false, width: '100px', category: 'firmographic' },
    { key: 'revenue_exact', label: 'Revenue', visible: true, width: '120px', category: 'firmographic' },
    { key: 'revenue_range', label: 'Rev. Range', visible: false, width: '100px', category: 'firmographic' },
    { key: 'company_type', label: 'Type', visible: true, width: '100px', category: 'firmographic' },
    { key: 'founded_year', label: 'Founded', visible: false, width: '80px', category: 'firmographic' },
    { key: 'linkedin_industry_category', label: 'LinkedIn Industry', visible: false, width: '150px', category: 'firmographic' },

    // Location
    { key: 'headquarters_country', label: 'Country', visible: true, width: '120px', category: 'location' },
    { key: 'headquarters_state', label: 'State', visible: true, width: '120px', category: 'location' },
    { key: 'headquarters_city', label: 'City', visible: true, width: '120px', category: 'location' },
    { key: 'headquarters_address', label: 'Address', visible: true, width: '200px', category: 'location' },
    { key: 'zip_code', label: 'Zip', visible: true, width: '80px', category: 'location' },
    { key: 'locations', label: 'Locations', visible: false, width: '150px', category: 'location' },
    { key: 'locations_distribution_count', label: '#Locations', visible: true, width: '100px', category: 'location' },
    { key: 'phone', label: 'Phone', visible: true, width: '220px', category: 'location' },
    { key: 'email', label: 'Email', visible: true, width: '240px', category: 'location' },
    { key: 'linkedin_url', label: 'LinkedIn', visible: true, width: '100px', category: 'social' },

    // Funding
    { key: 'funding_stage', label: 'Funding Stage', visible: true, width: '120px', category: 'funding' },
    { key: 'funding_total', label: 'Total Funding', visible: true, width: '120px', category: 'funding' },
    { key: 'last_funding_date', label: 'Last Funding', visible: true, width: '110px', category: 'funding' },
    { key: 'investors', label: 'Investors', visible: true, width: '250px', category: 'funding' },
    { key: 'investors_count', label: 'Investors Count', visible: false, width: '100px', category: 'funding' },

    // Metrics & Performance
    { key: 'technologies', label: 'Technologies', visible: true, width: '200px', category: 'metrics' },
    { key: 'decision_makers_count', label: 'Decision Makers', visible: true, width: '120px', category: 'metrics' },
    { key: 'is_tech_heavy', label: 'Tech Heavy', visible: true, width: '100px', category: 'metrics' },
    { key: 'data_quality_score', label: 'Quality Score', visible: false, width: '100px', category: 'metrics' },

    // Metadata & Classification
    { key: 'id', label: 'Business ID', visible: true, width: '150px', category: 'metadata' },
    { key: 'enriched', label: 'Enriched', visible: false, width: '80px', category: 'metadata' },
]

type ContactCacheEntry = {
    emails?: string[]
    phones?: string[]
    loadingEmail?: boolean
    loadingPhone?: boolean
    attemptedEmail?: boolean
    attemptedPhone?: boolean
}

interface CompaniesResultsTableProps {
    companies: CompanyData[]
    isLoading: boolean
    hasSearched: boolean
    onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => void
    enrichCache?: Record<string, { email?: string; phone?: string; contact_name?: string; contact_title?: string; loading?: boolean }>
    waterfallAttempts?: Record<string, { email?: boolean; phone?: boolean }>
}

// Format utilities
function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A'
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value}`
}

function formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A'
    return value.toLocaleString()
}

function formatDate(value: string | undefined): string {
    if (!value) return 'N/A'
    try {
        return new Date(value).toLocaleDateString()
    } catch {
        return value
    }
}

function formatPercent(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value}%`
}

// Sub-component for rendering cells to isolate logic from main component
const RenderCell = ({
    column,
    company,
    enrichData,
    onEnrichReveal,
    contactCache,
    onContactReveal,
    waterfallAttempts
}: {
    column: ColumnConfig,
    company: CompanyData,
    enrichData?: { email?: string; phone?: string; contact_name?: string; contact_title?: string; loading?: boolean },
    onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => void,
    contactCache: Record<string, ContactCacheEntry>,
    onContactReveal?: (company: CompanyData, field: 'email' | 'phone') => Promise<void>
    waterfallAttempts?: Record<string, { email?: boolean; phone?: boolean }>
}) => {
        const value = (company as any)[column.key]
        const companyConfidence = typeof company.data_quality_score === 'number'
            ? Math.max(0, Math.min(100, Math.round(company.data_quality_score)))
            : undefined

    // Revealable Contact Info (Phone/Email)
    if (column.key.toString().toLowerCase().includes('phone') ||
        column.key.toString().toLowerCase().includes('email')) {
        const isPhoneCol = column.key.toString().toLowerCase().includes('phone')
        const isEmailCol = column.key.toString().toLowerCase().includes('email')
        const field: 'email' | 'phone' = isPhoneCol ? 'phone' : 'email'
        const revealKey = `${company.id}-${field}`
        const cacheEntry = contactCache[revealKey] || {}
        const contactList = isPhoneCol ? cacheEntry.phones : cacheEntry.emails
        const contactValue = contactList && contactList.length > 0 ? contactList[0] : null
        const isLoadingContact = isPhoneCol ? cacheEntry.loadingPhone : cacheEntry.loadingEmail
        const companyId = company.domain || company.id
        const fallbackValue = value ? (Array.isArray(value) ? value.join(', ') : value) : null
        const waterfallField = isPhoneCol ? enrichData?.phone : isEmailCol ? enrichData?.email : undefined
        const waterfallValue = waterfallField
            ? typeof waterfallField === 'object'
                ? (waterfallField.email || waterfallField.phone || waterfallField.value || '')
                : String(waterfallField)
            : undefined
        const waterfallCredits = typeof waterfallField === 'object' ? waterfallField.credits_consumed : undefined
        const contactAttempted = isEmailCol ? cacheEntry.attemptedEmail : cacheEntry.attemptedPhone
        const showRevealControls = !waterfallValue && !contactValue && !isLoadingContact
        const attemptRecord = waterfallAttempts?.[companyId] || {}
        const attemptedWaterfall = isPhoneCol ? attemptRecord.phone : attemptRecord.email
        const attemptMessage = isEmailCol ? "Email not available via ContactOut" : "Phone not available via ContactOut"
        const iconColorClass = waterfallValue
            ? "text-emerald-500 hover:text-emerald-600"
            : attemptedWaterfall
                ? "text-orange-500 hover:text-orange-600"
                : "text-blue-500 hover:text-blue-600"

        return (
            <div className="flex items-center gap-2">
                {/* Existing company data */}
                {fallbackValue && !waterfallValue && !contactValue && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs">
                            {fallbackValue}
                        </span>
                        <div className="text-xs text-green-600 font-medium">✓ Company</div>
                    </div>
                )}

                {/* ContactOut result */}
                {contactValue && !waterfallValue && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs break-all">
                            {contactValue}
                        </span>
                        <div className="text-xs text-green-600 font-medium">✓ ContactOut</div>
                    </div>
                )}

                {/* Enriched data */}
                {typeof waterfallValue !== 'undefined' && (
                    <div className="flex items-center gap-2">
                        <span className={`text-xs ${!waterfallValue ? 'text-muted-foreground italic' : ''}`}>
                            {waterfallValue || 'Not available'}
                        </span>
                        <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                    </div>
                )}

                {/* ContactOut loading */}
                {isLoadingContact && (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Revealing...</span>
                    </div>
                )}

                {/* Reveal controls */}
                {showRevealControls && (
                    contactAttempted ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{attemptMessage}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={async (e) => {
                                    e.stopPropagation()
                                    await onContactReveal?.(company, field)
                                }}
                                disabled={!company.linkedin_url && !company.domain}
                            >
                                <Lock className="h-3 w-3 mr-1" />
                                Reveal again
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ml-1 ${iconColorClass}`}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEnrichReveal?.(companyId, field)
                                }}
                                title={`Waterfall zap: ${formatCreditsLabel(waterfallCredits)}${waterfallValue ? "" : attemptedWaterfall ? " · retry waterfall" : ""}`}
                            >
                                <Zap className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={async (e) => {
                                    e.stopPropagation()
                                    await onContactReveal?.(company, field)
                                }}
                                disabled={!company.linkedin_url && !company.domain}
                            >
                                <Lock className="h-3 w-3 mr-1" />
                                Tap to Reveal · {field === "email" ? formatCreditsLabel(CONTACTOUT_EMAIL_COST) : formatCreditsLabel(CONTACTOUT_PHONE_COST)}
                            </Button>
                            {/* Waterfall enrichment icon */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ml-1 ${iconColorClass}`}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('[Zap] clicked', { companyId, field, hasHandler: !!onEnrichReveal })
                                    onEnrichReveal?.(companyId, field)
                                }}
                                title={`Waterfall zap: ${formatCreditsLabel(waterfallCredits)}${waterfallValue ? "" : attemptedWaterfall ? " · retry waterfall" : ""}`}
                            >
                            <Zap className="h-3 w-3" />
                        </Button>
                        </>
                    )
                )}

                {/* Offer re-enrich option when contact data already present */}
                {contactValue && !waterfallValue && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600"
                        onClick={(e) => {
                            e.stopPropagation()
                            onEnrichReveal?.(companyId, field)
                        }}
                        title="Enrich with waterfall (BetterContact)"
                    >
                        <Zap className="h-3 w-3" />
                    </Button>
                )}

                {/* Enrichment loading state */}
                {enrichData?.loading && (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Enriching...</span>
                    </div>
                )}
            </div>
        )
    }

    // Special renderers
    switch (column.key) {
        case 'name':
            return (
                <div className="flex items-center gap-3">
                    {company.logo_url ? (
                        <div className="h-8 w-8 rounded border bg-white flex-shrink-0 overflow-hidden relative">
                            <img
                                src={company.logo_url}
                                alt=""
                                className="object-contain w-full h-full"
                                onError={(e) => {
                                    (e.target as any).style.display = 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded border bg-muted flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[150px]">{company.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{company.domain}</span>
                        {typeof companyConfidence === 'number' && (
                            <span className="text-[10px] text-muted-foreground">
                                Confidence Score: {companyConfidence}%
                            </span>
                        )}
                    </div>
                </div>
            )

        case 'domain':
            return company.domain ? (
                <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1 text-xs"
                >
                    {company.domain}
                    <ExternalLink className="h-3 w-3" />
                </a>
            ) : 'N/A'

        case 'headquarters_address': {
            const addr = value || company.location_display || ""
            if (addr) return addr
            const parts = [company.street, company.headquarters_city, company.headquarters_state, company.zip_code].filter(Boolean)
            return parts.length > 0 ? parts.join(', ') : 'N/A'
        }

        case 'industry':
            return value ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex justify-start items-start">
                                <span className="text-xs truncate max-w-[150px] text-left block cursor-help hover:text-primary">
                                    {value}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-sm">{value}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : 'N/A'

        case 'revenue_exact':
            if (typeof value === 'number' && value !== 0) return <>{formatCurrency(value)}</>
            if (typeof value === 'string' && value.trim() && value !== 'N/A') return <>{value}</>
            return 'N/A'

        case 'funding_total':
        case 'market_cap':
        case 'last_raised_amount':
            return <>{formatCurrency(value)}</>

        case 'alexa_rank':
        case 'number_of_locations':
        case 'employee_count_exact':
            return <>{formatNumber(value)}</>

        case 'technologies':
            if (!value || !Array.isArray(value) || value.length === 0) return <>N/A</>
            return (
                <div className="flex flex-wrap gap-1 max-w-[200px] justify-start items-start">
                    {value.slice(0, 3).map((tech: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0 text-left">
                            {tech}
                        </Badge>
                    ))}
                    {value.length > 3 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                        +{value.length - 3}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{value.slice(3).join(', ')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )

        case 'investors':
        case 'locations':
            if (!value || !Array.isArray(value) || value.length === 0) {
                return typeof value === 'string' && value ? value : 'N/A'
            }
            return (
                <div className="flex flex-wrap gap-1 max-w-[200px] justify-start items-start">
                    {value.slice(0, 2).map((item: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0 truncate max-w-[100px] text-left block">
                            {item}
                        </Badge>
                    ))}
                    {value.length > 2 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                                        +{value.length - 2}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{value.slice(2).join(', ')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )
        case 'linkedin_url':
            return value ? (
                <a
                    href={value.startsWith('http') ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                >
                    LinkedIn
                    <ExternalLink className="h-3 w-3" />
                </a>
            ) : <>N/A</>

        case 'twitter_url':
        case 'facebook_url':
            return value ? (
                <a
                    href={value.startsWith('http') ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                >
                    <ExternalLink className="h-4 w-4" />
                </a>
            ) : <>N/A</>

        case 'employee_growth_6m':
        case 'employee_growth_12m':
        case 'employee_growth_6m_percent':
        case 'employee_growth_12m_percent':
            if (value === undefined || value === null) return <>N/A</>
            const growthClass = value >= 0 ? 'text-green-600' : 'text-red-600'
            return <span className={growthClass}>{formatPercent(value)}</span>

        case 'enriched':
            return value ? (
                <Badge variant="default" className="bg-green-500">Yes</Badge>
            ) : (
                <Badge variant="secondary">No</Badge>
            )

        case 'data_quality_score':
            if (value === undefined || value === null) return <>N/A</>
            const scoreClass = value >= 80 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'
            return <span className={scoreClass}>{value}/100</span>

        case 'created_at':
        case 'updated_at':
        case 'last_enriched_at':
        case 'last_funding_date':
            return <>{formatDate(value)}</>

        case 'description':
            return value ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <span className="truncate max-w-[250px] block">{value}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[400px]">
                            <p className="text-sm">{value}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : <>N/A</>

        case 'decision_makers_count':
        case 'locations_distribution_count':
            if (value === undefined || value === null || value === 0) return <>N/A</>
            return <span className="font-medium">{formatNumber(value)}</span>

        case 'is_tech_heavy':
            if (value === undefined || value === null) return <>N/A</>
            return value ? (
                <Badge variant="default" className="bg-blue-500">Yes</Badge>
            ) : (
                <Badge variant="secondary">No</Badge>
            )

        case 'id':
            return value ? (
                <span className="font-mono text-xs truncate max-w-[140px] block">{value}</span>
            ) : <>N/A</>

        default:
            if (value === undefined || value === null || value === '') return <>N/A</>
            if (typeof value === 'object' && !Array.isArray(value)) {
                return <>{JSON.stringify(value)}</>
            }
            if (Array.isArray(value)) {
                return <>{value.join(', ')}</>
            }
            return <>{String(value)}</>
    }
}

export function CompaniesResultsTable({
    companies = [],
    isLoading,
    hasSearched,
    onEnrichReveal,
    enrichCache = {},
    waterfallAttempts = {},
}: CompaniesResultsTableProps) {
    const router = useRouter()
    const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 25

    console.log('Complex CompaniesResultsTable called with:', { companies: companies.length, isLoading, hasSearched, enrichCache })

    const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns])

    const paginatedCompanies = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return companies.slice(start, start + itemsPerPage)
    }, [companies, currentPage])

    const totalPages = Math.ceil(companies.length / itemsPerPage)

    const toggleColumn = (key: string) => {
        setColumns(prev => prev.map(col =>
            col.key === key ? { ...col, visible: !col.visible } : col
        ))
    }

    const toggleCategoryColumns = (category: ColumnConfig['category'], visible: boolean) => {
        setColumns(prev => prev.map(col =>
            col.category === category ? { ...col, visible } : col
        ))
    }

    const [contactCache, setContactCache] = useState<Record<string, ContactCacheEntry>>({})

    const sanitizeEmails = (values: any[]): string[] =>
        values
            .filter((v) => typeof v === "string" && v.includes("@"))
            .map((v) => (v as string).trim())
            .filter((v) => {
                const low = v.toLowerCase()
                if (!v) return false
                const [localPart = "", domainPart = ""] = low.split("@")
                if (low.endsWith("@example.com") || low.includes("test@")) return false
                if (/^email\d+$/.test(localPart)) return false
                if (/^(test|demo|sample)\d*$/.test(localPart)) return false
                if (domainPart === "gmail.com" && (/^email\d+$/.test(localPart) || /^test\d*$/.test(localPart))) return false
                return true
            })

    const sanitizePhones = (values: any[]): string[] =>
        values
            .filter((v) => typeof v === "string" && v.trim().length > 0)
            .map((v) => (v as string).trim())
            .filter((v) => {
                const low = v.toLowerCase()
                if (low.includes("phone number")) return false
                const digits = v.replace(/\D/g, "")
                return digits.length >= 6
            })

    const handleContactReveal = async (company: CompanyData, field: 'email' | 'phone') => {
        const linkedinUrl = company.linkedin_url
        const isCompanyPage = !linkedinUrl || linkedinUrl.includes('/company/') || linkedinUrl.includes('/school/')

        // For company pages, we need a domain to use the decision-makers API
        if (isCompanyPage && !company.domain) {
            console.warn('No domain available to reveal company contact')
            return
        }
        // For personal profiles, we need a LinkedIn URL
        if (!isCompanyPage && !linkedinUrl) return

        const revealKey = `${company.id}-${field}`

        setContactCache(prev => ({
            ...prev,
            [revealKey]: {
                ...prev[revealKey],
                loadingEmail: field === 'email',
                loadingPhone: field === 'phone',
            },
        }))

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            }

            let response: Response
            if (isCompanyPage) {
                // Use decision-makers API for company pages
                response = await fetch('/api/contactout/reveal-company-contact', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        domain: company.domain,
                        include_phone: field === 'phone',
                    }),
                })
            } else {
                // Use personal profile reveal for individual LinkedIn URLs
                response = await fetch('/api/contactout/reveal-contact', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        linkedin_url: linkedinUrl,
                        include_phone: field === 'phone',
                    }),
                })
            }

            if (!response.ok) throw new Error('ContactOut reveal failed')

            const payload = await response.json()
            const data = payload?.data || payload
            const values = field === 'email'
                ? (Array.isArray(data?.emails) ? data.emails : [])
                : (Array.isArray(data?.phones) ? data.phones : [])
            const sanitized = field === 'email' ? sanitizeEmails(values) : sanitizePhones(values)

            setContactCache(prev => ({
                ...prev,
                [revealKey]: {
                    ...prev[revealKey],
                    emails: field === 'email' ? sanitized : prev[revealKey]?.emails,
                    phones: field === 'phone' ? sanitized : prev[revealKey]?.phones,
                    loadingEmail: false,
                    loadingPhone: false,
                },
            }))
        } catch {
            setContactCache(prev => ({
                ...prev,
                [revealKey]: {
                    ...prev[revealKey],
                    loadingEmail: field === 'email' ? false : prev[revealKey]?.loadingEmail,
                    loadingPhone: field === 'phone' ? false : prev[revealKey]?.loadingPhone,
                },
            }))
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <Card className="p-6">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </Card>
        )
    }

    // Empty state - no search performed yet
    if (!hasSearched) {
        return (
            <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 p-8 max-w-md mx-auto">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Search className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Start your company search</h3>
                    <p className="text-muted-foreground">
                        Use the filters on the left to specify your target audience, then click "Search Companies" to find matching results.
                    </p>
                </div>
            </Card>
        )
    }

    // Empty state - search performed but no results
    if (companies.length === 0) {
        return (
            <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 p-8 max-w-md mx-auto">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">No companies found</h3>
                    <p className="text-muted-foreground">
                        Try adjusting your filters to find more results.
                    </p>
                </div>
            </Card>
        )
    }

    // Results table with dynamic columns
    return (
        <Card className="p-0 border-border/60 shadow-sm overflow-hidden flex flex-col">
            {/* Header with controls */}
            <div className="p-4 border-b border-border/40 bg-muted/30 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground/80">
                    {companies.length} companies found
                </h3>
                <div className="flex items-center gap-2">
                    {/* Column visibility dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                                <Columns3 className="h-4 w-4 mr-2" />
                                Columns ({visibleColumns.length})
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px] max-h-[500px] overflow-y-auto">
                            <div className="flex items-center justify-between p-2 sticky top-0 bg-popover z-10 border-b">
                                <span className="font-semibold text-sm">Toggle Columns</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                                    onClick={() => setColumns(cols => cols.map(c => ({ ...c, visible: false })))}
                                >
                                    Clear All
                                </Button>
                            </div>

                            {(['basic', 'firmographic', 'location', 'funding', 'metrics', 'metadata'] as const).map((category) => {
                                const categoryColumns = columns.filter(c => c.category === category)
                                const allVisible = categoryColumns.every(c => c.visible)
                                const label = category.charAt(0).toUpperCase() + category.slice(1)

                                return (
                                    <div key={category} className="py-1">
                                        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
                                            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 text-[10px] px-2 h-auto py-0.5"
                                                onClick={() => toggleCategoryColumns(category, !allVisible)}
                                            >
                                                {allVisible ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </div>
                                        {categoryColumns.map(col => (
                                            <DropdownMenuCheckboxItem
                                                key={col.key}
                                                checked={col.visible}
                                                onCheckedChange={() => toggleColumn(col.key)}
                                                className="pl-8"
                                            >
                                                {col.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                    </div>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Export button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                            if (companies.length === 0) return

                            // Prepare CSV data
                            const headers = visibleColumns.map(c => c.label).join(',')
                            const rows = companies.map(company => visibleColumns.map(col => {
                                let val = (company as any)[col.key]

                                // Clean value for CSV
                                if (val === null || val === undefined) val = ''
                                if (typeof val === 'object') val = JSON.stringify(val)
                                val = String(val).replace(/"/g, '""') // Escape quotes

                                return `"${val}"`
                            }).join(','))

                            const csvContent = [headers, ...rows].join('\n')
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                            const url = URL.createObjectURL(blob)
                            const link = document.createElement('a')
                            link.setAttribute('href', url)
                            link.setAttribute('download', `companies_export_${new Date().toISOString().split('T')[0]}.csv`)
                            link.style.visibility = 'hidden'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                        }}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Scrollable table */}
            <ScrollArea className="flex-1 max-h-[600px]">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            {visibleColumns.map(col => (
                                <TableHead
                                    key={col.key}
                                    style={{ minWidth: col.width }}
                                    className="bg-muted/50"
                                >
                                    {col.label}
                                </TableHead>
                            ))}
                            <TableHead className="text-right bg-muted/50 sticky right-0">Profile</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedCompanies.map((company) => (
                            <TableRow key={company.id} className="hover:bg-muted/50">
                                {visibleColumns.map(col => (
                                    <TableCell key={`${company.id}-${col.key}`}>
                                        <RenderCell
                                            column={col}
                                            company={company}
                                            enrichData={enrichCache[company.domain || company.id]}
                                            onEnrichReveal={onEnrichReveal}
                                            contactCache={contactCache}
                                            onContactReveal={handleContactReveal}
                                            waterfallAttempts={waterfallAttempts}
                                        />
                                    </TableCell>
                                ))}
                                <TableCell className="text-right sticky right-0 bg-background">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                        onClick={() => {
                                            router.push(`/leads/companies/${company.domain}`)
                                        }}
                                    >
                                        <Building2 className="h-4 w-4 mr-2" />
                                        Profile
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-border/40 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, companies.length)} of {companies.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    )
}
