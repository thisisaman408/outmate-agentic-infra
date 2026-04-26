"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Building2, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CompanyData {
  id: string
  name: string
  domain: string
  website?: string
  logo_url?: string
  description?: string
  industry?: string
  linkedin_industry_category?: string
  company_type?: string
  founded_year?: number
  employee_count?: number
  employee_count_exact?: number
  employee_count_range?: string
  employee_growth_6m_percent?: number
  employee_growth_12m_percent?: number
  growth_category?: string
  revenue_range?: string
  revenue_exact?: number
  funding_stage?: string
  funding_total?: number
  last_funding_date?: string
  has_recent_funding?: boolean
  headquarters_country?: string
  headquarters_state?: string
  headquarters_city?: string
  street?: string
  zip_code?: string
  [key: string]: any
}

interface Props {
  companies: CompanyData[]
  isLoading: boolean
  hasSearched: boolean
  showAiColumns?: boolean
  viewProfileBasePath?: string
  tableId?: string
  onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => Promise<void>
  onWaterfallResult?: (companyId: string, field: 'email' | 'phone', result: any) => void
  enrichCache?: Record<string, any>
  enrichingRows?: Record<string, boolean>
  waterfallAttempts?: Record<string, any>
  revealedEmail?: Record<string, string>
  revealedPhone?: Record<string, string>
  onSelectionChange?: (companies: CompanyData[]) => void
}

/* ─── helper constants & functions ─── */

const AVATAR_COLORS = [
  "bg-purple-500", "bg-green-500", "bg-red-500", "bg-blue-500",
  "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500",
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatEmployeeRange(company: CompanyData): string {
  if (company.employee_count_range) return company.employee_count_range
  const count = company.employee_count_exact ?? company.employee_count
  if (typeof count === "number") {
    if (count < 50) return "1–50"
    if (count < 200) return "50–200"
    if (count < 500) return "200–500"
    if (count < 1000) return "500–1k"
    if (count < 3000) return "1k–3k"
    if (count < 5000) return "3k–5k"
    if (count < 7000) return "4k–7k"
    if (count < 10000) return "5k–10k"
    return "10k+"
  }
  return "—"
}

const FUNDING_COLORS: Record<string, string> = {
  "Pre-seed": "bg-gray-100 text-gray-700 border-gray-200",
  "Seed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Series A": "bg-green-50 text-green-700 border-green-200",
  "Series B": "bg-blue-50 text-blue-700 border-blue-200",
  "Series C": "bg-amber-50 text-amber-700 border-amber-200",
  "Series D": "bg-sky-50 text-sky-700 border-sky-200",
  "Series D+": "bg-sky-50 text-sky-700 border-sky-200",
  "Series E": "bg-purple-50 text-purple-700 border-purple-200",
  "Series F": "bg-violet-50 text-violet-700 border-violet-200",
  "Public": "bg-green-50 text-green-700 border-green-300",
  "IPO": "bg-green-50 text-green-700 border-green-300",
  "Acquired": "bg-slate-50 text-slate-700 border-slate-200",
}

function fundingBadge(stage?: string) {
  if (!stage) return <span className="text-muted-foreground">—</span>
  const colors = FUNDING_COLORS[stage] || "bg-muted text-muted-foreground border-border"
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap", colors)}>
      {stage}
    </span>
  )
}

function formatHQ(company: CompanyData): string {
  const city = company.headquarters_city
  if (!city) return "—"
  const abbrevs: Record<string, string> = {
    "San Francisco": "SF",
    "New York": "NY",
    "New York City": "NY",
    "Los Angeles": "LA",
    "Washington": "DC",
    "Washington D.C.": "DC",
  }
  return abbrevs[city] || city
}

function deriveSignal(company: CompanyData): { icon: string; label: string; className: string } | null {
  if (company.has_recent_funding) return { icon: "🔥", label: "Funding", className: "bg-orange-50 text-orange-700 border-orange-200" }
  if (company.job_openings_count && company.job_openings_count > 5) return { icon: "👥", label: "Hiring", className: "bg-blue-50 text-blue-700 border-blue-200" }
  if (company.is_tech_heavy) return { icon: "⬆", label: "Tech", className: "bg-green-50 text-green-700 border-green-200" }
  if (company.web_traffic && company.web_traffic > 0) return { icon: "👁", label: "Visit", className: "bg-purple-50 text-purple-700 border-purple-200" }
  if (company.employee_growth_6m_percent && company.employee_growth_6m_percent > 10) return { icon: "📰", label: "News", className: "bg-yellow-50 text-yellow-700 border-yellow-200" }
  return null
}

function formatHiring(count?: number) {
  if (!count || count === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
      +{count} roles
    </span>
  )
}

function scoreBar(score: number) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-400"
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[44px] h-[4px] rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-bold text-foreground">{score}</span>
    </div>
  )
}

function intentDots(n: number) {
  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[6px] h-[6px] rounded-full",
            i <= n ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}

function deriveIcpScore(company: CompanyData): number {
  if (company.data_quality_score && company.data_quality_score > 0) {
    return Math.min(99, Math.round(company.data_quality_score * 10))
  }
  let score = 50
  if (company.industry) score += 5
  if (company.employee_count_range || company.employee_count_exact) score += 5
  if (company.funding_stage) score += 8
  if (company.headquarters_city) score += 4
  if (company.technologies && company.technologies.length > 0) score += 6
  if (company.has_recent_funding) score += 8
  if (company.job_openings_count && company.job_openings_count > 0) score += 5
  if (company.description) score += 3
  return Math.min(99, score)
}

function deriveIntentLevel(company: CompanyData): number {
  let level = 0
  if (company.has_recent_funding) level++
  if (company.job_openings_count && company.job_openings_count > 0) level++
  if (company.web_traffic && company.web_traffic > 0) level++
  if (company.employee_growth_6m_percent && company.employee_growth_6m_percent > 5) level++
  if (company.is_tech_heavy) level++
  return Math.min(5, level) // Remove Math.max to allow 0 when no criteria met
}

function deriveAiBrief(company: CompanyData): { label: string; className: string } {
  const score = deriveIcpScore(company)
  if (score >= 80) return { label: "Ready ↗", className: "text-green-600 font-semibold cursor-pointer" }
  if (score >= 60) return { label: "Generate", className: "text-blue-600 font-medium cursor-pointer" }
  return { label: "Low priority", className: "text-muted-foreground" }
}

/* ─── main component ─── */

export function CompaniesResultsTable({
  companies,
  isLoading,
  hasSearched,
  showAiColumns = false,
  viewProfileBasePath = "/leads/companies",
  tableId,
  onEnrichReveal,
  onWaterfallResult,
  enrichCache = {},
  enrichingRows = {},
  waterfallAttempts = {},
  onSelectionChange,
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [revealedEmail, setRevealedEmail] = useState<Record<string, string>>(revealedEmail ?? {})
  const [revealedPhone, setRevealedPhone] = useState<Record<string, string>>(revealedPhone ?? {})

  const handleSelectCompany = (companyId: string) => {
    const newSelected = new Set(selectedCompanies)
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId)
    } else {
      newSelected.add(companyId)
    }
    setSelectedCompanies(newSelected)
    onSelectionChange?.(companies.filter(c => newSelected.has(c.id)))
  }

  const handleSelectAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set())
      onSelectionChange?.([])
    } else {
      setSelectedCompanies(new Set(companies.map(c => c.id)))
      onSelectionChange?.([...companies])
    }
  }

  if (!hasSearched) {
    return (
      <div className="border border-dashed rounded-lg">
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Search Performed</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Use the filters on the left to search for companies. Results will appear here.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Searching companies...</span>
          </div>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="border border-dashed rounded-lg">
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Companies Found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Try adjusting your filters or search criteria to find more companies.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table className={showAiColumns ? "min-w-[1400px]" : "min-w-[900px]"}>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10">
              <Checkbox
                checked={selectedCompanies.size === companies.length && companies.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Company</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Industry</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Employees</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Funding</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">HQ</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Tech Stack</TableHead>
            {showAiColumns && (
              <TableHead className="text-[10px] font-black uppercase tracking-wider">
                <span className="flex items-center gap-1">⚡ Signal</span>
              </TableHead>
            )}
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Hiring</TableHead>
            {showAiColumns && (
              <>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">ICP Score</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Intent</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">AI Brief</TableHead>
              </>
            )}
            <TableHead className="text-[10px] font-black uppercase tracking-wider">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            const companyId = company.domain || company.id
            const signal = deriveSignal(company)
            const icpScore = deriveIcpScore(company)
            const intent = deriveIntentLevel(company)
            const brief = deriveAiBrief(company)

            return (
              <TableRow key={company.id} data-state={selectedCompanies.has(company.id) ? "selected" : undefined}>
                {/* Checkbox */}
                <TableCell>
                  <Checkbox
                    checked={selectedCompanies.has(company.id)}
                    onCheckedChange={() => handleSelectCompany(company.id)}
                  />
                </TableCell>

                {/* Company: avatar + name + domain */}
                <TableCell>
                  <div className="flex items-center gap-2.5 min-w-[150px]">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
                      getAvatarColor(company.name)
                    )}>
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{company.name}</div>
                      {company.domain && (
                        <div className="text-[11px] text-muted-foreground truncate">{company.domain}</div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Industry */}
                <TableCell>
                  <span className="text-xs text-muted-foreground">{company.industry || "—"}</span>
                </TableCell>

                {/* Employees */}
                <TableCell>
                  <span className="text-xs font-medium">{formatEmployeeRange(company)}</span>
                </TableCell>

                {/* Funding */}
                <TableCell>{fundingBadge(company.funding_stage)}</TableCell>

                {/* HQ */}
                <TableCell>
                  <span className="text-xs font-medium">{formatHQ(company)}</span>
                </TableCell>

                {/* Tech Stack */}
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap max-w-[130px]">
                    {(company.technologies || []).slice(0, 2).map((tech: string) => (
                      <span key={tech} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border/50 whitespace-nowrap">
                        {tech}
                      </span>
                    ))}
                    {(!company.technologies || company.technologies.length === 0) && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </TableCell>

                {/* Signal (AI column) */}
                {showAiColumns && (
                  <TableCell>
                    {signal ? (
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap", signal.className)}>
                        {signal.icon} {signal.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                )}

                {/* Hiring */}
                <TableCell>{formatHiring(company.job_openings_count)}</TableCell>

                {/* ICP Score (AI column) */}
                {showAiColumns && <TableCell>{scoreBar(icpScore)}</TableCell>}

                {/* Intent (AI column) */}
                {showAiColumns && <TableCell>{intentDots(intent)}</TableCell>}

                {/* AI Brief (AI column) */}
                {showAiColumns && (
                  <TableCell>
                    <span 
                      className={cn("text-[11px] whitespace-nowrap", brief.className)}
                      onClick={() => {
                        if (brief.label.includes("Ready")) {
                          toast.info("AI Brief generation started for this company")
                        } else if (brief.label.includes("Generate")) {
                          toast.info("Generating AI Brief for this company...")
                        }
                      }}
                    >
                      {brief.label}
                    </span>
                  </TableCell>
                )}

                {/* +AI Column - Enriched Data Display */}
                {showAiColumns && (
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {/* Display Enriched Email and Phone Data */}
                      {(revealedEmail[companyId] || company.email) && (
                        <div className="flex flex-col gap-1 text-xs text-green-600 border-t pt-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Email:</span>
                            <span className="truncate max-w-[150px]">{revealedEmail[companyId] || company.email}</span>
                          </div>
                        </div>
                      )}
                      {(revealedPhone[companyId] || company.phone) && (
                        <div className="flex flex-col gap-1 text-xs text-green-600 border-t pt-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Phone:</span>
                            <span>{revealedPhone[companyId] || company.phone}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Enrichment Buttons */}
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEnrichReveal?.(companyId, 'email')}
                          disabled={enrichingRows[companyId] || !!revealedEmail[companyId]}
                          className="text-xs"
                        >
                          {enrichingRows[companyId] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              {revealedEmail[companyId] || company.email ? 'View Email' : 'Get Email'}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEnrichReveal?.(companyId, 'phone')}
                          disabled={enrichingRows[companyId] || !!revealedPhone[companyId]}
                          className="text-xs"
                        >
                          {enrichingRows[companyId] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              {revealedPhone[companyId] || company.phone ? 'View Phone' : 'Get Phone'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                )}


                {/* Action */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-medium gap-1">
                        Actions <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onEnrichReveal?.(companyId, 'email')}
                        disabled={enrichingRows[companyId]}
                      >
                        {enrichingRows[companyId] ? "Loading..." : "Get Email"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEnrichReveal?.(companyId, 'phone')}
                        disabled={enrichingRows[companyId]}
                      >
                        {enrichingRows[companyId] ? "Loading..." : "Get Phone"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const url = company.website || `https://${company.domain}`;
                          // Validate and format the URL
                          if (url) {
                            try {
                              const urlObj = new URL(url);
                              window.open(urlObj.href, '_blank');
                            } catch (error) {
                              // If URL parsing fails, try to fix common issues
                              let fixedUrl = url;
                              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                fixedUrl = `https://${url}`;
                              }
                              // Remove trailing slashes and ensure proper format
                              fixedUrl = fixedUrl.replace(/\/+/g, '/').replace(/\/$/, '');
                              try {
                                const urlObj = new URL(fixedUrl);
                                window.open(urlObj.href, '_blank');
                              } catch (secondError) {
                                toast.error(`Invalid website URL: ${company.domain}`);
                              }
                            }
                          } else {
                            toast.error('No website URL available for this company');
                          }
                        }}
                        disabled={!company.website && !company.domain}
                      >
                        Visit Website
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => company.linkedin_url && window.open(company.linkedin_url, '_blank')}
                        disabled={!company.linkedin_url}
                      >
                        View LinkedIn
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
