"use client"

import { useState, useEffect, useRef } from "react"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, 
  Building2, 
  Globe, 
  Linkedin, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  DollarSign,
  MapPin,
  Calendar
} from "lucide-react"

interface EnrichmentResult {
  company_id?: number
  company_name?: string
  company_website_domain?: string
  company_website_url?: string
  company_linkedin_url?: string
  linkedin_profile_name?: string
  description?: string
  industry?: string
  company_type?: string
  year_founded?: number
  headquarters?: string
  hq_country?: string
  hq_state?: string
  hq_city?: string
  employee_count_range?: string
  linkedin_headcount?: number
  estimated_revenue_lower_bound_usd?: number
  estimated_revenue_upper_bound_usd?: number
  linkedin_logo_url?: string
  linkedin_followers?: number
  specialties?: string[]
  technologies?: string[]
  funding_and_investment?: {
    last_funding_round_type?: string
    last_funding_date?: string
    crunchbase_total_investment_usd?: number
  }
  status?: string
  message?: string
}

export default function CompanyEnrichmentPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<EnrichmentResult[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [domains, setDomains] = useState("")
  const [names, setNames] = useState("")
  const [ids, setIds] = useState("")
  const [linkedinUrls, setLinkedinUrls] = useState("")
  const [fields, setFields] = useState("")
  const [exactMatch, setExactMatch] = useState(false)
  const [enrichRealtime, setEnrichRealtime] = useState(false)

  // ── Copilot automation agent bridge ──────────────────────────────────
  const copilotFilters = useCoPilotAgentStore(s => s.appliedFilters?.['company_enrichment'])
  const lastCopilotKeyRef = useRef('')

  const handleCopilotEnrich = async (cf: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const params = new URLSearchParams()
      if (cf.domains) params.append('company_domain', String(cf.domains))
      if (cf.company_names) params.append('company_name', String(cf.company_names))
      if (cf.company_ids) params.append('company_id', String(cf.company_ids))
      if (cf.profile_urls) params.append('company_linkedin_url', String(cf.profile_urls))
      if (cf.fields) params.append('fields', String(cf.fields))
      if (cf.exact_match) params.append('exact_match', 'true')
      if (cf.realtime) params.append('enrich_realtime', 'true')

      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${API}/api/v1/crustdata/enrich?${params.toString()}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setResults(Array.isArray(data) ? data : [data])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!copilotFilters || Object.keys(copilotFilters).length === 0) return
    const key = JSON.stringify(copilotFilters)
    if (key === lastCopilotKeyRef.current) return
    lastCopilotKeyRef.current = key

    if (copilotFilters.domains) setDomains(String(copilotFilters.domains))
    if (copilotFilters.company_names) setNames(String(copilotFilters.company_names))
    if (copilotFilters.company_ids) setIds(String(copilotFilters.company_ids))
    if (copilotFilters.profile_urls) setLinkedinUrls(String(copilotFilters.profile_urls))
    if (copilotFilters.fields) setFields(String(copilotFilters.fields))
    if (copilotFilters.exact_match !== undefined) setExactMatch(Boolean(copilotFilters.exact_match))
    if (copilotFilters.realtime !== undefined) setEnrichRealtime(Boolean(copilotFilters.realtime))

    handleCopilotEnrich(copilotFilters as Record<string, unknown>)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotFilters])
  // ─────────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const params = new URLSearchParams()
      
      if (domains) params.append('company_domain', domains)
      if (names) params.append('company_name', names)
      if (ids) params.append('company_id', ids)
      if (linkedinUrls) params.append('company_linkedin_url', linkedinUrls)
      if (fields) params.append('fields', fields)
      if (exactMatch) params.append('exact_match', 'true')
      if (enrichRealtime) params.append('enrich_realtime', 'true')

      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${API}/api/v1/crustdata/enrich?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Handle different response formats from Crustdata
      if (Array.isArray(data)) {
        setResults(data)
      } else if (data.status === 'enriching' || data.status === 'not_found') {
        setResults([data])
      } else {
        setResults([data])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(num)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Enrichment</h1>
          <p className="text-muted-foreground">Get detailed company information and firmographics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Enrichment Parameters
              </CardTitle>
              <CardDescription>
                Provide company identifiers for enrichment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domains">Company Domains</Label>
                <Textarea
                  id="domains"
                  placeholder="e.g., salesforce.com, microsoft.com&#10;(comma-separated, up to 25)"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="names">Company Names</Label>
                <Textarea
                  id="names"
                  placeholder="e.g., &quot;Salesforce, Inc.&quot;, &quot;Microsoft Corporation&quot;&#10;(comma-separated, up to 25)"
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ids">Company IDs</Label>
                <Input
                  id="ids"
                  placeholder="e.g., 12345,67890 (comma-separated)"
                  value={ids}
                  onChange={(e) => setIds(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin-urls">Profile URLs</Label>
                <Textarea
                  id="linkedin-urls"
                  placeholder="e.g., https://linkedin.com/company/salesforce&#10;(comma-separated, up to 25)"
                  value={linkedinUrls}
                  onChange={(e) => setLinkedinUrls(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fields">Fields (Optional)</Label>
                <Input
                  id="fields"
                  placeholder="e.g., headcount,funding_and_investment,web_traffic"
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Specify fields to include. Leave empty for default fields.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="exact-match"
                    checked={exactMatch}
                    onCheckedChange={setExactMatch}
                  />
                  <Label htmlFor="exact-match">Exact Match</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enrich-realtime"
                    checked={enrichRealtime}
                    onCheckedChange={setEnrichRealtime}
                  />
                  <Label htmlFor="enrich-realtime">Real-time Enrichment</Label>
                </div>
              </div>

              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Enrich Company
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Enrichment Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No enrichment results yet. Provide company identifiers and try enriching.</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      {result.status === 'enriching' ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                          <h3 className="font-semibold text-lg mb-2">Enrichment in Progress</h3>
                          <p className="text-muted-foreground">{result.message}</p>
                        </div>
                      ) : result.status === 'not_found' ? (
                        <div className="text-center py-8">
                          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
                          <h3 className="font-semibold text-lg mb-2">Company Not Found</h3>
                          <p className="text-muted-foreground">{result.message}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Company Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              {result.linkedin_logo_url && (
                                <img
                                  src={result.linkedin_logo_url}
                                  alt={result.company_name}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              )}
                              <div className="space-y-2">
                                <h3 className="font-semibold text-xl">{result.company_name}</h3>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-4 w-4" />
                                    {result.company_website_domain}
                                  </span>
                                  {result.industry && (
                                    <Badge variant="outline">{result.industry}</Badge>
                                  )}
                                </div>
                                {result.description && (
                                  <p className="text-sm text-muted-foreground max-w-2xl">
                                    {result.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {result.company_id && (
                              <Badge variant="secondary">
                                ID: {result.company_id}
                              </Badge>
                            )}
                          </div>

                          {/* Key Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {result.linkedin_headcount && (
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                                <div className="font-semibold">{formatNumber(result.linkedin_headcount)}</div>
                                <div className="text-xs text-muted-foreground">Employees</div>
                              </div>
                            )}
                            {result.estimated_revenue_lower_bound_usd && (
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                                <div className="font-semibold">
                                  {formatCurrency(result.estimated_revenue_lower_bound_usd)}+
                                </div>
                                <div className="text-xs text-muted-foreground">Revenue</div>
                              </div>
                            )}
                            {result.year_founded && (
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                                <div className="font-semibold">{result.year_founded}</div>
                                <div className="text-xs text-muted-foreground">Founded</div>
                              </div>
                            )}
                          </div>

                          {/* Additional Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {result.headquarters && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{result.headquarters}</span>
                              </div>
                            )}
                            {result.company_type && (
                              <div className="flex items-center gap-2 text-sm">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{result.company_type}</span>
                              </div>
                            )}
                          </div>

                          {/* Technologies and Specialties */}
                          {(result.technologies?.length || result.specialties?.length) && (
                            <div className="space-y-2">
                              {result.technologies && result.technologies.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-sm mb-2">Technologies</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {result.technologies.slice(0, 8).map((tech) => (
                                      <Badge key={tech} variant="outline" className="text-xs">
                                        {tech}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {result.specialties && result.specialties.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-sm mb-2">Specialties</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {result.specialties.slice(0, 6).map((specialty) => (
                                      <Badge key={specialty} variant="secondary" className="text-xs">
                                        {specialty}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Funding Info */}
                          {result.funding_and_investment && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Funding Information</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                {result.funding_and_investment.last_funding_round_type && (
                                  <div>
                                    <span className="text-muted-foreground">Stage:</span>
                                    <span className="ml-2 font-medium">
                                      {result.funding_and_investment.last_funding_round_type}
                                    </span>
                                  </div>
                                )}
                                {result.funding_and_investment.crunchbase_total_investment_usd && (
                                  <div>
                                    <span className="text-muted-foreground">Total Funding:</span>
                                    <span className="ml-2 font-medium">
                                      {formatCurrency(result.funding_and_investment.crunchbase_total_investment_usd)}
                                    </span>
                                  </div>
                                )}
                                {result.funding_and_investment.last_funding_date && (
                                  <div>
                                    <span className="text-muted-foreground">Last Funding:</span>
                                    <span className="ml-2 font-medium">
                                      {result.funding_and_investment.last_funding_date}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Links */}
                          <div className="flex items-center gap-4">
                            {result.company_linkedin_url && (
                              <a
                                href={result.company_linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                              >
                                <Linkedin className="h-4 w-4" />
                                Profile
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {result.company_website_url && (
                              <a
                                href={result.company_website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"
                              >
                                <Globe className="h-4 w-4" />
                                Website
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>


            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
