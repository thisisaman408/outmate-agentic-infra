"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    ArrowLeft,
    Briefcase,
    GraduationCap,
    Award,
    Linkedin,
    MapPin,
    Calendar,
    Building2,
    Globe,
    Users,
    Loader2,
    Mail,
    Phone,
    Twitter,
    Star,
    Shield,
    Languages,
    Hash,
    ExternalLink,
    Clock,
    TrendingUp,
    Sparkles,
    CheckCircle2,
    XCircle,
    Zap,
    Layers,
} from "lucide-react"
import Link from "next/link"
import type { ProspectProfile } from "@/lib/services/prospectService"
import { getInitials, formatDate, calculateDuration } from "@/lib/services/prospectService"

// ── Helpers ──

const parseYears = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
    if (typeof value === "string" && value.trim()) {
        const match = value.trim().match(/(\d+(\.\d+)?)/)
        const num = Number(match?.[1] ?? "")
        if (Number.isFinite(num)) return Math.max(0, num)
    }
    return 0
}

const estimateExperienceYears = (profile: ProspectProfile): number => {
    const raw = ((profile as any).raw_data && typeof (profile as any).raw_data === "object")
        ? (profile as any).raw_data : {}
    const employers = [
        ...(Array.isArray(profile.current_employers) ? profile.current_employers : []),
        ...(Array.isArray(profile.past_employers) ? profile.past_employers : []),
        ...(Array.isArray(raw?.current_employers) ? raw.current_employers : []),
        ...(Array.isArray(raw?.past_employers) ? raw.past_employers : []),
    ]
    let total = 0
    for (const emp of employers) {
        const y = parseYears(emp?.years_at_company_raw ?? emp?.years_at_company)
        if (y > 0) total += y
    }
    return total
}

const computeConfidence = (profile: ProspectProfile): number => {
    const raw = (profile as any).raw_data ?? {}
    const baseQuality = Number(profile.data_quality_score ?? raw?.quality_score ?? raw?.confidence ?? 50) || 50
    const experienceBoost = Math.min(10, estimateExperienceYears(profile) / 2)
    const connectionBoost = Math.min(10, (Number(profile.num_of_connections) || 0) / 500)
    const computed = (baseQuality * 0.7) + (experienceBoost * 2) + connectionBoost
    return Math.max(0, Math.min(100, Math.round(computed)))
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value?: string | number | null; href?: string }) {
    if (!value && value !== 0) return null
    const display = typeof value === "number" ? value.toLocaleString() : value
    return (
        <div className="flex items-start gap-3 py-2">
            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline break-all">
                        {display} <ExternalLink className="inline h-3 w-3 ml-0.5" />
                    </a>
                ) : (
                    <p className="text-sm font-medium break-all">{display}</p>
                )}
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color?: string }) {
    return (
        <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3">
            <div className={`rounded-full p-2 ${color || "bg-primary/10"}`}>
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
            </div>
        </div>
    )
}

export default function ProspectProfilePage() {
    const router = useRouter()
    const params = useParams()
    const [profile, setProfile] = useState<ProspectProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const [enrichedEmail, setEnrichedEmail] = useState<string | null>(null)
    const [enrichedPhone, setEnrichedPhone] = useState<string | null>(null)
    const [emailRevealed, setEmailRevealed] = useState(false)
    const [phoneRevealed, setPhoneRevealed] = useState(false)
    const [isEnrichingEmail, setIsEnrichingEmail] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string | null>(null)

    const sanitizeEmails = (values: any[]): string[] =>
        values.filter((v) => typeof v === "string" && v.includes("@")).map((v) => (v as string).trim()).filter((v) => {
            const low = v.toLowerCase()
            const [localPart = "", domainPart = ""] = low.split("@")
            if (!low) return false
            if (low.endsWith("@example.com") || low.includes("test@")) return false
            if (/^email\d+$/.test(localPart)) return false
            if (/^(test|demo|sample)\d*$/.test(localPart)) return false
            if (domainPart === "gmail.com" && (/^email\d+$/.test(localPart) || /^test\d*$/.test(localPart))) return false
            return true
        })

    const sanitizePhones = (values: any[]): string[] =>
        values.filter((v) => typeof v === "string" && v.trim().length > 0).map((v) => (v as string).trim()).filter((v) => {
            if (v.toLowerCase().includes("phone number")) return false
            return v.replace(/\D/g, "").length >= 6
        })

    useEffect(() => {
        const storedProfiles = localStorage.getItem("prospect_search_results")
        if (storedProfiles) {
            const profiles: ProspectProfile[] = JSON.parse(storedProfiles)
            const found = profiles.find((p) =>
                String((p as any).person_id || (p as any).prospect_id || (p as any).linkedin_profile_urn) === params.id
            )
            setProfile(found || null)
        }
        const cachedEmail = localStorage.getItem(`email_${params.id}`)
        if (cachedEmail) { const safe = sanitizeEmails([cachedEmail]); if (safe.length > 0) setEnrichedEmail(safe[0]) }
        const cachedPhone = localStorage.getItem(`phone_${params.id}`)
        if (cachedPhone) { const safe = sanitizePhones([cachedPhone]); if (safe.length > 0) setEnrichedPhone(safe[0]) }
        setIsLoading(false)
    }, [params.id])

    const fetchContactFallback = async () => {
        if (!profile) return { emails: [] as string[], phones: [] as string[] }
        setIsEnrichingEmail(true)
        setEmailError(null)
        setPhoneError(null)
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const response = await fetch(
                `""/api/v1/prospects/reveal-contact`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ linkedin_url: profile.flagship_profile_url || profile.linkedin_profile_url }) }
            )
            if (!response.ok) throw new Error('Failed to reveal contact')
            const data = await response.json()
            return { emails: sanitizeEmails(Array.isArray(data?.emails) ? data.emails : []), phones: sanitizePhones(Array.isArray(data?.phones) ? data.phones : []) }
        } catch (error: any) { console.error('Contact enrichment error:', error); throw error }
        finally { setIsEnrichingEmail(false) }
    }

    const handleRevealEmail = async () => {
        if (!profile) return
        setEmailRevealed(true); setEmailError(null)
        if (enrichedEmail) return
        try {
            const localEmails = sanitizeEmails(Array.isArray((profile as any).emails) ? (profile as any).emails : [])
            if (localEmails.length > 0) { setEnrichedEmail(localEmails[0]); return }
            const { emails } = await fetchContactFallback()
            if (emails.length > 0) { setEnrichedEmail(emails[0]); localStorage.setItem(`email_${params.id}`, emails[0]) }
            else setEmailError("Email not Available")
        } catch { setEmailError("Email not Available") }
    }

    const handleRevealPhone = async () => {
        if (!profile) return
        setPhoneRevealed(true); setPhoneError(null)
        if (enrichedPhone) return
        try {
            const localPhones = sanitizePhones([...((Array.isArray((profile as any).phones) ? (profile as any).phones : [])), (profile as any).phone])
            if (localPhones.length > 0) { setEnrichedPhone(localPhones[0]); return }
            const { phones } = await fetchContactFallback()
            if (phones.length > 0) { setEnrichedPhone(phones[0]); localStorage.setItem(`phone_${params.id}`, phones[0]) }
            else setPhoneError("Phone not Available")
        } catch { setPhoneError("Phone not Available") }
    }

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <p className="text-lg font-medium text-muted-foreground">Profile not found</p>
                <Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" />Go Back</Button>
            </div>
        )
    }

    const currentEmployer = profile.current_employers?.[0] || (profile as any).employer?.[0]
    const initials = getInitials(profile.name)
    const confidence = computeConfidence(profile)
    const knownEmails = sanitizeEmails(Array.isArray(profile.emails) ? profile.emails : [])

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />Back to Results
                    </Button>
                </div>
            </div>

            <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">

                    {/* ═══ PROFILE HEADER ═══ */}
                    <Card className="overflow-hidden">
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent h-28" />
                        <CardContent className="pt-0 pb-6">
                            <div className="flex flex-col md:flex-row gap-6 -mt-14">
                                <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                                    <AvatarImage src={profile.profile_picture_url || ""} alt={profile.name} />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">{initials}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 mt-2">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h1 className="text-2xl md:text-3xl font-bold">{profile.name}</h1>
                                                {profile.recently_changed_jobs && (
                                                    <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 text-xs">Job Change</Badge>
                                                )}
                                            </div>
                                            <p className="text-base text-muted-foreground mt-1">{profile.headline || "No headline"}</p>
                                            {currentEmployer && (
                                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                                    <Building2 className="h-4 w-4" />
                                                    <span className="font-medium">{currentEmployer.name}</span>
                                                    {currentEmployer.seniority_level && <Badge variant="secondary" className="text-[10px] ml-1">{currentEmployer.seniority_level}</Badge>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-wrap gap-2">
                                            {profile.flagship_profile_url && (
                                                <Button asChild className="gap-2">
                                                    <a href={profile.flagship_profile_url} target="_blank" rel="noopener noreferrer">
                                                        <Linkedin className="h-4 w-4" />Profile
                                                    </a>
                                                </Button>
                                            )}
                                            <Button variant={enrichedEmail ? "default" : "outline"} onClick={handleRevealEmail} disabled={isEnrichingEmail} className="gap-2">
                                                {isEnrichingEmail ? <><Loader2 className="h-4 w-4 animate-spin" />Revealing...</>
                                                    : enrichedEmail ? <><Mail className="h-4 w-4" />{enrichedEmail}</>
                                                    : emailRevealed ? <><Mail className="h-4 w-4" />Not Available</>
                                                    : <><Mail className="h-4 w-4" />View Email</>}
                                            </Button>
                                            <Button variant={enrichedPhone ? "default" : "outline"} onClick={handleRevealPhone} disabled={isEnrichingEmail} className="gap-2">
                                                {isEnrichingEmail ? <><Loader2 className="h-4 w-4 animate-spin" />Revealing...</>
                                                    : enrichedPhone ? <><Phone className="h-4 w-4" />{enrichedPhone}</>
                                                    : phoneRevealed ? <><Phone className="h-4 w-4" />Not Available</>
                                                    : <><Phone className="h-4 w-4" />View Phone</>}
                                            </Button>
                                            <Button asChild variant="outline" className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30">
                                                <Link href={`/copilot/orchestrate?prospect_id=${encodeURIComponent(params.id as string)}&task=${encodeURIComponent(`Prepare everything for my next call with ${profile.name}`)}`}>
                                                    <Layers className="h-4 w-4" />
                                                    Run Full Prep
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                    {(emailError || phoneError) && (
                                        <p className="text-sm text-destructive mt-2">{emailError || phoneError}</p>
                                    )}

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                                        <StatCard label="Connections" value={profile.num_of_connections || 0} icon={Users} />
                                        <StatCard label="Experience" value={profile.years_of_experience || "N/A"} icon={Briefcase} />
                                        <StatCard label="Confidence" value={`${confidence}%`} icon={Shield} />
                                        {profile.data_quality_score !== undefined && (
                                            <StatCard label="Data Quality" value={`${profile.data_quality_score}/100`} icon={Star} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ═══ THREE-COLUMN GRID ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* ── LEFT COLUMN (2-col span) ── */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Current Position */}
                            {currentEmployer && (
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Current Position</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-semibold">{currentEmployer.title}</h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="font-medium text-primary">{currentEmployer.name}</span>
                                                {currentEmployer.company_type && <Badge variant="outline">{currentEmployer.company_type}</Badge>}
                                                {currentEmployer.function_category && <Badge variant="secondary" className="text-xs">{currentEmployer.function_category}</Badge>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                            {currentEmployer.start_date && (
                                                <div>
                                                    <p className="text-muted-foreground">Since</p>
                                                    <p className="font-medium">{formatDate(currentEmployer.start_date)}</p>
                                                </div>
                                            )}
                                            {currentEmployer.start_date && (
                                                <div>
                                                    <p className="text-muted-foreground">Duration</p>
                                                    <p className="font-medium">{calculateDuration(currentEmployer.start_date)}</p>
                                                </div>
                                            )}
                                            {currentEmployer.seniority_level && (
                                                <div><p className="text-muted-foreground">Seniority</p><p className="font-medium">{currentEmployer.seniority_level}</p></div>
                                            )}
                                            {currentEmployer.company_headcount_latest > 0 && (
                                                <div><p className="text-muted-foreground">Company Size</p><p className="font-medium">{currentEmployer.company_headcount_latest.toLocaleString()} employees</p></div>
                                            )}
                                            {!currentEmployer.company_headcount_latest && currentEmployer.company_headcount_range && (
                                                <div><p className="text-muted-foreground">Company Size</p><p className="font-medium">{currentEmployer.company_headcount_range}</p></div>
                                            )}
                                            {currentEmployer.company_headquarters_country && (
                                                <div><p className="text-muted-foreground">Company HQ</p><p className="font-medium">{currentEmployer.company_hq_location || currentEmployer.company_headquarters_country}</p></div>
                                            )}
                                            {currentEmployer.business_email_verified !== undefined && (
                                                <div>
                                                    <p className="text-muted-foreground">Business Email</p>
                                                    <div className="flex items-center gap-1">
                                                        {currentEmployer.business_email_verified
                                                            ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="font-medium text-green-600">Verified</span></>
                                                            : <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium text-muted-foreground">Not verified</span></>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {currentEmployer?.company_industries?.length > 0 && (
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-2">Industries</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {currentEmployer.company_industries.map((industry: string, idx: number) => (
                                                        <Badge key={idx} variant="secondary">{industry}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {currentEmployer.company_linkedin_industry && !currentEmployer?.company_industries?.length && (
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-2">Industry</p>
                                                <Badge variant="secondary">{currentEmployer.company_linkedin_industry}</Badge>
                                            </div>
                                        )}

                                        {(currentEmployer.company_website || currentEmployer.company_website_domain || currentEmployer.company_linkedin_profile_url) && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {(currentEmployer.company_website || currentEmployer.company_website_domain) && (
                                                    <Button variant="outline" size="sm" asChild className="gap-2">
                                                        <a href={currentEmployer.company_website || `https://${currentEmployer.company_website_domain}`} target="_blank" rel="noopener noreferrer">
                                                            <Globe className="h-4 w-4" />Company Website
                                                        </a>
                                                    </Button>
                                                )}
                                                {currentEmployer.company_linkedin_profile_url && (
                                                    <Button variant="outline" size="sm" asChild className="gap-2">
                                                        <a href={currentEmployer.company_linkedin_profile_url.startsWith('http') ? currentEmployer.company_linkedin_profile_url : `https://${currentEmployer.company_linkedin_profile_url}`} target="_blank" rel="noopener noreferrer">
                                                            <Linkedin className="h-4 w-4" />Company Profile
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {currentEmployer.description && (
                                            <div className="pt-2 border-t">
                                                <p className="text-sm text-muted-foreground mb-1">Role Description</p>
                                                <p className="text-sm whitespace-pre-line">{currentEmployer.description}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Professional Journey */}
                            {((profile.past_employers?.length || 0) > 0 ||
                                ((profile as any).employer?.filter((e: any) => !e.is_default)?.length || 0) > 0) && (
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Professional Journey</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-1">
                                            {(profile.past_employers || (profile as any).employer?.filter((e: any) => !e.is_default) || [])?.slice(0, 10).map((employer: any, idx: number, arr: any[]) => (
                                                <div key={idx} className="relative">
                                                    {idx < arr.length - 1 && <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />}
                                                    <div className="flex gap-4">
                                                        <div className="relative"><div className="h-5 w-5 rounded-full bg-primary/20 border-2 border-primary" /></div>
                                                        <div className="flex-1 pb-5">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold">{employer.title}</h4>
                                                                    <p className="text-sm text-primary">{employer.name}</p>
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        {formatDate(employer.start_date)} - {employer.end_date ? formatDate(employer.end_date) : "Present"} · {calculateDuration(employer.start_date, employer.end_date)}
                                                                    </p>
                                                                    {employer.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{employer.location}</p>}
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {employer.seniority_level && <Badge variant="outline" className="text-xs">{employer.seniority_level}</Badge>}
                                                                    {employer.function_category && <Badge variant="secondary" className="text-[10px]">{employer.function_category}</Badge>}
                                                                </div>
                                                            </div>
                                                            {employer.description && (
                                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{employer.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Education */}
                            {profile.education_background?.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />Education</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-5">
                                            {profile.education_background.map((edu, idx) => (
                                                <div key={idx} className="flex gap-4">
                                                    {edu.institute_logo_url ? (
                                                        <div className="flex-shrink-0"><img src={edu.institute_logo_url} alt={edu.institute_name} className="h-12 w-12 object-contain rounded border bg-white p-1" /></div>
                                                    ) : (
                                                        <div className="flex-shrink-0 h-12 w-12 rounded border bg-muted flex items-center justify-center">
                                                            <GraduationCap className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold truncate">{edu.institute_name}</h4>
                                                        <p className="text-sm text-muted-foreground mt-0.5">
                                                            {edu.degree_name}{edu.field_of_study && ` · ${edu.field_of_study}`}
                                                        </p>
                                                        {edu.start_date && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {new Date(edu.start_date).getFullYear()} - {edu.end_date ? new Date(edu.end_date).getFullYear() : "Present"}
                                                            </p>
                                                        )}
                                                        {edu.activities_and_societies && (
                                                            <p className="text-xs text-muted-foreground mt-1">{edu.activities_and_societies}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div className="space-y-6">

                            {/* Contact & Links */}
                            <Card>
                                <CardHeader><CardTitle className="text-base">Contact & Links</CardTitle></CardHeader>
                                <CardContent className="space-y-1">
                                    <InfoRow icon={MapPin} label="Location" value={
                                        [profile.location_details?.city, profile.location_details?.state, profile.location_details?.country].filter(Boolean).join(', ') || profile.region || undefined
                                    } />
                                    {(profile.location_details as any)?.continent && (
                                        <InfoRow icon={Globe} label="Continent" value={(profile.location_details as any).continent} />
                                    )}
                                    <InfoRow icon={Linkedin} label="Profile" value="View Profile" href={profile.flagship_profile_url || profile.linkedin_profile_url || undefined} />
                                    {profile.twitter_handle && (
                                        <InfoRow icon={Twitter} label="Twitter" value={`@${profile.twitter_handle}`} href={`https://twitter.com/${profile.twitter_handle}`} />
                                    )}
                                    {knownEmails.length > 0 && (
                                        <InfoRow icon={Mail} label="Known Emails" value={knownEmails.join(', ')} />
                                    )}
                                    {(profile as any).person_id && (
                                        <InfoRow icon={Hash} label="Person ID" value={(profile as any).person_id} />
                                    )}
                                    {profile.last_updated && (
                                        <InfoRow icon={Clock} label="Last Updated" value={(() => { try { return new Date(profile.last_updated).toLocaleDateString() } catch { return profile.last_updated } })()} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Skills */}
                            {profile.skills?.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Skills & Expertise</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.skills.slice(0, 20).map((skill, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">{skill}</Badge>
                                            ))}
                                            {profile.skills.length > 20 && <Badge variant="outline" className="text-xs">+{profile.skills.length - 20} more</Badge>}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Languages */}
                            {profile.languages?.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4" />Languages</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.languages.map((lang, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">{lang}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Certifications */}
                            {profile.certifications?.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Certifications</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {profile.certifications.map((cert: any, idx: number) => (
                                                <div key={idx} className="text-sm">
                                                    <p className="font-medium">{cert.name || cert.title || String(cert)}</p>
                                                    {cert.authority && <p className="text-xs text-muted-foreground">{cert.authority}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Honors */}
                            {profile.honors?.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4" />Honors & Awards</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {profile.honors.map((honor: any, idx: number) => (
                                                <div key={idx} className="text-sm">
                                                    <p className="font-medium">{honor.name || honor.title || String(honor)}</p>
                                                    {honor.issuer && <p className="text-xs text-muted-foreground">{honor.issuer}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Summary / About */}
                            {profile.summary && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.summary}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
