"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eye, Linkedin, Loader2, Lock, Sparkles, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProspectProfile } from "@/lib/services/prospectService"
import { getInitials } from "@/lib/services/prospectService"
import { useCopilotPanelStore } from "@/hooks/use-copilot-panel"
import { DataTable } from "@/components/leads/data-table/data-table"
import { PaginationControls } from "@/components/leads/data-table/pagination-controls"
import { TableToolbar } from "@/components/leads/data-table/table-toolbar"
import { BulkActionBar } from "@/components/leads/data-table/bulk-action-bar"
import { useTableState, type ColumnDef } from "@/hooks/use-table-state"

const CONTACTOUT_EMAIL_COST = 1
const CONTACTOUT_PHONE_COST = 1
const formatCreditsLabel = (value?: number, fallback = "~1 credit") => {
    if (typeof value === "number") return `${value} credit${value === 1 ? "" : "s"}`
    return fallback
}

interface ProspectsResultsTableProps {
    profiles?: ProspectProfile[]
    data?: ProspectProfile[]
    isLoading?: boolean
    totalCount?: number
    hasMore?: boolean
    onLoadMore?: () => void
    isLoadingMore?: boolean
    enableContactReveal?: boolean
    onEnrichReveal?: (profile: ProspectProfile, field: 'email' | 'phone') => void
    onWaterfallResult?: (linkedinUrl: string, field: 'email' | 'phone', result: any) => void
    enrichCache?: Record<string, { email?: any, phone?: any }>
    enrichingRows?: Record<string, boolean>
    tableId?: string
}

// ── Utility functions (preserved from original) ──

const asText = (value: unknown) => (typeof value === "string" ? value : "")
const parseYears = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
    if (typeof value === "string" && value.trim()) {
        const raw = value.trim().toLowerCase()
        const match = raw.match(/(\d+(\.\d+)?)/)
        const num = Number(match?.[1] ?? "")
        if (Number.isFinite(num)) return Math.max(0, num)
    }
    return 0
}

const formatExperienceFromYears = (years: number): string => {
    if (!Number.isFinite(years) || years <= 0) return "N/A"
    const rounded = Math.floor(years)
    return rounded <= 1 ? "1 year" : `${rounded} years`
}

const getExperienceLabel = (profile: ProspectProfile): string => {
    const raw = ((profile as any).raw_data && typeof (profile as any).raw_data === "object")
        ? (profile as any).raw_data
        : (((profile as any).rawData && typeof (profile as any).rawData === "object") ? (profile as any).rawData : {})
    const directLabel = asText((profile as any).years_of_experience || raw?.years_of_experience).trim()
    if (directLabel && directLabel.toLowerCase() !== "n/a") return directLabel
    const directRaw = parseYears((profile as any).years_of_experience_raw ?? raw?.years_of_experience_raw)
    if (directRaw > 0) return formatExperienceFromYears(directRaw)
    const employers = [
        ...(Array.isArray((profile as any).current_employers) ? (profile as any).current_employers : []),
        ...(Array.isArray((profile as any).past_employers) ? (profile as any).past_employers : []),
        ...(Array.isArray((profile as any).employer) ? (profile as any).employer : []),
        ...(Array.isArray((profile as any).all_employers) ? (profile as any).all_employers : []),
        ...(Array.isArray(raw?.current_employers) ? raw.current_employers : []),
        ...(Array.isArray(raw?.past_employers) ? raw.past_employers : []),
        ...(Array.isArray(raw?.employer) ? raw.employer : []),
        ...(Array.isArray(raw?.all_employers) ? raw.all_employers : []),
    ]
    let total = 0
    for (const emp of employers) {
        const rawYears = parseYears(emp?.years_at_company_raw)
        if (rawYears > 0) { total += rawYears; continue }
        const labelYears = parseYears(emp?.years_at_company)
        if (labelYears > 0) total += labelYears
    }
    return formatExperienceFromYears(total)
}

const estimateExperienceYears = (profile: ProspectProfile): number => {
    const raw = ((profile as any).raw_data && typeof (profile as any).raw_data === "object")
        ? (profile as any).raw_data
        : (((profile as any).rawData && typeof (profile as any).rawData === "object") ? (profile as any).rawData : {})
    const employers = [
        ...(Array.isArray(profile.current_employers) ? profile.current_employers : []),
        ...(Array.isArray(profile.past_employers) ? profile.past_employers : []),
        ...(Array.isArray(raw?.current_employers) ? raw.current_employers : []),
        ...(Array.isArray(raw?.past_employers) ? raw.past_employers : []),
    ]
    let total = 0
    for (const emp of employers) {
        const rawYears = parseYears(emp?.years_at_company_raw)
        if (rawYears > 0) { total += rawYears; continue }
        const labelYears = parseYears(emp?.years_at_company)
        if (labelYears > 0) total += labelYears
    }
    return total
}

const computeConfidence = (profile: ProspectProfile): number => {
    const raw = (profile as any).raw_data ?? ((profile as any).rawData && typeof (profile as any).rawData === "object" ? (profile as any).rawData : {})
    const baseQuality = Number(profile.data_quality_score ?? raw?.quality_score ?? raw?.confidence ?? 50) || 50
    const experienceBoost = Math.min(10, estimateExperienceYears(profile) / 2)
    const connectionBoost = Math.min(10, (Number(profile.num_of_connections) || 0) / 500)
    const computed = (baseQuality * 0.7) + (experienceBoost * 2) + connectionBoost
    return Math.max(0, Math.min(100, Math.round(computed)))
}

const getStableId = (profile: ProspectProfile, idx: number): string => {
    return String(
        (profile as any).person_id ||
        (profile as any).linkedin_profile_urn ||
        profile.linkedin_profile_url ||
        profile.flagship_profile_url ||
        `${asText(profile.name) || "Unknown"}-${idx}`
    )
}

const normalizeStringValue = (value: any): string => {
    if (!value && value !== 0) return ""
    if (typeof value === "string") return value
    if (typeof value === "number") return String(value)
    if (typeof value === "object") {
        return String(value.email || value.value || value.address || value.work_email || value.personal_email || "")
    }
    return ""
}

const sanitizeEmails = (values: any[]): string[] =>
    values.map((v) => normalizeStringValue(v)).filter((v) => v.includes("@")).filter((v) => {
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
    values.map((v) => normalizeStringValue(v)).filter((v) => v.trim().length > 0).filter((v) => {
        const low = v.toLowerCase()
        if (low.includes("phone number")) return false
        const digits = v.replace(/\D/g, "")
        return digits.length >= 6
    })

const getExistingEmails = (profile: any): string[] => {
    const raw = (profile?.raw_data && typeof profile.raw_data === "object")
        ? profile.raw_data
        : ((profile?.rawData && typeof profile.rawData === "object") ? profile.rawData : {})
    const candidates: any[] = [
        ...(Array.isArray(profile?.emails) ? profile.emails : []),
        profile?.email, profile?.work_email, profile?.personal_email,
        ...(Array.isArray(profile?.contact_info?.emails) ? profile.contact_info.emails : []),
        ...(Array.isArray(profile?.contact_info?.work_emails) ? profile.contact_info.work_emails : []),
        ...(Array.isArray(profile?.contact_info?.personal_emails) ? profile.contact_info.personal_emails : []),
        ...(Array.isArray(raw?.emails) ? raw.emails : []),
        raw?.email, raw?.work_email, raw?.personal_email,
    ]
    return sanitizeEmails(candidates)
}

const getExistingPhones = (profile: any): string[] => {
    const raw = (profile?.raw_data && typeof profile.raw_data === "object")
        ? profile.raw_data
        : ((profile?.rawData && typeof profile.rawData === "object") ? profile.rawData : {})
    const candidates: any[] = [
        ...(Array.isArray(profile?.phones) ? profile.phones : []),
        profile?.phone,
        ...(Array.isArray(profile?.contact_info?.phones) ? profile.contact_info.phones : []),
        ...(Array.isArray(raw?.phones) ? raw.phones : []),
        raw?.phone,
    ]
    return sanitizePhones(candidates)
}

export function ProspectsResultsTable({
    profiles,
    data,
    isLoading,
    totalCount = 0,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false,
    enableContactReveal = false,
    onEnrichReveal,
    onWaterfallResult,
    enrichCache,
    enrichingRows,
    tableId = "prospects",
}: ProspectsResultsTableProps) {
    const actualProfiles = profiles || data || []
    const router = useRouter()
    const { openPanel } = useCopilotPanelStore()
    const [revealedEmail, setRevealedEmail] = useState<Record<string, boolean>>({})
    const [revealedPhone, setRevealedPhone] = useState<Record<string, boolean>>({})
    const [contactCache, setContactCache] = useState<Record<string, { emails: string[]; phones: string[]; loading?: boolean }>>({})

    const updateCacheEntry = (rowId: string, updates: Partial<{ emails: string[]; phones: string[]; loading?: boolean }>) => {
        setContactCache((prev) => {
            const existing = prev[rowId] || { emails: [], phones: [] }
            return { ...prev, [rowId]: { ...existing, ...updates } }
        })
    }

    const setCacheField = (rowId: string, field: "email" | "phone", values: string[], loading = false) => {
        const updates: Partial<{ emails: string[]; phones: string[]; loading?: boolean }> = { loading }
        if (field === "email") updates.emails = values
        else updates.phones = values
        updateCacheEntry(rowId, updates)
    }

    const revealContact = async (rowId: string, profile: ProspectProfile, field: "email" | "phone") => {
        if (!enableContactReveal) return
        const linkedinUrl = profile.flagship_profile_url || profile.linkedin_profile_url
        if (!linkedinUrl) return
        const existingValues = field === "email" ? getExistingEmails(profile as any) : getExistingPhones(profile as any)
        if (existingValues.length > 0) { setCacheField(rowId, field, existingValues, false); return }
        setCacheField(rowId, field, [], true)
        let fieldValues: string[] = []
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const response = await fetch(`""/api/v1/prospects/reveal-contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
                body: JSON.stringify({ linkedin_url: linkedinUrl }),
            })
            if (response.ok) {
                const payload = await response.json()
                fieldValues = field === "email"
                    ? sanitizeEmails(Array.isArray(payload?.emails) ? payload.emails : [])
                    : sanitizePhones(Array.isArray(payload?.phones) ? payload.phones : [])
            }
        } catch { /* ContactOut reveal failed */ }
        if (fieldValues.length > 0) { setCacheField(rowId, field, fieldValues, false); return }
        // CrustData fallback (email + phone when available)
        if (fieldValues.length === 0) {
            const linkedinUrl = profile.flagship_profile_url || profile.linkedin_profile_url
            if (linkedinUrl) {
                try {
                    const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
                    const crustRes = await fetch(`""/api/v1/crustdata/person/enrich`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ linkedin_profile_url: linkedinUrl }),
                    })
                    if (crustRes.ok) {
                        const crustData = await crustRes.json()
                        const crustEmails = sanitizeEmails(
                            Array.isArray(crustData?.business_email) ? crustData.business_email : []
                        )
                        const crustPhones = sanitizePhones([
                            ...(Array.isArray(crustData?.phone_numbers) ? crustData.phone_numbers : []),
                            ...(Array.isArray(crustData?.phones) ? crustData.phones : []),
                            crustData?.phone,
                            crustData?.business_phone,
                            crustData?.mobile_phone,
                        ].filter(Boolean))
                        if (field === "email" && crustEmails.length > 0) {
                            setCacheField(rowId, field, crustEmails, false)
                            return
                        }
                        if (field === "phone" && crustPhones.length > 0) {
                            setCacheField(rowId, field, crustPhones, false)
                            return
                        }
                    }
                } catch { /* CrustData fallback failed */ }
            }
        }
        // BetterContact fallback
        try {
            const firstName = profile.first_name || profile.name?.split(" ")[0] || ""
            const lastName = profile.last_name || profile.name?.split(" ").slice(1).join(" ") || ""
            const employer = profile.current_employers?.[0]
            const companyName = employer?.name || ""
            const companyDomain = employer?.company_website_domain || ""
            const bcRes = await fetch(`""/api/v1/bettercontact/enrich-prospect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, company_name: companyName, company_domain: companyDomain, linkedin_url: linkedinUrl, field }),
            })
            const bcData = bcRes.ok ? await bcRes.json() : null
            const fallbackValue = field === "email" ? bcData?.email : bcData?.phone
            const sanitized = field === "email"
                ? sanitizeEmails(fallbackValue ? [fallbackValue] : [])
                : sanitizePhones(fallbackValue ? [fallbackValue] : [])
            if (sanitized.length > 0) setCacheField(rowId, field, sanitized, false)
            else updateCacheEntry(rowId, { loading: false })
            if (bcData) onWaterfallResult?.(linkedinUrl, field, bcData)
            return
        } catch { /* BetterContact fallback failed */ }
        updateCacheEntry(rowId, { loading: false })
    }

    const handleRowClick = (prospect: ProspectProfile) => openPanel(prospect)
    const handleProfileClick = (personId: number) => router.push(`/leads/prospects/${personId}`)

    const getRowId = useCallback((profile: ProspectProfile, idx: number) => getStableId(profile, idx), [])

    // Build columns
    const columns: ColumnDef<ProspectProfile>[] = useMemo(() => {
        const cols: ColumnDef<ProspectProfile>[] = [
            {
                key: 'avatar', label: '', defaultVisible: true, width: '50px', sortable: false, category: 'profile',
                render: (_v, prospect) => {
                    const displayName = asText(prospect.name) || "Unknown"
                    const initials = getInitials(displayName)
                    return (
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={prospect.profile_picture_url || ""} alt={displayName} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                    )
                },
            },
            {
                key: 'name', label: 'Name', defaultVisible: true, width: '220px', sortable: true, category: 'profile',
                render: (_v, prospect) => {
                    const displayName = asText(prospect.name) || "Unknown"
                    const profileConfidence = computeConfidence(prospect)
                    const icpData = prospect._icpScore
                    const icpBadgeClass = icpData?.tier === 'Hot' ? 'bg-green-500/90 text-white' : icpData?.tier === 'Warm' ? 'bg-yellow-500/90 text-white' : icpData?.tier === 'Cold' ? 'bg-zinc-500/80 text-white' : ''
                    const isStale = icpData?.timestamp ? (Date.now() - icpData.timestamp) > 24 * 60 * 60 * 1000 : false
                    return (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm truncate max-w-[200px] text-foreground">{displayName}</span>
                                {prospect.recently_changed_jobs && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-400 text-amber-600 bg-amber-50">Job Change</Badge>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {(Number(prospect.num_of_connections) || 0).toLocaleString()} connections
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Confidence: {profileConfidence}%</span>
                                {icpData && (
                                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                        <div className="flex items-center gap-0.5">
                                            <Badge variant="default" className={`text-[10px] px-1.5 py-0 ${icpBadgeClass}`}>
                                                ICP: {icpData.tier} ({Math.round(icpData.score)})
                                            </Badge>
                                            {isStale && <span className="text-[9px] text-orange-400">outdated</span>}
                                        </div>
                                    </TooltipTrigger><TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                        <p className="font-semibold mb-1">ICP Score: {icpData.score}/100 ({icpData.tier})</p>
                                        {icpData.breakdown && (
                                            <div className="space-y-0.5">
                                                <p>Title: {icpData.breakdown.title ? `+${icpData.breakdown.title}` : '0'}</p>
                                                <p>Industry: {icpData.breakdown.industry ? `+${icpData.breakdown.industry}` : '0'}</p>
                                                <p>Location: {icpData.breakdown.location ? `+${icpData.breakdown.location}` : '0'}</p>
                                                <p>Size: {icpData.breakdown.size ? `+${icpData.breakdown.size}` : '0'}</p>
                                                <p>Seniority: {icpData.breakdown.seniority ? `+${icpData.breakdown.seniority}` : '0'}</p>
                                                <p>Keywords: {icpData.breakdown.keywords ? `+${icpData.breakdown.keywords}` : '0'}</p>
                                            </div>
                                        )}
                                        {isStale && <p className="mt-1 text-orange-400">Score is older than 24 hours</p>}
                                    </TooltipContent></Tooltip></TooltipProvider>
                                )}
                            </div>
                        </div>
                    )
                },
            },
            {
                key: 'current_title', label: 'Current Title', defaultVisible: true, width: '200px', sortable: true, category: 'profile',
                render: (_v, prospect) => {
                    const currentEmployer = prospect.current_employers?.[0] || ((prospect as any).employer as any)?.[0]
                    return (
                        <div className="flex flex-col">
                            <span className="text-sm truncate max-w-[190px]">{currentEmployer?.title || "N/A"}</span>
                            <span className="text-xs text-muted-foreground">{currentEmployer?.seniority_level || ""}</span>
                        </div>
                    )
                },
            },
            {
                key: 'company', label: 'Company', defaultVisible: true, width: '200px', sortable: true, category: 'profile',
                render: (_v, prospect) => {
                    const currentEmployer = prospect.current_employers?.[0] || ((prospect as any).employer as any)?.[0]
                    return (
                        <div className="flex flex-col">
                            <span className="text-sm font-medium truncate max-w-[190px]">{currentEmployer?.name || "N/A"}</span>
                            {currentEmployer?.company_linkedin_industry && (
                                <span className="text-xs text-muted-foreground truncate max-w-[190px]">{currentEmployer.company_linkedin_industry}</span>
                            )}
                        </div>
                    )
                },
            },
            {
                key: 'region', label: 'Location', defaultVisible: true, width: '150px', sortable: true, category: 'profile',
                render: (_v, prospect) => (
                    <span className="text-sm truncate inline-block max-w-[140px]">
                        {prospect.location_details?.country || prospect.region || "N/A"}
                    </span>
                ),
            },
            {
                key: 'experience', label: 'Experience', defaultVisible: true, width: '120px', sortable: false, category: 'profile',
                render: (_v, prospect) => (
                    <Badge variant="outline" className="font-normal">{getExperienceLabel(prospect)}</Badge>
                ),
            },

            // ── Identity & Profile ──
            { key: 'first_name', label: 'First Name', defaultVisible: false, width: '120px', sortable: true, category: 'identity' },
            { key: 'last_name', label: 'Last Name', defaultVisible: false, width: '120px', sortable: true, category: 'identity' },
            { key: 'person_id', label: 'Person ID', defaultVisible: false, width: '100px', sortable: true, category: 'identity',
                render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <>N/A</>,
            },
            { key: 'headline', label: 'Headline', defaultVisible: false, width: '250px', sortable: false, category: 'identity',
                render: (v) => v ? <span className="text-xs truncate max-w-[240px] block">{v}</span> : <>N/A</>,
            },
            {
                key: 'num_of_connections', label: 'Connections', defaultVisible: false, width: '110px', sortable: true, category: 'identity',
                render: (v) => typeof v === 'number' ? <>{v.toLocaleString()}</> : <>N/A</>,
            },
            {
                key: 'recently_changed_jobs', label: 'Job Change', defaultVisible: false, width: '100px', sortable: true, category: 'identity',
                render: (v) => v ? <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>,
            },

            // ── Location Details ──
            {
                key: 'location_city', label: 'City', defaultVisible: false, width: '120px', sortable: true, category: 'location',
                render: (_v, p) => <>{p.location_details?.city || "N/A"}</>,
            },
            {
                key: 'location_state', label: 'State', defaultVisible: false, width: '120px', sortable: true, category: 'location',
                render: (_v, p) => <>{p.location_details?.state || "N/A"}</>,
            },
            {
                key: 'location_country', label: 'Country', defaultVisible: false, width: '120px', sortable: true, category: 'location',
                render: (_v, p) => <>{p.location_details?.country || "N/A"}</>,
            },
            {
                key: 'location_continent', label: 'Continent', defaultVisible: false, width: '120px', sortable: false, category: 'location',
                render: (_v, p) => <>{(p.location_details as any)?.continent || "N/A"}</>,
            },

            // ── Current Employer Details ──
            {
                key: 'current_seniority', label: 'Seniority Level', defaultVisible: false, width: '140px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0] || ((p as any).employer as any)?.[0]
                    return emp?.seniority_level ? <Badge variant="secondary" className="text-xs">{emp.seniority_level}</Badge> : <>N/A</>
                },
            },
            {
                key: 'years_at_company', label: 'Years at Company', defaultVisible: false, width: '130px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    const years = parseYears(emp?.years_at_company_raw ?? emp?.years_at_company)
                    return years > 0 ? <>{formatExperienceFromYears(years)}</> : <>N/A</>
                },
            },
            {
                key: 'company_industry', label: 'Company Industry', defaultVisible: false, width: '180px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0] || ((p as any).employer as any)?.[0]
                    return emp?.company_linkedin_industry ? <span className="text-xs truncate max-w-[170px] block">{emp.company_linkedin_industry}</span> : <>N/A</>
                },
            },
            {
                key: 'company_type', label: 'Company Type', defaultVisible: false, width: '130px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    return <>{emp?.company_type || "N/A"}</>
                },
            },
            {
                key: 'company_headcount', label: 'Company Size', defaultVisible: false, width: '120px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    if (emp?.company_headcount_latest) return <>{emp.company_headcount_latest.toLocaleString()}</>
                    return <>{emp?.company_headcount_range || "N/A"}</>
                },
            },
            {
                key: 'company_hq', label: 'Company HQ', defaultVisible: false, width: '150px', sortable: false, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    return <span className="text-xs truncate max-w-[140px] block">{emp?.company_hq_location || emp?.company_headquarters_country || "N/A"}</span>
                },
            },
            {
                key: 'company_domain', label: 'Company Domain', defaultVisible: false, width: '150px', sortable: false, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    const domain = emp?.company_website_domain
                    return domain ? (
                        <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">{domain}</a>
                    ) : <>N/A</>
                },
            },
            {
                key: 'company_linkedin', label: 'Company Profile', defaultVisible: false, width: '130px', sortable: false, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    const url = emp?.company_linkedin_profile_url
                    return url ? (
                        <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-medium">Profile</a>
                    ) : <>N/A</>
                },
            },
            {
                key: 'start_date', label: 'Start Date', defaultVisible: false, width: '110px', sortable: true, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    if (!emp?.start_date) return <>N/A</>
                    try { return <>{new Date(emp.start_date).toLocaleDateString()}</> } catch { return <>{emp.start_date}</> }
                },
            },
            {
                key: 'business_email_verified', label: 'Email Verified', defaultVisible: false, width: '110px', sortable: false, category: 'employer',
                render: (_v, p) => {
                    const emp = p.current_employers?.[0]
                    if (emp?.business_email_verified === undefined) return <>N/A</>
                    return emp.business_email_verified ? <Badge variant="default" className="bg-green-500 text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>
                },
            },

            // ── Past Employers ──
            {
                key: 'past_employers_list', label: 'Past Companies', defaultVisible: false, width: '250px', sortable: false, category: 'career',
                render: (_v, p) => {
                    const past = p.past_employers || []
                    if (past.length === 0) return <>N/A</>
                    return (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {past.slice(0, 3).map((emp, i) => (
                                <Badge key={i} variant="outline" className="text-xs px-1.5 py-0 truncate max-w-[100px]">{emp.name}</Badge>
                            ))}
                            {past.length > 3 && <Badge variant="outline" className="text-xs px-1.5 py-0">+{past.length - 3}</Badge>}
                        </div>
                    )
                },
            },
            {
                key: 'past_titles', label: 'Past Titles', defaultVisible: false, width: '250px', sortable: false, category: 'career',
                render: (_v, p) => {
                    const past = p.past_employers || []
                    const titles = past.map(e => e.title).filter(Boolean)
                    if (titles.length === 0) return <>N/A</>
                    return (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {titles.slice(0, 3).map((t, i) => (
                                <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0 truncate max-w-[110px]">{t}</Badge>
                            ))}
                            {titles.length > 3 && <Badge variant="secondary" className="text-xs px-1.5 py-0">+{titles.length - 3}</Badge>}
                        </div>
                    )
                },
            },
            {
                key: 'total_employers', label: 'Total Companies', defaultVisible: false, width: '120px', sortable: true, category: 'career',
                render: (_v, p) => {
                    const total = (p.all_employers || p.current_employers || []).length + (p.past_employers || []).length
                    return total > 0 ? <span className="font-medium">{total}</span> : <>N/A</>
                },
            },

            // ── Skills & Languages ──
            {
                key: 'skills', label: 'Skills', defaultVisible: false, width: '250px', sortable: false, category: 'skills',
                render: (v) => {
                    const skills = Array.isArray(v) ? v : []
                    if (skills.length === 0) return <>N/A</>
                    return (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {skills.slice(0, 4).map((s: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0">{s}</Badge>
                            ))}
                            {skills.length > 4 && <Badge variant="secondary" className="text-xs px-1.5 py-0">+{skills.length - 4}</Badge>}
                        </div>
                    )
                },
            },
            {
                key: 'languages', label: 'Languages', defaultVisible: false, width: '180px', sortable: false, category: 'skills',
                render: (v) => {
                    const langs = Array.isArray(v) ? v : []
                    if (langs.length === 0) return <>N/A</>
                    return <span className="text-xs">{langs.join(', ')}</span>
                },
            },

            // ── Education ──
            {
                key: 'education_school', label: 'School', defaultVisible: false, width: '200px', sortable: false, category: 'education',
                render: (_v, p) => {
                    const edu = p.education_background?.[0]
                    return edu?.institute_name ? <span className="text-xs truncate max-w-[190px] block">{edu.institute_name}</span> : <>N/A</>
                },
            },
            {
                key: 'education_degree', label: 'Degree', defaultVisible: false, width: '180px', sortable: false, category: 'education',
                render: (_v, p) => {
                    const edu = p.education_background?.[0]
                    return edu?.degree_name ? <span className="text-xs truncate max-w-[170px] block">{edu.degree_name}</span> : <>N/A</>
                },
            },
            {
                key: 'education_field', label: 'Field of Study', defaultVisible: false, width: '180px', sortable: false, category: 'education',
                render: (_v, p) => {
                    const edu = p.education_background?.[0]
                    return edu?.field_of_study ? <span className="text-xs truncate max-w-[170px] block">{edu.field_of_study}</span> : <>N/A</>
                },
            },
            {
                key: 'education_count', label: 'Education Count', defaultVisible: false, width: '120px', sortable: true, category: 'education',
                render: (_v, p) => {
                    const count = p.education_background?.length || 0
                    return count > 0 ? <>{count}</> : <>N/A</>
                },
            },

            // ── Social & Links ──
            {
                key: 'linkedin_profile_url', label: 'Profile URL', defaultVisible: false, width: '130px', sortable: false, category: 'social',
                render: (v, p) => {
                    const url = v || p.flagship_profile_url
                    return url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs font-medium">Profile</a>
                    ) : <>N/A</>
                },
            },
            {
                key: 'twitter_handle', label: 'Twitter', defaultVisible: false, width: '130px', sortable: false, category: 'social',
                render: (v) => v ? (
                    <a href={`https://twitter.com/${v}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">@{v}</a>
                ) : <>N/A</>,
            },

            // ── Metadata ──
            {
                key: 'last_updated', label: 'Last Updated', defaultVisible: false, width: '120px', sortable: true, category: 'metadata',
                render: (v) => {
                    if (!v) return <>N/A</>
                    try { return <>{new Date(v).toLocaleDateString()}</> } catch { return <>{v}</> }
                },
            },
        ]

        if (enableContactReveal) {
            cols.push({
                key: 'email_reveal', label: 'Email', defaultVisible: true, width: '200px', sortable: false, category: 'contact',
                render: (_v, prospect, idx) => {
                    const stableId = getStableId(prospect, idx)
                    const rowKey = `${stableId}-${idx}`
                    const contactKey = prospect.linkedin_profile_url || prospect.flagship_profile_url || rowKey
                    const isEmailRevealed = Boolean(revealedEmail[rowKey])
                    const cache = contactCache[rowKey]
                    const localEmails = getExistingEmails(prospect as any)
                    const emails = (cache?.emails && cache.emails.length > 0) ? cache.emails : localEmails
                    const waterfallEmail = enrichCache?.[contactKey]?.email

                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            {!isEmailRevealed ? (
                                <>
                                    <div className="flex items-center gap-1">
                                        <Button variant="secondary" size="sm" className="h-7 text-[11px]"
                                            onClick={async () => { setRevealedEmail((prev) => ({ ...prev, [rowKey]: true })); await revealContact(rowKey, prospect, "email") }}>
                                            <Lock className="h-3 w-3 mr-1" /> Tap to Reveal
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600"
                                            onClick={async () => { setRevealedEmail((prev) => ({ ...prev, [rowKey]: true })); onEnrichReveal?.(prospect, "email") }}
                                            title={`Advanced enrichment: ${formatCreditsLabel(waterfallEmail?.credits_consumed)}`}>
                                            <Zap className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1 space-x-3">
                                        <span>Reveal cost: {formatCreditsLabel(CONTACTOUT_EMAIL_COST)}</span>
                                        <span>Advanced enrichment: {formatCreditsLabel(waterfallEmail?.credits_consumed)}</span>
                                    </div>
                                </>
                            ) : cache?.loading ? (
                                <span className="text-xs text-muted-foreground">Loading...</span>
                            ) : enrichingRows?.[`${contactKey}-email`] ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    <span className="text-xs text-muted-foreground">Enriching...</span>
                                </div>
                            ) : waterfallEmail ? (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs break-all ${!waterfallEmail?.email ? "text-muted-foreground italic" : ""}`}>
                                            {waterfallEmail?.email || "Not available"}
                                        </span>
                                        <div className="text-xs text-green-600 font-medium">✓ Enriched</div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">Cost: {formatCreditsLabel(waterfallEmail?.credits_consumed, "~1 credit")}</span>
                                </div>
                            ) : emails.length > 0 ? (
                                <span className="text-xs break-all">{emails[0]}</span>
                            ) : (
                                <span className="text-xs text-muted-foreground">Email not Available</span>
                            )}
                        </div>
                    )
                },
            })

            cols.push({
                key: 'phone_reveal', label: 'Phone', defaultVisible: true, width: '160px', sortable: false, category: 'contact',
                render: (_v, prospect, idx) => {
                    const stableId = getStableId(prospect, idx)
                    const rowKey = `${stableId}-${idx}`
                    const contactKey = prospect.linkedin_profile_url || prospect.flagship_profile_url || rowKey
                    const isPhoneRevealed = Boolean(revealedPhone[rowKey])
                    const cache = contactCache[rowKey]
                    const localPhones = getExistingPhones(prospect as any)
                    const phones = (cache?.phones && cache.phones.length > 0) ? cache.phones : localPhones
                    const waterfallPhone = enrichCache?.[contactKey]?.phone

                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            {!isPhoneRevealed ? (
                                <>
                                    <div className="flex items-center gap-1">
                                        <Button variant="secondary" size="sm" className="h-7 text-[11px]"
                                            onClick={async () => { setRevealedPhone((prev) => ({ ...prev, [rowKey]: true })); await revealContact(rowKey, prospect, "phone") }}>
                                            <Lock className="h-3 w-3 mr-1" /> Tap to Reveal
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600"
                                            onClick={async () => { setRevealedPhone((prev) => ({ ...prev, [rowKey]: true })); onEnrichReveal?.(prospect, "phone") }}
                                            title={`Advanced enrichment: ${formatCreditsLabel(waterfallPhone?.credits_consumed)}`}>
                                            <Zap className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1 space-x-3">
                                        <span>Reveal cost: {formatCreditsLabel(CONTACTOUT_PHONE_COST)}</span>
                                        <span>Advanced enrichment: {formatCreditsLabel(waterfallPhone?.credits_consumed)}</span>
                                    </div>
                                </>
                            ) : enrichingRows?.[`${contactKey}-phone`] ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                    <span className="text-xs text-muted-foreground">Enriching...</span>
                                </div>
                            ) : waterfallPhone ? (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${!waterfallPhone?.phone ? "text-muted-foreground italic" : ""}`}>
                                            {waterfallPhone?.phone || "Not available"}
                                        </span>
                                        <div className="text-xs text-green-600 font-medium">✓ Enriched</div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">Cost: {formatCreditsLabel(waterfallPhone?.credits_consumed, "~1 credit")}</span>
                                </div>
                            ) : cache?.loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs text-muted-foreground">Enriching...</span>
                                </div>
                            ) : phones.length > 0 ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">{phones[0]}</span>
                                    <div className="text-xs text-green-600 font-medium">✓ Enriched</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Not found</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600"
                                        onClick={async () => { setRevealedPhone((prev) => ({ ...prev, [rowKey]: true })); await revealContact(rowKey, prospect, "phone") }}
                                        title="Retry enrichment">
                                        <Zap className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )
                },
            })
        }

        return cols
    }, [enableContactReveal, revealedEmail, revealedPhone, contactCache, enrichCache, enrichingRows]) // eslint-disable-line react-hooks/exhaustive-deps

    const table = useTableState({
        tableId,
        data: actualProfiles,
        columns,
        defaultPageSize: 25,
        getRowId,
    })

    // Export handler
    const handleExport = useCallback((rows: ProspectProfile[]) => {
        if (rows.length === 0) return
        const headers = ['Name', 'First Name', 'Last Name', 'Region', 'Headline', 'Skills', 'Profile URL', 'Emails', 'Connections']
        const csvRows = rows.map((p) => [
            p.name || '', p.first_name || '', p.last_name || '', p.region || '',
            p.headline || '', (p.skills || []).join('; '), p.linkedin_profile_url || '',
            (p.emails || []).join('; '), p.num_of_connections?.toString() || '',
        ])
        const csvContent = [headers.join(','), ...csvRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }, [])

    // Loading skeleton
    if (isLoading) {
        return (
            <Card>
                <CardHeader><CardTitle>Prospects</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Empty state
    if (actualProfiles.length === 0) {
        return (
            <Card>
                <CardHeader><CardTitle>Prospects (0)</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-muted rounded-full p-4 mb-4"><Eye className="h-8 w-8 text-muted-foreground" /></div>
                        <p className="text-lg font-medium text-muted-foreground">No prospects found</p>
                        <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters or search criteria</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm p-0 overflow-hidden flex flex-col">
            <TableToolbar
                tableId={tableId}
                columns={columns}
                visibility={table.visibility}
                onToggleColumn={table.toggleColumn}
                onSetVisibility={table.setAllColumnsVisibility}
                totalRows={totalCount || actualProfiles.length}
                onExport={() => handleExport(actualProfiles)}
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
                onRowClick={handleRowClick}
                pageOffset={(table.page - 1) * table.pageSize}
                renderActions={(prospect) => {
                    const stableId = getStableId(prospect, 0)
                    return (
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-600"
                                onClick={() => handleRowClick(prospect)} title="Open AI Copilot">
                                <Sparkles className="h-4 w-4" /><span className="sr-only">AI Copilot</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => handleProfileClick(stableId as any)}>
                                <Eye className="h-4 w-4" /><span className="sr-only">View Profile</span>
                            </Button>
                            {prospect.flagship_profile_url && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" asChild>
                                    <a href={prospect.flagship_profile_url} target="_blank" rel="noopener noreferrer">
                                        <Linkedin className="h-4 w-4" /><span className="sr-only">Profile</span>
                                    </a>
                                </Button>
                            )}
                        </div>
                    )
                }}
            />

            {table.totalPages > 1 && (
                <PaginationControls
                    page={table.page}
                    totalPages={table.totalPages}
                    pageSize={table.pageSize}
                    totalRows={actualProfiles.length}
                    onPageChange={table.setPage}
                    onPageSizeChange={table.setPageSize}
                />
            )}

            {/* Server-side Load More for cursor pagination */}
            {hasMore && (
                <div className="flex justify-center py-4 border-t">
                    <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore} className="min-w-[200px]">
                        {isLoadingMore ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading more...</>) : "Load More Results"}
                    </Button>
                </div>
            )}

            {table.selectedRows.size > 0 && (
                <BulkActionBar
                    selectedCount={table.selectedRows.size}
                    onClearSelection={table.clearSelection}
                    onExportSelected={() => handleExport(table.selectedData)}
                    onEnrichAll={onEnrichReveal ? () => {
                        table.selectedData.forEach(p => onEnrichReveal(p, 'email'))
                    } : undefined}
                />
            )}
        </Card>
    )
}
