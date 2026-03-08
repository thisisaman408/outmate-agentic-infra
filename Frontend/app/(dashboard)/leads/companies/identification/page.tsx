"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { 
  Search, 
  Building2, 
  Globe, 
  Linkedin, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react"

interface IdentificationResult {
  company_id: number
  company_name: string
  linkedin_profile_name: string
  company_slug: string
  is_full_domain_match: boolean
  total_rows: number
  company_website_domain: string
  company_website: string
  linkedin_profile_url: string
  linkedin_profile_id: string
  linkedin_headcount: number
  employee_count_range: string
  estimated_revenue_lower_bound_usd: number
  estimated_revenue_upper_bound_usd: number
  hq_country: string
  headquarters: string
  linkedin_industries: string[]
  acquisition_status: string
  linkedin_logo_url: string
  crunchbase_profile_url: string
  crunchbase_total_investment_usd: number
}

export default function CompanyIdentificationPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<IdentificationResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  
  // Form states
  const [companyName, setCompanyName] = useState("")
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [crunchbaseUrl, setCrunchbaseUrl] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [exactMatch, setExactMatch] = useState(false)
  const [count, setCount] = useState("10")

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setResults([])
    setSearched(true)

    try {
      const requestBody: any = {
        exact_match: exactMatch,
        count: parseInt(count)
      }

      // Add the provided identifier
      if (companyName) requestBody.query_company_name = companyName
      else if (companyWebsite) requestBody.query_company_website = companyWebsite
      else if (linkedinUrl) requestBody.query_company_linkedin_url = linkedinUrl
      else if (crunchbaseUrl) requestBody.query_company_crunchbase_url = crunchbaseUrl
      else if (companyId) requestBody.query_company_id = companyId
      else {
        setError("Please provide at least one identifier")
        setLoading(false)
        return
      }

      const response = await fetch('http://localhost:8000/api/v1/crustdata/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const normalizedResults = Array.isArray(data)
        ? data.filter((item: any) => {
            if (!item || typeof item !== "object") return false
            return Boolean(
              item.company_name ||
              item.company_website_domain ||
              item.company_website ||
              item.linkedin_profile_url ||
              item.company_id
            )
          })
        : []

      setResults(normalizedResults as IdentificationResult[])
      if (normalizedResults.length === 0) {
        setError("No results found")
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Identification API</h1>
          <p className="text-muted-foreground">Identify companies using various identifiers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Parameters
              </CardTitle>
              <CardDescription>
                Provide at least one company identifier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g., Salesforce"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website Domain</Label>
                <Input
                  id="website"
                  placeholder="e.g., salesforce.com"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input
                  id="linkedin"
                  placeholder="e.g., https://linkedin.com/company/salesforce"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crunchbase">Crunchbase URL</Label>
                <Input
                  id="crunchbase"
                  placeholder="e.g., https://crunchbase.com/organization/salesforce"
                  value={crunchbaseUrl}
                  onChange={(e) => setCrunchbaseUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-id">Company ID</Label>
                <Input
                  id="company-id"
                  placeholder="e.g., 12345"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Number of Results</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="25"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="exact-match"
                  checked={exactMatch}
                  onCheckedChange={setExactMatch}
                />
                <Label htmlFor="exact-match">Exact Match</Label>
              </div>

              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Identify Company
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
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Results ({results.length})
                </span>
                {results.length > 0 && (
                  <Badge variant="secondary">
                    {results[0].total_rows} total matches
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searched ? "No results found." : "No results yet. Try searching for a company."}</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              <div className="space-y-4">
                {results.map((result) => (
                  <Card key={result.company_id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          {result.linkedin_logo_url && (
                            <img
                              src={result.linkedin_logo_url}
                              alt={result.company_name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{result.company_name}</h3>
                              {result.is_full_domain_match && (
                                <Badge variant="default" className="text-xs">
                                  Exact Match
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Globe className="h-4 w-4" />
                                {result.company_website_domain}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {result.employee_count_range}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={result.linkedin_profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                              >
                                <Linkedin className="h-4 w-4" />
                                LinkedIn
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              {result.crunchbase_profile_url && (
                                <a
                                  href={result.crunchbase_profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"
                                >
                                  Crunchbase
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(Array.isArray(result.linkedin_industries) ? result.linkedin_industries : []).slice(0, 3).map((industry) => (
                                <Badge key={industry} variant="outline" className="text-xs">
                                  {industry}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">ID:</span> {result.company_id}
                          </div>
                          {result.crunchbase_total_investment_usd > 0 && (
                            <div className="text-sm font-medium">
                              {formatCurrency(result.crunchbase_total_investment_usd)}
                            </div>
                          )}
                          {result.estimated_revenue_lower_bound_usd > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Revenue: {formatCurrency(result.estimated_revenue_lower_bound_usd)} - {formatCurrency(result.estimated_revenue_upper_bound_usd)}
                            </div>
                          )}
                        </div>
                      </div>
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
