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
} from "lucide-react"
import type { ProspectProfile } from "@/lib/services/prospectService"
import { getInitials, formatDate, calculateDuration } from "@/lib/services/prospectService"

export default function ProspectProfilePage() {
    const router = useRouter()
    const params = useParams()
    const [profile, setProfile] = useState<ProspectProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Email enrichment state
    const [enrichedEmail, setEnrichedEmail] = useState<string | null>(null)
    const [enrichedPhone, setEnrichedPhone] = useState<string | null>(null)
    const [emailRevealed, setEmailRevealed] = useState(false)
    const [phoneRevealed, setPhoneRevealed] = useState(false)
    const [isEnrichingEmail, setIsEnrichingEmail] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string | null>(null)

    const sanitizeEmails = (values: any[]): string[] =>
        values
            .filter((v) => typeof v === "string" && v.includes("@"))
            .map((v) => (v as string).trim())
            .filter((v) => {
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
        values
            .filter((v) => typeof v === "string" && v.trim().length > 0)
            .map((v) => (v as string).trim())
            .filter((v) => {
                const low = v.toLowerCase()
                if (low.includes("phone number")) return false
                const digits = v.replace(/\D/g, "")
                return digits.length >= 6
            })

    useEffect(() => {
        // Get profile from localStorage (where we'll store search results)
        const storedProfiles = localStorage.getItem("prospect_search_results")
        if (storedProfiles) {
            const profiles: ProspectProfile[] = JSON.parse(storedProfiles)
            // Support both In-DB API (person_id) and Realtime API (linkedin_profile_urn)
            const found = profiles.find((p) =>
                String((p as any).person_id || (p as any).prospect_id || (p as any).linkedin_profile_urn) === params.id
            )
            setProfile(found || null)
        }

        // Check if email already enriched (cached)
        const cachedEmail = localStorage.getItem(`email_${params.id}`)
        if (cachedEmail) {
            const safe = sanitizeEmails([cachedEmail])
            if (safe.length > 0) setEnrichedEmail(safe[0])
        }
        const cachedPhone = localStorage.getItem(`phone_${params.id}`)
        if (cachedPhone) {
            const safe = sanitizePhones([cachedPhone])
            if (safe.length > 0) setEnrichedPhone(safe[0])
        }

        setIsLoading(false)
    }, [params.id])

    // Fetch contact enrichment fallback via ContactOut
    const fetchContactFallback = async () => {
        if (!profile) return { emails: [] as string[], phones: [] as string[] }

        setIsEnrichingEmail(true)
        setEmailError(null)
        setPhoneError(null)

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/prospects/reveal-contact`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        linkedin_url: profile.flagship_profile_url || profile.linkedin_profile_url
                    })
                }
            )

            if (!response.ok) {
                throw new Error('Failed to reveal contact')
            }

            const data = await response.json()
            const emails = sanitizeEmails(Array.isArray(data?.emails) ? data.emails : [])
            const phones = sanitizePhones(Array.isArray(data?.phones) ? data.phones : [])
            return { emails, phones }
        } catch (error: any) {
            console.error('Contact enrichment error:', error)
            throw error
        } finally {
            setIsEnrichingEmail(false)
        }
    }

    const handleRevealEmail = async () => {
        if (!profile) return
        setEmailRevealed(true)
        setEmailError(null)
        if (enrichedEmail) return
        try {
            const localEmails = sanitizeEmails(Array.isArray((profile as any).emails) ? (profile as any).emails : [])
            if (localEmails.length > 0) {
                setEnrichedEmail(localEmails[0])
                return
            }
            const { emails } = await fetchContactFallback()
            if (emails.length > 0) {
                setEnrichedEmail(emails[0])
                localStorage.setItem(`email_${params.id}`, emails[0])
            } else {
                setEmailError("Email not Available")
            }
        } catch {
            setEmailError("Email not Available")
        }
    }

    const handleRevealPhone = async () => {
        if (!profile) return
        setPhoneRevealed(true)
        setPhoneError(null)
        if (enrichedPhone) return
        try {
            const localPhones = sanitizePhones([
                ...((Array.isArray((profile as any).phones) ? (profile as any).phones : [])),
                (profile as any).phone,
            ])
            if (localPhones.length > 0) {
                setEnrichedPhone(localPhones[0])
                return
            }
            const { phones } = await fetchContactFallback()
            if (phones.length > 0) {
                setEnrichedPhone(phones[0])
                localStorage.setItem(`phone_${params.id}`, phones[0])
            } else {
                setPhoneError("Phone not Available")
            }
        } catch {
            setPhoneError("Phone not Available")
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <p className="text-lg font-medium text-muted-foreground">Profile not found</p>
                <Button onClick={() => router.back()} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go Back
                </Button>
            </div>
        )
    }

    // Support both In-DB API (current_employers) and Realtime API (employer)
    const currentEmployer = profile.current_employers?.[0] ||
        (profile as any).employer?.[0]
    const initials = getInitials(profile.name)

    return (
        <div className="min-h-screen bg-background">
            {/* Header with Back Button */}
            <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <Button variant="ghost" onClick={() => router.back()} className="mb-2">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Results
                    </Button>
                </div>
            </div>

            <ScrollArea className="h-[calc(100vh-5rem)]">
                <div className="container mx-auto px-4 py-8 space-y-6">
                    {/* Profile Header Card */}
                    <Card className="overflow-hidden">
                        <div className="bg-gradient-to-r from-primary/10 to-primary/5 h-24" />
                        <CardContent className="pt-0">
                            <div className="flex flex-col md:flex-row gap-6 -mt-12 md:-mt-16">
                                {/* Avatar */}
                                <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-lg">
                                    <AvatarImage
                                        src={profile.profile_picture_url || ""}
                                        alt={profile.name}
                                    />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl md:text-4xl font-bold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Header Info */}
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mt-2">
                                        <div>
                                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                                                {profile.name}
                                            </h1>
                                            <p className="text-base md:text-lg text-muted-foreground mt-1">
                                                {profile.headline}
                                            </p>
                                            {currentEmployer && (
                                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                                    <Building2 className="h-4 w-4" />
                                                    <span className="font-medium">{currentEmployer.name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            {profile.flagship_profile_url && (
                                                <Button asChild className="gap-2">
                                                    <a
                                                        href={profile.flagship_profile_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Linkedin className="h-4 w-4" />
                                                        LinkedIn
                                                    </a>
                                                </Button>
                                            )}

                                            {/* View Email Button */}
                                            <Button
                                                variant={enrichedEmail ? "default" : "outline"}
                                                onClick={handleRevealEmail}
                                                disabled={isEnrichingEmail}
                                                className="gap-2"
                                            >
                                                {isEnrichingEmail ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Revealing...
                                                    </>
                                                ) : enrichedEmail ? (
                                                    <>
                                                        <Mail className="h-4 w-4" />
                                                        {enrichedEmail}
                                                    </>
                                                ) : emailRevealed ? (
                                                    <>
                                                        <Mail className="h-4 w-4" />
                                                        Email not Available
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mail className="h-4 w-4" />
                                                        View Email
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant={enrichedPhone ? "default" : "outline"}
                                                onClick={handleRevealPhone}
                                                disabled={isEnrichingEmail}
                                                className="gap-2"
                                            >
                                                {isEnrichingEmail ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Revealing...
                                                    </>
                                                ) : enrichedPhone ? (
                                                    <>
                                                        <Phone className="h-4 w-4" />
                                                        {enrichedPhone}
                                                    </>
                                                ) : phoneRevealed ? (
                                                    <>
                                                        <Phone className="h-4 w-4" />
                                                        Phone not Available
                                                    </>
                                                ) : (
                                                    <>
                                                        <Phone className="h-4 w-4" />
                                                        View Phone
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {/* Email Error Display */}
                                        {emailError && (
                                            <p className="text-sm text-destructive mt-2">
                                                {emailError}
                                            </p>
                                        )}
                                        {phoneError && (
                                            <p className="text-sm text-destructive mt-2">
                                                {phoneError}
                                            </p>
                                        )}
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="flex flex-wrap gap-4 mt-6">
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span>{profile.location_details?.country || profile.region || "N/A"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span>{profile.num_of_connections.toLocaleString()} connections</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                                            <span>{profile.years_of_experience}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Current Position */}
                            {currentEmployer && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Briefcase className="h-5 w-5 text-primary" />
                                            Current Position
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-lg font-semibold">{currentEmployer.title}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-medium text-primary">{currentEmployer.name}</span>
                                                    {currentEmployer.company_type && (
                                                        <Badge variant="outline">{currentEmployer.company_type}</Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">Since</p>
                                                    <p className="font-medium">{formatDate(currentEmployer.start_date)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Duration</p>
                                                    <p className="font-medium">
                                                        {calculateDuration(currentEmployer.start_date)}
                                                    </p>
                                                </div>
                                                {currentEmployer.seniority_level && (
                                                    <div>
                                                        <p className="text-muted-foreground">Seniority</p>
                                                        <p className="font-medium">{currentEmployer.seniority_level}</p>
                                                    </div>
                                                )}
                                                {currentEmployer.company_headcount_latest > 0 && (
                                                    <div>
                                                        <p className="text-muted-foreground">Company Size</p>
                                                        <p className="font-medium">
                                                            {currentEmployer.company_headcount_latest.toLocaleString()} employees
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {currentEmployer?.company_industries?.length > 0 && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-2">Industries</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentEmployer.company_industries.map((industry, idx) => (
                                                            <Badge key={idx} variant="secondary">
                                                                {industry}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {currentEmployer.company_website && (
                                                <div className="pt-2">
                                                    <Button variant="outline" size="sm" asChild className="gap-2">
                                                        <a
                                                            href={currentEmployer.company_website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <Globe className="h-4 w-4" />
                                                            Visit Company Website
                                                        </a>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Professional Journey */}
                            {((profile.past_employers?.length || 0) > 0 ||
                                ((profile as any).employer?.filter((e: any) => !e.is_default)?.length || 0) > 0) && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Calendar className="h-5 w-5 text-primary" />
                                                Professional Journey
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-6">
                                                {/* Support both In-DB API (past_employers) and Realtime API (employer with is_default=false) */}
                                                {(profile.past_employers ||
                                                    (profile as any).employer?.filter((e: any) => !e.is_default) || []
                                                )?.slice(0, 5).map((employer, idx) => (
                                                    <div key={idx} className="relative">
                                                        {idx < ((profile.past_employers ||
                                                            (profile as any).employer?.filter((e: any) => !e.is_default) || []
                                                        )?.slice(0, 5).length || 0) - 1 && (
                                                                <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />
                                                            )}
                                                        <div className="flex gap-4">
                                                            <div className="relative">
                                                                <div className="h-5 w-5 rounded-full bg-primary/20 border-2 border-primary" />
                                                            </div>
                                                            <div className="flex-1 pb-4">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold">{employer.title}</h4>
                                                                        <p className="text-sm text-primary">{employer.name}</p>
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            {formatDate(employer.start_date)} -{" "}
                                                                            {employer.end_date ? formatDate(employer.end_date) : "Present"}{" "}
                                                                            · {calculateDuration(employer.start_date, employer.end_date)}
                                                                        </p>
                                                                    </div>
                                                                    {employer.seniority_level && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {employer.seniority_level}
                                                                        </Badge>
                                                                    )}
                                                                </div>
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
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <GraduationCap className="h-5 w-5 text-primary" />
                                            Education
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-6">
                                            {profile.education_background?.map((edu, idx) => (
                                                <div key={idx} className="flex gap-4">
                                                    {edu.institute_logo_url && (
                                                        <div className="flex-shrink-0">
                                                            <img
                                                                src={edu.institute_logo_url}
                                                                alt={edu.institute_name}
                                                                className="h-12 w-12 object-contain rounded"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold truncate pr-2">{edu.institute_name}</h4>
                                                        <p className="text-sm text-muted-foreground mt-1 break-words">
                                                            {edu.degree_name}
                                                            {edu.field_of_study && ` · ${edu.field_of_study}`}
                                                        </p>
                                                        {edu.start_date && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {new Date(edu.start_date).getFullYear()} -{" "}
                                                                {edu.end_date ? new Date(edu.end_date).getFullYear() : "Present"}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right Column - Skills & Certifications */}
                        <div className="space-y-6">
                            {/* Skills */}
                            {profile.skills?.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Skills & Expertise</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.skills?.slice(0, 15).map((skill, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                    {skill}
                                                </Badge>
                                            ))}
                                            {(profile.skills?.length || 0) > 15 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{(profile.skills?.length || 0) - 15} more
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Certifications */}
                            {profile.certifications?.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Award className="h-4 w-4" />
                                            Certifications
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {profile.certifications?.map((cert: any, idx) => (
                                                <div key={idx} className="text-sm">
                                                    <p className="font-medium">{cert.name}</p>
                                                    {cert.authority && (
                                                        <p className="text-xs text-muted-foreground">{cert.authority}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Summary */}
                            {profile.summary && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">About</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                                            {profile.summary}
                                        </p>
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
