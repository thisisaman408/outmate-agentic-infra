"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eye, Linkedin, Loader2, Lock, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProspectProfile } from "@/lib/services/prospectService"
import { getInitials } from "@/lib/services/prospectService"

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
}: ProspectsResultsTableProps) {
    const CONTACTOUT_EMAIL_COST = 1
    const CONTACTOUT_PHONE_COST = 1
    const formatCreditsLabel = (value?: number, fallback = "~1 credit") => {
        if (typeof value === "number") {
            return `${value} credit${value === 1 ? "" : "s"}`
        }
        return fallback
    }
    // Support both 'profiles' and 'data' props for compatibility
    const actualProfiles = profiles || data || []
    
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [revealedEmail, setRevealedEmail] = useState<Record<string, boolean>>({})
    const [revealedPhone, setRevealedPhone] = useState<Record<string, boolean>>({})
    const [contactCache, setContactCache] = useState<Record<string, { emails: string[]; phones: string[]; loading?: boolean }>>({})
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
            if (rawYears > 0) {
                total += rawYears
                continue
            }
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
            if (rawYears > 0) {
                total += rawYears
                continue
            }
            const labelYears = parseYears(emp?.years_at_company)
            if (labelYears > 0) total += labelYears
        }
        return total
    }

    const computeConfidence = (profile: ProspectProfile): number => {
        const raw = (profile as any).raw_data ?? ((profile as any).rawData && typeof (profile as any).rawData === "object" ? (profile as any).rawData : {})
        const baseQuality = Number(
            profile.data_quality_score ??
            raw?.quality_score ??
            raw?.confidence ??
            50
        ) || 50
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
            return String(
                value.email ||
                value.value ||
                value.address ||
                value.work_email ||
                value.personal_email ||
                ""
            )
        }
        return ""
    }

    const sanitizeEmails = (values: any[]): string[] =>
        values
            .map((v) => normalizeStringValue(v))
            .filter((v) => v.includes("@"))
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
            .map((v) => normalizeStringValue(v))
            .filter((v) => v.trim().length > 0)
            .filter((v) => {
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
            profile?.email,
            profile?.work_email,
            profile?.personal_email,
            ...(Array.isArray(profile?.contact_info?.emails) ? profile.contact_info.emails : []),
            ...(Array.isArray(profile?.contact_info?.work_emails) ? profile.contact_info.work_emails : []),
            ...(Array.isArray(profile?.contact_info?.personal_emails) ? profile.contact_info.personal_emails : []),
            ...(Array.isArray(raw?.emails) ? raw.emails : []),
            raw?.email,
            raw?.work_email,
            raw?.personal_email,
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

    const updateCacheEntry = (
        rowId: string,
        updates: Partial<{ emails: string[]; phones: string[]; loading?: boolean }>
    ) => {
        setContactCache((prev) => {
            const existing = prev[rowId] || { emails: [], phones: [] }
            return {
                ...prev,
                [rowId]: {
                    ...existing,
                    ...updates,
                },
            }
        })
    }

    const setCacheField = (rowId: string, field: "email" | "phone", values: string[], loading = false) => {
        const updates: Partial<{ emails: string[]; phones: string[]; loading?: boolean }> = {
            loading,
        }
        if (field === "email") updates.emails = values
        else updates.phones = values
        updateCacheEntry(rowId, updates)
    }
    const revealContact = async (rowId: string, profile: ProspectProfile, field: "email" | "phone") => {
        if (!enableContactReveal) return

        const linkedinUrl = profile.flagship_profile_url || profile.linkedin_profile_url
        if (!linkedinUrl) return

        const existingValues = field === "email" ? getExistingEmails(profile as any) : getExistingPhones(profile as any)
        if (existingValues.length > 0) {
            setCacheField(rowId, field, existingValues, false)
            return
        }

        setCacheField(rowId, field, [], true)
        let fieldValues: string[] = []

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/prospects/reveal-contact`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ linkedin_url: linkedinUrl }),
            })
            if (response.ok) {
                const payload = await response.json()
                fieldValues = field === "email"
                    ? sanitizeEmails(Array.isArray(payload?.emails) ? payload.emails : [])
                    : sanitizePhones(Array.isArray(payload?.phones) ? payload.phones : [])
            }
        } catch {
            // ContactOut reveal failed, continue to fallback
        }

        if (fieldValues.length > 0) {
            setCacheField(rowId, field, fieldValues, false)
            return
        }

        const callBetterContact = async () => {
            const firstName = profile.first_name || profile.name?.split(" ")[0] || ""
            const lastName = profile.last_name || profile.name?.split(" ").slice(1).join(" ") || ""
            const employer = profile.current_employers?.[0]
            const companyName = employer?.name || ""
            const companyDomain = employer?.company_website_domain || ""

            const bcRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bettercontact/enrich-prospect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    company_name: companyName,
                    company_domain: companyDomain,
                    linkedin_url: linkedinUrl,
                    field,
                }),
            })
            return bcRes.ok ? await bcRes.json() : null
        }

        try {
            const bcData = await callBetterContact()
            const fallbackValue = field === "email" ? bcData?.email : bcData?.phone
            const sanitized = field === "email"
                ? sanitizeEmails(fallbackValue ? [fallbackValue] : [])
                : sanitizePhones(fallbackValue ? [fallbackValue] : [])

            if (sanitized.length > 0) {
                setCacheField(rowId, field, sanitized, false)
            } else {
                updateCacheEntry(rowId, { loading: false })
            }

            if (bcData) {
                onWaterfallResult?.(linkedinUrl, field, bcData)
            }
            return
        } catch {
            // BetterContact fallback failed
        }

        updateCacheEntry(rowId, { loading: false })
    }

    // Filter profiles by search term
    const filteredProfiles = actualProfiles.filter((profile) => {
        const searchLower = searchTerm.toLowerCase()
        return (
            asText(profile.name).toLowerCase().includes(searchLower) ||
            asText(profile.headline).toLowerCase().includes(searchLower) ||
            asText(profile.region).toLowerCase().includes(searchLower) ||
            (profile.current_employers?.[0]?.name || "").toLowerCase().includes(searchLower)
        )
    })

    // Handle row click to navigate to profile detail
    const handleProfileClick = (personId: number) => {
        router.push(`/leads/prospects/${personId}`)
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Prospects</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Empty state
    if (actualProfiles.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Prospects (0)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="bg-muted rounded-full p-4 mb-4">
                            <Eye className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">No prospects found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your filters or search criteria
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        Prospects
                        <Badge variant="secondary" className="ml-2">
                            {totalCount.toLocaleString()} total
                        </Badge>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="w-[220px]">Name</TableHead>
                                <TableHead className="w-[200px]">Current Title</TableHead>
                                <TableHead className="w-[200px]">Company</TableHead>
                                <TableHead className="w-[150px]">Location</TableHead>
                                <TableHead className="w-[120px]">Experience</TableHead>
                                {enableContactReveal && <TableHead className="w-[200px]">Email</TableHead>}
                                {enableContactReveal && <TableHead className="w-[160px]">Phone</TableHead>}
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProfiles.map((prospect, idx) => {
                                // Support both In-DB API (current_employers) and Realtime API (employer)
                                const currentEmployer = prospect.current_employers?.[0] ||
                                    ((prospect as any).employer as any)?.[0]
                                const displayName = asText(prospect.name) || "Unknown"
                                const initials = getInitials(displayName)
                                const stableId = getStableId(prospect, idx)
                                const rowKey = `${stableId}-${idx}`
                                const contactKey = prospect.linkedin_profile_url || prospect.flagship_profile_url || rowKey
                                const isEmailRevealed = Boolean(revealedEmail[rowKey])
                                const isPhoneRevealed = Boolean(revealedPhone[rowKey])
                                const cache = contactCache[rowKey]
                                const localEmails = getExistingEmails(prospect as any)
                                const localPhones = getExistingPhones(prospect as any)
                                const emails = (cache?.emails && cache.emails.length > 0) ? cache.emails : localEmails
                                const phones = (cache?.phones && cache.phones.length > 0) ? cache.phones : localPhones
                                const waterfallEmail = enrichCache?.[contactKey]?.email
                                const waterfallPhone = enrichCache?.[contactKey]?.phone
                                const profileConfidence = computeConfidence(prospect)

                                return (
                                    <TableRow
                                        key={rowKey}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleProfileClick(stableId as any)}
                                    >
                                        {/* Profile Image */}
                                        <TableCell>
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage
                                                    src={prospect.profile_picture_url || ""}
                                                    alt={displayName}
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>

                                        {/* Name & Headline */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm truncate max-w-[200px] text-foreground">
                                                    {displayName}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {(Number(prospect.num_of_connections) || 0).toLocaleString()} connections
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    Confidence Score: {profileConfidence}%
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Current Title */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm truncate max-w-[190px]">
                                                    {currentEmployer?.title || "N/A"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {currentEmployer?.seniority_level || ""}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Company */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate max-w-[190px]">
                                                    {currentEmployer?.name || "N/A"}
                                                </span>
                                                {currentEmployer?.company_linkedin_industry && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[190px]">
                                                        {currentEmployer.company_linkedin_industry}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Location */}
                                        <TableCell>
                                            <span className="text-sm truncate inline-block max-w-[140px]">
                                                {prospect.location_details?.country || prospect.region || "N/A"}
                                            </span>
                                        </TableCell>

                                        {/* Experience */}
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">
                                                {getExperienceLabel(prospect)}
                                            </Badge>
                                        </TableCell>

                                        {enableContactReveal && (
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {!isEmailRevealed ? (
                                                    <>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="h-7 text-[11px]"
                                                                onClick={async () => {
                                                                    setRevealedEmail((prev) => ({ ...prev, [rowKey]: true }))
                                                                    await revealContact(rowKey, prospect, "email")
                                                                }}
                                                            >
                                                                <Lock className="h-3 w-3 mr-1" />
                                                                Tap to Reveal
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600"
                                                                onClick={async () => {
                                                                    setRevealedEmail((prev) => ({ ...prev, [rowKey]: true }))
                                                                    onEnrichReveal?.(prospect, "email")
                                                                }}
                                                                title={`Waterfall zap: ${formatCreditsLabel(waterfallEmail?.credits_consumed)}`}
                                                            >
                                                                <Zap className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-1 space-x-3">
                                                            <span>Reveal cost: {formatCreditsLabel(CONTACTOUT_EMAIL_COST)}</span>
                                                            <span>Waterfall zap: {formatCreditsLabel(waterfallEmail?.credits_consumed)}</span>
                                                        </div>
                                                    </>
                                                ) : cache?.loading ? (
                                                    <span className="text-xs text-muted-foreground">Loading...</span>
                                                ) : waterfallEmail ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs break-all ${!waterfallEmail?.email ? "text-muted-foreground italic" : ""}`}>
                                                                {waterfallEmail?.email || "Not available"}
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Cost: {formatCreditsLabel(waterfallEmail?.credits_consumed, "~1 credit")}
                                                        </span>
                                                    </div>
                                                ) : emails.length > 0 ? (
                                                    <span className="text-xs break-all">{emails[0]}</span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Email not Available</span>
                                                )}
                                            </TableCell>
                                        )}

                                        {enableContactReveal && (
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {!isPhoneRevealed ? (
                                                    <>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="h-7 text-[11px]"
                                                                onClick={async () => {
                                                                    setRevealedPhone((prev) => ({ ...prev, [rowKey]: true }))
                                                                    await revealContact(rowKey, prospect, "phone")
                                                                }}
                                                            >
                                                                <Lock className="h-3 w-3 mr-1" />
                                                                Tap to Reveal
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600"
                                                                onClick={async () => {
                                                                    setRevealedPhone((prev) => ({ ...prev, [rowKey]: true }))
                                                                    onEnrichReveal?.(prospect, "phone")
                                                                }}
                                                                title={`Waterfall zap: ${formatCreditsLabel(waterfallPhone?.credits_consumed)}`}
                                                            >
                                                                <Zap className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-1 space-x-3">
                                                            <span>Reveal cost: {formatCreditsLabel(CONTACTOUT_PHONE_COST)}</span>
                                                            <span>Waterfall zap: {formatCreditsLabel(waterfallPhone?.credits_consumed)}</span>
                                                        </div>
                                                    </>
                                                ) : waterfallPhone ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs ${!waterfallPhone?.phone ? "text-muted-foreground italic" : ""}`}>
                                                                {waterfallPhone?.phone || "Not available"}
                                                            </span>
                                                            <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Cost: {formatCreditsLabel(waterfallPhone?.credits_consumed, "~1 credit")}
                                                        </span>
                                                    </div>
                                                ) : cache?.loading ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        <span className="text-xs text-muted-foreground">Enriching...</span>
                                                    </div>
                                                ) : phones.length > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs">{phones[0]}</span>
                                                        <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">Not found</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600"
                                                            onClick={async () => {
                                                                setRevealedPhone((prev) => ({ ...prev, [rowKey]: true }))
                                                                await revealContact(rowKey, prospect, "phone")
                                                            }}
                                                            title="Retry waterfall enrichment"
                                                        >
                                                            <Zap className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}

                                            {/* Actions */}
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleProfileClick(stableId as any)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        <span className="sr-only">View Profile</span>
                                                    </Button>
                                                    {prospect.flagship_profile_url && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                                            asChild
                                                        >
                                                            <a
                                                                href={prospect.flagship_profile_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <Linkedin className="h-4 w-4" />
                                                                <span className="sr-only">LinkedIn Profile</span>
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Load More Button */}
                {hasMore && (
                    <div className="flex justify-center mt-6">
                        <Button
                            variant="outline"
                            onClick={onLoadMore}
                            disabled={isLoadingMore}
                            className="min-w-[200px]"
                        >
                            {isLoadingMore ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading more...
                                </>
                            ) : (
                                `Load More Results`
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
