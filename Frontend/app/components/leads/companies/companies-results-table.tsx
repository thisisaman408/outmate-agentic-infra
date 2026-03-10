"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, Building2, Users, DollarSign, TrendingUp, Zap, Loader2, Lock } from "lucide-react"

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
  viewProfileBasePath?: string
  onEnrichReveal?: (companyId: string, field: 'email' | 'phone') => Promise<void>
  onWaterfallResult?: (companyId: string, field: 'email' | 'phone', result: any) => void
  enrichCache?: Record<string, any>
  enrichingRows?: Record<string, boolean>
}

export function CompaniesResultsTable({
  companies,
  isLoading,
  hasSearched,
  viewProfileBasePath = "/leads/companies",
  onEnrichReveal,
  onWaterfallResult,
  enrichCache = {},
  enrichingRows = {},
}: Props) {
  const [revealedEmail, setRevealedEmail] = useState<Record<string, boolean>>({})
  const [revealedPhone, setRevealedPhone] = useState<Record<string, boolean>>({})

  const formatCreditsLabel = (value?: number, fallback?: string) => {
    if (typeof value === "number") {
      return `${value} credit${value === 1 ? "" : "s"}`
    }
    return fallback || "1 credit"
  }

  const handleRevealField = (companyId: string, field: "email" | "phone") => {
    if (field === "email") {
      setRevealedEmail((prev) => ({ ...prev, [companyId]: true }))
    } else {
      setRevealedPhone((prev) => ({ ...prev, [companyId]: true }))
    }
    onEnrichReveal?.(companyId, field)
  }
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())

  const handleSelectCompany = (companyId: string) => {
    const newSelected = new Set(selectedCompanies)
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId)
    } else {
      newSelected.add(companyId)
    }
    setSelectedCompanies(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set())
    } else {
      setSelectedCompanies(new Set(companies.map(c => c.id)))
    }
  }

  if (!hasSearched) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Search Performed</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Use the filters on the left to search for companies. Results will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Searching companies...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (companies.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Companies Found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Try adjusting your filters or search criteria to find more companies.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Search Results ({companies.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedCompanies.size === companies.length ? "Deselect All" : "Select All"}
            </Button>
            {selectedCompanies.size > 0 && (
              <Badge variant="secondary">
                {selectedCompanies.size} selected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.size === companies.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Funding</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const companyId = company.domain || company.id
                const waterfallEntry = enrichCache?.[companyId] || {}
                const waterfallEmail = waterfallEntry?.email
                const waterfallPhone = waterfallEntry?.phone
                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(company.id)}
                        onChange={() => handleSelectCompany(company.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {company.logo_url && (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="h-8 w-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">{company.name}</div>
                          {company.domain && (
                            <div className="text-sm text-muted-foreground">
                              {company.domain}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-32">
                        <div className="text-sm">{company.industry}</div>
                        {company.linkedin_industry_category && (
                          <div className="text-xs text-muted-foreground">
                            {company.linkedin_industry_category}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">
                          {company.employee_count_range ||
                            (company.employee_count && `${company.employee_count}`) ||
                            "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm">
                          {company.revenue_range || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {company.funding_stage && (
                          <Badge variant="outline" className="text-xs">
                            {company.funding_stage}
                          </Badge>
                        )}
                        {company.funding_total && (
                          <span className="text-xs text-muted-foreground">
                            ${company.funding_total.toLocaleString()}M
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {company.headquarters_city && (
                          <div>{company.headquarters_city}</div>
                        )}
                        {company.headquarters_state && (
                          <div className="text-muted-foreground">
                            {company.headquarters_state}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {company.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{company.email}</span>
                            <div className="text-xs text-green-600 font-medium">✓ Company</div>
                          </div>
                        )}
                        {waterfallEmail?.email && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{waterfallEmail.email}</span>
                              <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Cost: {formatCreditsLabel(waterfallEmail?.credits_consumed)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => handleRevealField(companyId, "email")}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              Tap to Reveal
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600"
                              onClick={() => onEnrichReveal?.(companyId, "email")}
                              title={`Waterfall zap: ${formatCreditsLabel(waterfallEmail?.credits_consumed)}`}
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Reveal cost: {formatCreditsLabel(1)} · Waterfall zap: {formatCreditsLabel(waterfallEmail?.credits_consumed)}
                          </span>
                        </div>
                        {revealedEmail[companyId] && enrichingRows[companyId] && (
                          <span className="text-[10px] text-muted-foreground">Enriching…</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {company.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{company.phone}</span>
                            <div className="text-xs text-green-600 font-medium">✓ Company</div>
                          </div>
                        )}
                        {waterfallPhone?.phone && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{waterfallPhone.phone}</span>
                              <div className="text-xs text-green-600 font-medium">✓ Waterfall</div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Cost: {formatCreditsLabel(waterfallPhone?.credits_consumed)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => handleRevealField(companyId, "phone")}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              Tap to Reveal
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600"
                              onClick={() => onEnrichReveal?.(companyId, "phone")}
                              title={`Waterfall zap: ${formatCreditsLabel(waterfallPhone?.credits_consumed)}`}
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Reveal cost: {formatCreditsLabel(1)} · Waterfall zap: {formatCreditsLabel(waterfallPhone?.credits_consumed)}
                          </span>
                        </div>
                        {revealedPhone[companyId] && enrichingRows[companyId] && (
                          <span className="text-[10px] text-muted-foreground">Enriching…</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`${viewProfileBasePath}/${company.domain || company.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
