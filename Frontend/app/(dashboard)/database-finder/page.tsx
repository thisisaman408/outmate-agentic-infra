"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Sparkles,
  Target,
  Building2,
  Users,
  DollarSign,
  MapPin,
  Briefcase,
  TrendingUp,
  Loader2,
} from "lucide-react"

import { LeadsTable } from "@/components/leads/leads-table"
import type { Lead } from "@/lib/api/leads"

export default function DatabaseFinderPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [intent, setIntent] = useState<"business" | "prospect">("business") // Track intent
  const [tamPreview, setTamPreview] = useState({ count: 0, cost: 0 })

  const handleNaturalSearch = async () => {
    setIsSearching(true)
    setResults([]) // Clear previous results
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/explorium/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: naturalLanguageQuery }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      console.log('API Response:', data);

      const searchIntent = data.intent || "business";
      setIntent(searchIntent);

      const rawList = data.results?.data || [];
      const totalCount = data.results?.total_results || rawList.length;

      let mappedResults = [];

      const fallbackIndustry = data.parsed_filters?.industry || data.filters_applied?.website_keywords?.values?.[0] || data.filters_applied?.linkedin_category?.values?.[0] || data.filters_applied?.industry?.values?.[0] || "N/A";

      if (searchIntent === "prospect") {
        mappedResults = rawList.map((item: any, index: number) => {
          // Location: City + Country only, ensure strings
          const cleanLoc = [item.city, item.country_name]
            .filter(s => typeof s === 'string' && s.trim().length > 0)
            .join(", ");

          // Truncate Title: max 7 words
          const title = item.job_title || "Unknown Title";
          const truncatedTitle = title.split(' ').length > 7
            ? title.split(' ').slice(0, 7).join(' ') + '...'
            : title;

          return {
            id: item.prospect_id || `lead-${index}`,
            companyName: item.company_name || "Unknown Company",
            industry: fallbackIndustry, // Use filter-based fallback
            employees: "N/A",
            contactName: item.full_name || `${item.first_name} ${item.last_name}`.trim() || "Unknown Contact",
            title: truncatedTitle,
            email: item.professional_email_hashed ? "Reveal to unlock" : "Reveal to unlock",
            phone: "Reveal to unlock",
            location: cleanLoc || "N/A",
            techStack: item.skills ? item.skills.slice(0, 3) : [],
            linkedin: item.linkedin ? item.linkedin.replace(/^https?:\/\//, '') : undefined,
            experience: item.experience || [],
            signalsCount: (item.experience?.length || 0) > 5 ? 5 : 2,
            score: Math.floor(Math.random() * 15 + 85),
            status: "new",
            addedAt: new Date().toISOString()
          };
        });
      } else {
        // Map to Business Card structure
        mappedResults = rawList.map((item: any) => {
          console.log("Processing Business Item:", item); // Debug

          // Location Logic based on User provided JSON keys: 'city_name', 'region', 'country_name'
          const locParts = [item.city_name, item.region, item.country_name].filter(Boolean);
          let loc = locParts.length > 0 ? locParts.join(", ") : "N/A";

          // Fallback for location if nested object used
          if (loc === "N/A" && item.headquarters_address && typeof item.headquarters_address === 'object') {
            loc = [item.headquarters_address.city, item.headquarters_address.country].filter(Boolean).join(", ");
          }

          // Extract numeric score if available, otherwise mock based on data richness
          const score = item.match_score || (item.business_description ? 92 : 75);

          // Intent logic: check for 'business_intent_topics' or high score
          const isHighIntent = (item.business_intent_topics && item.business_intent_topics.length > 0) || score > 90;

          return {
            id: item.business_id || Math.random(),
            name: item.name || item.business_name || item.company_name || "Unknown Company",
            // Prefer naics/sic description for industry if available
            industry: item.naics_description || item.sic_code_description || item.primary_industry || item.industry || "N/A",
            // Specific keys from user log: number_of_employees_range
            employees: item.number_of_employees_range || item.company_size || item.size_range || "N/A",
            // Specific keys from user log: yearly_revenue_range
            revenue: item.yearly_revenue_range || item.revenue_range || item.company_revenue || "N/A",
            location: loc, // e.g. "menlo park, california, united states"
            score: score,
            isHighIntent: isHighIntent // Pass this flag to UI
          };
        });
      }

      setResults(mappedResults);

      setTamPreview({
        count: totalCount,
        cost: mappedResults.length * 0.1
      });

    } catch (error) {
      console.error("Search Error:", error);
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Database Finder</h1>
        <p className="text-muted-foreground">Build your TAM and discover net-new companies with AI-powered search</p>
      </div>

      <Tabs defaultValue="natural" className="w-full">
        {/* ... existing TabsList ... */}
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="natural">
            <Sparkles className="mr-2 h-4 w-4" />
            Natural Language
          </TabsTrigger>
          <TabsTrigger value="filters">
            <Target className="mr-2 h-4 w-4" />
            Advanced Filters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="natural" className="space-y-6">
          <Card className="glass-card">
            {/* ... existing Search Input Card ... */}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Describe Your Ideal Customer Profile
              </CardTitle>
              <CardDescription>
                Use natural language to build your TAM. Example: "SaaS companies in the USA" or "Marketing Managers in Tech"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g., Find me B2B SaaS companies in North America... OR Find me VP of Sales in Fintech companies..."
                className="min-h-[120px] resize-none"
                value={naturalLanguageQuery}
                onChange={(e) => setNaturalLanguageQuery(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  AI will automatically build filters and find matching companies or people
                </div>
                <Button onClick={handleNaturalSearch} disabled={isSearching || !naturalLanguageQuery}>
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search Database
                    </>
                  )}
                </Button>
              </div>

              {tamPreview.count > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">TAM Preview</p>
                      <p className="text-2xl font-bold text-primary">{tamPreview.count.toLocaleString()} {intent === "prospect" ? "people" : "companies"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Estimated Cost</p>
                      <p className="text-lg font-semibold">{tamPreview.cost} credits</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {results.length > 0 && (
            intent === "prospect" ? (
              <LeadsTable leads={results as Lead[]} isLoading={false} />
            ) : (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Preview Results</CardTitle>
                  <CardDescription>Showing first {results.length} companies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.map((company) => (
                      <div
                        key={company.id}
                        className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{company.name}</h3>
                              <p className="text-sm text-muted-foreground">{company.industry}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Score: {company.score}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{company.employees}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>{company.revenue}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{company.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`h-4 w-4 ${company.isHighIntent ? "text-primary" : "text-muted-foreground/50"}`} />
                            <span className={company.isHighIntent ? "text-primary" : "text-muted-foreground/50"}>
                              {company.isHighIntent ? "High Intent" : "Standard"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1">
                      <Users className="mr-2 h-4 w-4" />
                      Pull All {tamPreview.count.toLocaleString()} Companies
                    </Button>
                    <Button variant="outline">Save Segment</Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>

        <TabsContent value="filters" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Advanced Filters</CardTitle>
              <CardDescription>Build your ICP with precise criteria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saas">SaaS</SelectItem>
                      <SelectItem value="fintech">Fintech</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Employee Count</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10</SelectItem>
                      <SelectItem value="11-50">11-50</SelectItem>
                      <SelectItem value="51-200">51-200</SelectItem>
                      <SelectItem value="201-500">201-500</SelectItem>
                      <SelectItem value="501+">501+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Revenue Range</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1m">$0-$1M</SelectItem>
                      <SelectItem value="1-10m">$1M-$10M</SelectItem>
                      <SelectItem value="10-50m">$10M-$50M</SelectItem>
                      <SelectItem value="50-100m">$50M-$100M</SelectItem>
                      <SelectItem value="100m+">$100M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input placeholder="e.g., United States, Europe" />
                </div>

                <div className="space-y-2">
                  <Label>Technologies Used</Label>
                  <Input placeholder="e.g., Salesforce, HubSpot, AWS" />
                </div>

                <div className="space-y-2">
                  <Label>Funding Stage</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seed">Seed</SelectItem>
                      <SelectItem value="series-a">Series A</SelectItem>
                      <SelectItem value="series-b">Series B</SelectItem>
                      <SelectItem value="series-c">Series C+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Search className="mr-2 h-4 w-4" />
                  Build TAM
                </Button>
                <Button variant="outline">Reset Filters</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Saved Audiences
          </CardTitle>
          <CardDescription>Quick access to your frequently used segments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["US SaaS - High Intent", "EU Fintech - Series B", "Healthcare - Expanding"].map((segment, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors cursor-pointer"
              >
                <h4 className="font-medium mb-1">{segment}</h4>
                <p className="text-sm text-muted-foreground mb-3">{(Math.random() * 10000).toFixed(0)} companies</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  Load Segment
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
