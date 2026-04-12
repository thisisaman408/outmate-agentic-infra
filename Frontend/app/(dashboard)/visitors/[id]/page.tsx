"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Users,
  TrendingUp,
  Briefcase,
  ExternalLink,
  Loader2,
  User,
  Clock,
  Eye,
  Shield,
  Layers,
  DollarSign,
  Cpu,
} from "lucide-react"
import { authService } from "@/lib/auth"

interface VisitorData {
  id: string
  ip: string
  url: string
  referrer: string
  intent_score: number
  matched: boolean
  created_at: string
  company: string
  domain: string
  website: string
  geo: { city?: string; region?: string; country?: string } | null
  confidence: number
  full_name: string | null
  email: string | null
  phone: string | null
  job_title: string | null
  linkedin_url: string | null
  company_linkedin_url: string | null
  industry: string | null
  employee_count_range: string | null
  employee_count_exact: number | null
  revenue_range: string | null
  funding_stage: string | null
  funding_total: number | null
  technologies: string[]
  headquarters_city: string | null
  headquarters_country: string | null
  description: string | null
  category: string | null
  sequence_type: string | null
  sequence_score: number | null
  account_stage: string | null
  account_score: number | null
  person_resolution_status: string | null
  person_resolution_confidence: number | null
  person_identification_status: string | null
  person_identification_method: string | null
  enrichment_status: string | null
  source_site: string | null
}

export default function VisitorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [visitor, setVisitor] = useState<VisitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVisitor = async () => {
      try {
        const res = await fetch(`/api/v1/visitors/detail/${params.id}`, {
          headers: authService.getAuthHeaders(),
        })
        if (!res.ok) {
          setError(res.status === 404 ? "Visitor not found" : "Failed to load visitor")
          return
        }
        setVisitor(await res.json())
      } catch {
        setError("Failed to load visitor data")
      } finally {
        setIsLoading(false)
      }
    }
    fetchVisitor()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !visitor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg font-medium text-muted-foreground">{error || "Visitor not found"}</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    )
  }

  const score = Math.round((visitor.intent_score || 0) * 100)
  const geo = visitor.geo
  const location = [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ")
  const hqLocation = [visitor.headquarters_city, visitor.headquarters_country].filter(Boolean).join(", ")

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-inner">
            {visitor.full_name ? (
              <User className="h-8 w-8 text-indigo-600" />
            ) : (
              <Building2 className="h-8 w-8 text-indigo-600" />
            )}
          </div>
          <div>
            {visitor.full_name && (
              <h1 className="text-2xl font-black text-[#111827] leading-tight">{visitor.full_name}</h1>
            )}
            {visitor.job_title && (
              <p className="text-sm font-medium text-slate-600">{visitor.job_title}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm font-bold text-slate-800">{visitor.company || "Unknown Company"}</span>
              {visitor.domain && (
                <>
                  <span className="text-slate-300">|</span>
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <a
                    href={`https://${visitor.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    {visitor.domain}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">
            ICP Score
          </span>
          <div className="flex items-baseline gap-1 justify-end">
            <span
              className={`text-4xl font-black ${
                score >= 70 ? "text-green-500" : score >= 40 ? "text-amber-500" : "text-red-400"
              }`}
            >
              {score}
            </span>
            <span className="text-sm font-bold text-slate-400">/100</span>
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-8">
        {visitor.matched && <Badge className="bg-green-100 text-green-700 border-green-200">Matched</Badge>}
        {visitor.category && <Badge variant="outline">{visitor.category}</Badge>}
        {visitor.sequence_type && <Badge variant="secondary">{visitor.sequence_type}</Badge>}
        {visitor.account_stage && <Badge variant="secondary">Stage: {visitor.account_stage}</Badge>}
        {visitor.enrichment_status && (
          <Badge variant="outline" className="text-indigo-600 border-indigo-200">
            {visitor.enrichment_status}
          </Badge>
        )}
        {visitor.source_site && (
          <Badge variant="outline" className="text-slate-500">
            From: {visitor.source_site}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={visitor.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={visitor.phone} />
            <InfoRow
              icon={<Linkedin className="h-4 w-4" />}
              label="LinkedIn"
              value={visitor.linkedin_url}
              isLink
            />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={location || null} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Visited" value={visitor.created_at ? new Date(visitor.created_at).toLocaleString() : null} />
            <InfoRow icon={<Eye className="h-4 w-4" />} label="Page visited" value={visitor.url} />
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Industry" value={visitor.industry} />
            <InfoRow icon={<Users className="h-4 w-4" />} label="Employees" value={visitor.employee_count_range || (visitor.employee_count_exact ? String(visitor.employee_count_exact) : null)} />
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Revenue" value={visitor.revenue_range} />
            <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Funding" value={visitor.funding_stage} />
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Total Funding" value={visitor.funding_total ? `$${(visitor.funding_total / 1_000_000).toFixed(1)}M` : null} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="HQ" value={hqLocation || null} />
            <InfoRow
              icon={<Linkedin className="h-4 w-4" />}
              label="Company LinkedIn"
              value={visitor.company_linkedin_url}
              isLink
            />
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={visitor.website} isLink />
          </CardContent>
        </Card>

        {/* Description */}
        {visitor.description && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">About the Company</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{visitor.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Technologies */}
        {visitor.technologies && visitor.technologies.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-500" />
                Technologies ({visitor.technologies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {visitor.technologies.map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resolution Details */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" />
              Resolution Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Confidence" value={`${Math.round(visitor.confidence * 100)}%`} />
              <StatBox label="Person Status" value={visitor.person_resolution_status || "—"} />
              <StatBox label="ID Method" value={visitor.person_identification_method || "—"} />
              <StatBox label="Account Score" value={visitor.account_score != null ? String(visitor.account_score) : "—"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  isLink,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  isLink?: boolean
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-400">{icon}</span>
        <span className="text-slate-400 font-medium">{label}:</span>
        <span className="text-slate-300 italic">Not available</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-500">{icon}</span>
      <span className="text-slate-500 font-medium">{label}:</span>
      {isLink ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline truncate max-w-[280px]"
        >
          {value}
        </a>
      ) : (
        <span className="text-slate-800 font-semibold truncate max-w-[280px]">{value}</span>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  )
}
