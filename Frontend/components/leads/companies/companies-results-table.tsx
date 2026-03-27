"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    ExternalLink,
    Building2,
    Search,
    Loader2,
    Zap,
    Lock,
    Sparkles,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { DataTable } from "@/components/leads/data-table/data-table"
import { PaginationControls } from "@/components/leads/data-table/pagination-controls"
import { TableToolbar } from "@/components/leads/data-table/table-toolbar"
import { BulkActionBar } from "@/components/leads/data-table/bulk-action-bar"
import { useTableState, type ColumnDef } from "@/hooks/use-table-state"
import { useCopilotPanelStore } from "@/hooks/use-copilot-panel"

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
    name: string
    domain: string
    website?: string
    description?: string
    logo_url?: string
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
    headquarters_country?: string
    headquarters_state?: string
    headquarters_city?: string
    headquarters_address?: string
    street?: string
    zip_code?: string
    location_display?: string
    locations?: string[]
    locations_distribution_count?: number
    phone?: string
    email?: string
    personal_email?: string
    work_email?: string
    technologies?: string[]
    funding_stage?: string
    funding_total?: number
    last_funding_date?: string
    has_recent_funding?: boolean
    investors_count?: number
    investors?: string | string[]
    last_raised_amount?: number
    linkedin_url?: string
    twitter_url?: string
    facebook_url?: string
    instagram_url?: string
    follower_count?: number
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

type ContactCacheEntry = {
    emails?: string[]
    phones?: string[]
    loadingEmail?: boolean
    loadingPhone?: boolean
    attemptedEmail?: boolean
    attemptedPhone?: boolean
}

interface CompaniesResultsTableProps {
    tableId?: string
    companies: CompanyData[]
    isLoading: boolean
    hasSearched: boolean
    onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => void
    enrichCache?: Record<string, { email?: string; phone?: string; contact_name?: string; contact_title?: string; loading?: boolean }>
    enrichingRows?: Record<string, boolean>
    onWaterfallResult?: (companyId: string, field: 'email' | 'phone', result: Record<string, any>) => void
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

// Contact cell renderer (extracted from old RenderCell)
function ContactCell({
    company,
    field,
    enrichData,
    onEnrichReveal,
    contactCache,
    onContactReveal,
    waterfallAttempts,
    enrichingRows,
}: {
    company: CompanyData
    field: 'email' | 'phone'
    enrichData?: { email?: string; phone?: string; contact_name?: string; contact_title?: string; loading?: boolean }
    onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => void
    contactCache: Record<string, ContactCacheEntry>
    onContactReveal?: (company: CompanyData, field: 'email' | 'phone') => Promise<void>
    waterfallAttempts?: Record<string, { email?: boolean; phone?: boolean }>
    enrichingRows?: Record<string, boolean>
}) {
    const isPhoneCol = field === 'phone'
    const isEmailCol = field === 'email'
    const value = isPhoneCol ? company.phone : company.email
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
            ? ((waterfallField as any).email || (waterfallField as any).phone || (waterfallField as any).value || '')
            : String(waterfallField)
        : undefined
    const waterfallCredits = typeof waterfallField === 'object' ? (waterfallField as any).credits_consumed : undefined
    const contactAttempted = isEmailCol ? cacheEntry.attemptedEmail : cacheEntry.attemptedPhone
    const showRevealControls = !waterfallValue && !contactValue && !isLoadingContact && !enrichData?.loading
    const attemptRecord = waterfallAttempts?.[companyId] || {}
    const attemptedWaterfall = isPhoneCol ? attemptRecord.phone : attemptRecord.email
    const attemptMessage = isEmailCol ? "Email not available" : "Phone not available"
    const isEnriching = Boolean(enrichingRows?.[companyId]) || Boolean(enrichData?.loading)
    const iconColorClass = waterfallValue
        ? "text-emerald-500 hover:text-emerald-600"
        : attemptedWaterfall
            ? "text-orange-500 hover:text-orange-600"
            : "text-blue-500 hover:text-blue-600"

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {fallbackValue && !waterfallValue && !contactValue && (
                <div className="flex items-center gap-2">
                    <span className="text-xs">{fallbackValue}</span>
                    <div className="text-xs text-green-600 font-medium">✓ Company</div>
                </div>
            )}
            {contactValue && !waterfallValue && (
                <div className="flex items-center gap-2">
                    <span className="text-xs break-all">{contactValue}</span>
                    <div className="text-xs text-green-600 font-medium">✓ Verified</div>
                </div>
            )}
            {typeof waterfallValue !== 'undefined' && (
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${!waterfallValue ? 'text-muted-foreground italic' : ''}`}>
                        {waterfallValue || 'Not available'}
                    </span>
                    <div className="text-xs text-green-600 font-medium">✓ Enriched</div>
                </div>
            )}
            {isLoadingContact && (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs text-muted-foreground">Revealing...</span>
                </div>
            )}
            {isEnriching && !waterfallValue && !contactValue && (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-xs text-muted-foreground">Enriching...</span>
                </div>
            )}
            {showRevealControls && !isEnriching && (
                contactAttempted ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{attemptMessage}</span>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px]"
                            onClick={async (e) => { e.stopPropagation(); await onContactReveal?.(company, field) }}
                            disabled={!company.linkedin_url && !company.domain}
                        >
                            <Lock className="h-3 w-3 mr-1" /> Reveal again
                        </Button>
                        <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ml-1 ${iconColorClass}`}
                            onClick={(e) => { e.stopPropagation(); onEnrichReveal?.(companyId, field) }}
                            disabled={isEnriching}
                            title={`Advanced enrichment: ${formatCreditsLabel(waterfallCredits)}${waterfallValue ? "" : attemptedWaterfall ? " · retry" : ""}`}
                        >
                            <Zap className="h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <Button variant="secondary" size="sm" className="h-7 text-[11px]"
                            onClick={async (e) => { e.stopPropagation(); await onContactReveal?.(company, field) }}
                            disabled={!company.linkedin_url && !company.domain}
                        >
                            <Lock className="h-3 w-3 mr-1" />
                            Tap to Reveal · {field === "email" ? formatCreditsLabel(CONTACTOUT_EMAIL_COST) : formatCreditsLabel(CONTACTOUT_PHONE_COST)}
                        </Button>
                        <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ml-1 ${iconColorClass}`}
                            onClick={(e) => { e.stopPropagation(); onEnrichReveal?.(companyId, field) }}
                            disabled={isEnriching}
                            title={`Advanced enrichment: ${formatCreditsLabel(waterfallCredits)}${waterfallValue ? "" : attemptedWaterfall ? " · retry" : ""}`}
                        >
                            <Zap className="h-3 w-3" />
                        </Button>
                    </>
                )
            )}
            {contactValue && !waterfallValue && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600"
                    onClick={(e) => { e.stopPropagation(); onEnrichReveal?.(companyId, field) }}
                    disabled={isEnriching}
                    title="Advanced enrichment"
                >
                    <Zap className="h-3 w-3" />
                </Button>
            )}
        </div>
    )
}

export function CompaniesResultsTable({
    tableId = "companies",
    companies = [],
    isLoading,
    hasSearched,
    onEnrichReveal,
    enrichCache = {},
    enrichingRows = {},
    onWaterfallResult,
    waterfallAttempts = {},
}: CompaniesResultsTableProps) {
    const router = useRouter()
    const { openPanel } = useCopilotPanelStore()
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
        if (isCompanyPage && !company.domain) return
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
                response = await fetch('/api/contactout/reveal-company-contact', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ domain: company.domain, include_phone: field === 'phone' }),
                })
            } else {
                response = await fetch('/api/contactout/reveal-contact', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ linkedin_url: linkedinUrl, include_phone: field === 'phone' }),
                })
            }

            if (!response.ok) throw new Error('ContactOut reveal failed')

            const payload = await response.json()
            const data = payload?.data || payload
            const values = field === 'email'
                ? (Array.isArray(data?.emails) ? data.emails : [])
                : (Array.isArray(data?.phones) ? data.phones : [])
            let sanitized = field === 'email' ? sanitizeEmails(values) : sanitizePhones(values)

            // CrustData email fallback when ContactOut returned nothing
            if (sanitized.length === 0 && field === 'email' && company.linkedin_url) {
                try {
                    const crustRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/crustdata/person/enrich`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ linkedin_profile_url: company.linkedin_url }),
                    })
                    if (crustRes.ok) {
                        const crustData = await crustRes.json()
                        const crustEmails = sanitizeEmails(
                            Array.isArray(crustData?.business_email) ? crustData.business_email : []
                        )
                        if (crustEmails.length > 0) {
                            sanitized = crustEmails
                        }
                    }
                } catch { /* CrustData fallback failed silently */ }
            }

            setContactCache(prev => ({
                ...prev,
                [revealKey]: {
                    ...prev[revealKey],
                    emails: field === 'email' ? sanitized : prev[revealKey]?.emails,
                    phones: field === 'phone' ? sanitized : prev[revealKey]?.phones,
                    loadingEmail: false,
                    loadingPhone: false,
                    attemptedEmail: field === 'email' ? true : prev[revealKey]?.attemptedEmail,
                    attemptedPhone: field === 'phone' ? true : prev[revealKey]?.attemptedPhone,
                },
            }))
        } catch {
            setContactCache(prev => ({
                ...prev,
                [revealKey]: {
                    ...prev[revealKey],
                    loadingEmail: field === 'email' ? false : prev[revealKey]?.loadingEmail,
                    loadingPhone: field === 'phone' ? false : prev[revealKey]?.loadingPhone,
                    attemptedEmail: field === 'email' ? true : prev[revealKey]?.attemptedEmail,
                    attemptedPhone: field === 'phone' ? true : prev[revealKey]?.attemptedPhone,
                },
            }))
        }
    }

    const openCompanyCopilot = (company: CompanyData) => {
        const hqParts = [
            company.headquarters_city,
            company.headquarters_state,
            company.headquarters_country,
        ].filter(Boolean)
        openPanel({
            entity_type: "company",
            copilot_id: company.id || company.domain || company.name,
            id: company.id || company.domain,
            name: company.name,
            company: company.name,
            domain: company.domain,
            industry: company.industry || company.linkedin_industry_category,
            employee_count_exact: company.employee_count_exact,
            employee_count_range: company.employee_count_range,
            revenue_range: company.revenue_range,
            revenue_exact: company.revenue_exact,
            funding_stage: company.funding_stage,
            funding_total: company.funding_total,
            technologies: company.technologies || [],
            headquarters: company.location_display || company.headquarters_address || hqParts.join(", "),
            linkedin_url: company.linkedin_url,
            email: company.email,
            phone: company.phone,
        })
    }

    // Build column definitions with renderers
    const columns: ColumnDef<CompanyData>[] = useMemo(() => [
        {
            key: 'name', label: 'Company', defaultVisible: true, width: '200px', category: 'basic', sortable: true,
            render: (_v, company) => {
                const companyConfidence = typeof company.data_quality_score === 'number'
                    ? Math.max(0, Math.min(100, Math.round(company.data_quality_score))) : undefined
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded border bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                            {company.logo_url ? (
                                <img 
                                    src={company.logo_url} 
                                    alt="" 
                                    className="object-contain w-full h-full absolute inset-0 z-10 bg-white"
                                    onError={(e) => { (e.target as any).style.display = 'none' }} 
                                />
                            ) : null}
                            <span className="font-semibold text-xs text-muted-foreground">
                                {(company.name || company.domain || "C").charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[150px]">{company.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{company.domain}</span>
                            {typeof companyConfidence === 'number' && (
                                <span className="text-[10px] text-muted-foreground">Confidence Score: {companyConfidence}%</span>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            key: 'domain', label: 'Domain', defaultVisible: true, width: '150px', category: 'basic', sortable: true,
            render: (_v, company) => company.domain ? (
                <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1 text-xs">
                    {company.domain} <ExternalLink className="h-3 w-3" />
                </a>
            ) : <>N/A</>,
        },
        {
            key: 'industry', label: 'Industry', defaultVisible: true, width: '180px', category: 'basic', sortable: true,
            render: (value) => value ? (
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <div className="flex justify-start items-start">
                        <span className="text-xs truncate max-w-[150px] text-left block cursor-help hover:text-primary">{value}</span>
                    </div>
                </TooltipTrigger><TooltipContent><p className="text-sm">{value}</p></TooltipContent></Tooltip></TooltipProvider>
            ) : <>N/A</>,
        },
        { key: 'employee_count_exact', label: 'Employees', defaultVisible: false, width: '100px', category: 'firmographic', sortable: true, render: (v) => <>{formatNumber(v)}</> },
        { key: 'employee_count_range', label: 'Emp. Range', defaultVisible: true, width: '100px', category: 'firmographic', sortable: true },
        {
            key: 'revenue_exact', label: 'Revenue', defaultVisible: true, width: '120px', category: 'firmographic', sortable: true,
            render: (value) => {
                if (typeof value === 'number' && value !== 0) return <>{formatCurrency(value)}</>
                if (typeof value === 'string' && value.trim() && value !== 'N/A') return <>{value}</>
                return <>N/A</>
            },
        },
        { key: 'revenue_range', label: 'Rev. Range', defaultVisible: false, width: '100px', category: 'firmographic', sortable: true },
        { key: 'company_type', label: 'Type', defaultVisible: false, width: '100px', category: 'firmographic', sortable: true },
        { key: 'founded_year', label: 'Founded', defaultVisible: false, width: '80px', category: 'firmographic', sortable: true },
        { key: 'linkedin_industry_category', label: 'Social Industry', defaultVisible: false, width: '150px', category: 'firmographic', sortable: true },
        { key: 'headquarters_country', label: 'Country', defaultVisible: false, width: '120px', category: 'location', sortable: true },
        { key: 'headquarters_state', label: 'State', defaultVisible: false, width: '120px', category: 'location', sortable: true },
        { key: 'headquarters_city', label: 'City', defaultVisible: false, width: '120px', category: 'location', sortable: true },
        {
            key: 'headquarters_address', label: 'Address', defaultVisible: true, width: '200px', category: 'location', sortable: false,
            render: (value, company) => {
                const addr = value || company.location_display || ""
                if (addr) return <>{addr}</>
                const parts = [company.street, company.headquarters_city, company.headquarters_state, company.zip_code].filter(Boolean)
                return parts.length > 0 ? <>{parts.join(', ')}</> : <>N/A</>
            },
        },
        { key: 'zip_code', label: 'Zip', defaultVisible: false, width: '80px', category: 'location', sortable: true },
        {
            key: 'locations', label: 'Locations', defaultVisible: false, width: '150px', category: 'location', sortable: false,
            render: (value) => {
                if (!value || !Array.isArray(value) || value.length === 0) return typeof value === 'string' && value ? <>{value}</> : <>N/A</>
                return (
                    <div className="flex flex-wrap gap-1 max-w-[200px] justify-start items-start">
                        {value.slice(0, 2).map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0 truncate max-w-[100px] text-left block">{item}</Badge>
                        ))}
                        {value.length > 2 && (
                            <TooltipProvider><Tooltip><TooltipTrigger><Badge variant="outline" className="text-xs px-1.5 py-0">+{value.length - 2}</Badge></TooltipTrigger>
                            <TooltipContent><p>{value.slice(2).join(', ')}</p></TooltipContent></Tooltip></TooltipProvider>
                        )}
                    </div>
                )
            },
        },
        { key: 'locations_distribution_count', label: '#Locations', defaultVisible: false, width: '100px', category: 'location', sortable: true, render: (v) => (v === undefined || v === null || v === 0) ? <>N/A</> : <span className="font-medium">{formatNumber(v)}</span> },
        {
            key: 'email', label: 'Email', defaultVisible: true, width: '240px', category: 'location', sortable: false,
            render: (_v, company) => (
                <ContactCell company={company} field="email" enrichData={enrichCache[company.domain || company.id]}
                    onEnrichReveal={onEnrichReveal} contactCache={contactCache} onContactReveal={handleContactReveal} waterfallAttempts={waterfallAttempts}
                    enrichingRows={enrichingRows} />
            ),
        },
        {
            key: 'phone', label: 'Phone', defaultVisible: true, width: '220px', category: 'location', sortable: false,
            render: (_v, company) => (
                <ContactCell company={company} field="phone" enrichData={enrichCache[company.domain || company.id]}
                    onEnrichReveal={onEnrichReveal} contactCache={contactCache} onContactReveal={handleContactReveal} waterfallAttempts={waterfallAttempts}
                    enrichingRows={enrichingRows} />
            ),
        },
        {
            key: 'linkedin_url', label: 'Social', defaultVisible: true, width: '100px', category: 'social', sortable: false,
            render: (value) => value ? (
                <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                    Social <ExternalLink className="h-3 w-3" />
                </a>
            ) : <>N/A</>,
        },
        { key: 'funding_stage', label: 'Funding Stage', defaultVisible: false, width: '120px', category: 'funding', sortable: true },
        { key: 'funding_total', label: 'Total Funding', defaultVisible: false, width: '120px', category: 'funding', sortable: true, render: (v) => <>{formatCurrency(v)}</> },
        { key: 'last_funding_date', label: 'Last Funding', defaultVisible: false, width: '110px', category: 'funding', sortable: true, render: (v) => <>{formatDate(v)}</> },
        {
            key: 'investors', label: 'Investors', defaultVisible: false, width: '250px', category: 'funding', sortable: false,
            render: (value) => {
                if (!value || !Array.isArray(value) || value.length === 0) return typeof value === 'string' && value ? <>{value}</> : <>N/A</>
                return (
                    <div className="flex flex-wrap gap-1 max-w-[200px] justify-start items-start">
                        {value.slice(0, 2).map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0 truncate max-w-[100px] text-left block">{item}</Badge>
                        ))}
                        {value.length > 2 && (
                            <TooltipProvider><Tooltip><TooltipTrigger><Badge variant="outline" className="text-xs px-1.5 py-0">+{value.length - 2}</Badge></TooltipTrigger>
                            <TooltipContent><p>{value.slice(2).join(', ')}</p></TooltipContent></Tooltip></TooltipProvider>
                        )}
                    </div>
                )
            },
        },
        { key: 'investors_count', label: 'Investors Count', defaultVisible: false, width: '100px', category: 'funding', sortable: true },
        {
            key: 'technologies', label: 'Technologies', defaultVisible: false, width: '200px', category: 'metrics', sortable: false,
            render: (value) => {
                if (!value || !Array.isArray(value) || value.length === 0) return <>N/A</>
                return (
                    <div className="flex flex-wrap gap-1 max-w-[200px] justify-start items-start">
                        {value.slice(0, 3).map((tech: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0 text-left">{tech}</Badge>
                        ))}
                        {value.length > 3 && (
                            <TooltipProvider><Tooltip><TooltipTrigger><Badge variant="secondary" className="text-xs px-1.5 py-0">+{value.length - 3}</Badge></TooltipTrigger>
                            <TooltipContent><p>{value.slice(3).join(', ')}</p></TooltipContent></Tooltip></TooltipProvider>
                        )}
                    </div>
                )
            },
        },
        { key: 'decision_makers_count', label: 'Decision Makers', defaultVisible: false, width: '120px', category: 'metrics', sortable: true, render: (v) => (v === undefined || v === null || v === 0) ? <>N/A</> : <span className="font-medium">{formatNumber(v)}</span> },
        {
            key: 'is_tech_heavy', label: 'Tech Heavy', defaultVisible: false, width: '100px', category: 'metrics', sortable: true,
            render: (value) => {
                if (value === undefined || value === null) return <>N/A</>
                return value ? <Badge variant="default" className="bg-blue-500">Yes</Badge> : <Badge variant="secondary">No</Badge>
            },
        },
        { key: 'data_quality_score', label: 'Quality Score', defaultVisible: false, width: '100px', category: 'metrics', sortable: true, render: (v) => {
            if (v === undefined || v === null) return <>N/A</>
            const scoreClass = v >= 80 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-600'
            return <span className={scoreClass}>{v}/100</span>
        }},
        { key: 'id', label: 'Business ID', defaultVisible: false, width: '150px', category: 'metadata', sortable: false, render: (v) => v ? <span className="font-mono text-xs truncate max-w-[140px] block">{v}</span> : <>N/A</> },
        {
            key: 'enriched', label: 'Enriched', defaultVisible: false, width: '80px', category: 'metadata', sortable: true,
            render: (value) => value ? <Badge variant="default" className="bg-green-500">Yes</Badge> : <Badge variant="secondary">No</Badge>,
        },
    ], [enrichCache, onEnrichReveal, contactCache, waterfallAttempts, enrichingRows]) // eslint-disable-line react-hooks/exhaustive-deps

    const getRowId = useCallback((row: CompanyData, _idx: number) => row.id || row.domain || String(_idx), [])

    const table = useTableState({
        tableId,
        data: companies,
        columns,
        defaultPageSize: 25,
        getRowId,
    })

    // Export handler
    const handleExport = useCallback((rows: CompanyData[]) => {
        if (rows.length === 0) return
        const headers = table.visibleColumns.map(c => c.label).join(',')
        const csvRows = rows.map(company =>
            table.visibleColumns.map(col => {
                let val = (company as any)[col.key]
                if (val === null || val === undefined) val = ''
                if (typeof val === 'object') val = JSON.stringify(val)
                val = String(val).replace(/"/g, '""')
                return `"${val}"`
            }).join(',')
        )
        const csvContent = [headers, ...csvRows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `companies_export_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [table.visibleColumns])

    // Loading state
    if (isLoading) {
        return (
            <Card className="p-6">
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            </Card>
        )
    }

    // Empty state - no search yet
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

    // Empty state - no results
    if (companies.length === 0) {
        return (
            <Card className="flex-1 p-0 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 p-8 max-w-md mx-auto">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">No companies found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters to find more results.</p>
                </div>
            </Card>
        )
    }

    return (
        <Card className="p-0 border-border/60 shadow-sm overflow-hidden flex flex-col">
            <TableToolbar
                tableId="companies"
                columns={columns}
                visibility={table.visibility}
                onToggleColumn={table.toggleColumn}
                onSetVisibility={table.setAllColumnsVisibility}
                totalRows={table.totalRows}
                onExport={() => handleExport(companies)}
            />

            <DataTable
                data={table.paginatedData}
                columns={columns}
                visibleColumns={table.visibleColumns}
                sort={table.sort}
                onSort={table.handleSort}
                selectedRows={table.selectedRows}
                onToggleRow={table.toggleRow}
                onToggleAll={table.toggleAll}
                isAllSelected={table.isAllSelected}
                isSomeSelected={table.isSomeSelected}
                getRowId={getRowId}
                pageOffset={(table.page - 1) * table.pageSize}
                renderActions={(company) => (
                    <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-600"
                            onClick={() => openCompanyCopilot(company)} title="Open AI Copilot">
                            <Sparkles className="h-4 w-4" /><span className="sr-only">AI Copilot</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                                // Dynamic import of searchCache to avoid circular dependencies if any
                                import("@/lib/cache/search-cache").then(({ searchCache }) => {
                                    searchCache.set([company]);
                                    router.push(`/leads/companies/${company.domain}`);
                                });
                            }}>
                            <Building2 className="h-4 w-4 mr-2" /> Profile
                        </Button>
                    </div>
                )}
            />

            {table.totalPages > 1 && (
                <PaginationControls
                    page={table.page}
                    totalPages={table.totalPages}
                    pageSize={table.pageSize}
                    totalRows={table.totalRows}
                    onPageChange={table.setPage}
                    onPageSizeChange={table.setPageSize}
                />
            )}

            {table.selectedRows.size > 0 && (
                <BulkActionBar
                    selectedCount={table.selectedRows.size}
                    onClearSelection={table.clearSelection}
                    onExportSelected={() => handleExport(table.selectedData)}
                    onEnrichAll={onEnrichReveal ? () => {
                        table.selectedData.forEach(c => {
                            const key = c.domain || c.id
                            onEnrichReveal(key, 'email')
                        })
                    } : undefined}
                />
            )}
        </Card>
    )
}
