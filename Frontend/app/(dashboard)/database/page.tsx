"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Download,
  Loader2,
  Database,
  User,
  Building2,
  MapPin,
  Linkedin,
  Mail,
  ExternalLink,
  Sparkles,
  Globe,
  GraduationCap,
  Users,
  Twitter,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Phone,
} from "lucide-react"
import { databaseFinderApi, type DatabaseLead, type SearchMeta } from "@/lib/api/database-finder"

const LOCATIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "India",
  "Australia",
  "Singapore",
  "Netherlands",
  "Sweden",
]

function SeniorityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    "C-Suite": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    VP: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    Director: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    Manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Entry Level": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "Individual Contributor": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    Unknown: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colors[level] || colors.Unknown}`}>
      {level}
    </span>
  )
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{score}</span>
    </div>
  )
}

/** Truncate text with tooltip on hover */
type TCellProps = React.ComponentProps<typeof TableCell>

function TCell({ children, className = "", ...props }: TCellProps) {
  return (
    <TableCell className={`text-xs whitespace-nowrap ${className}`} {...props}>
      {children}
    </TableCell>
  )
}

function LinkCell({ href, label }: { href: string; label?: string }) {
  if (!href) return <span className="text-muted-foreground">—</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[140px] inline-block">
      {label || (href.length > 30 ? href.slice(0, 30) + "…" : href)}
    </a>
  )
}

export default function DatabasePage() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("United States")
  const [limit, setLimit] = useState(20)
  const [includeSignals, setIncludeSignals] = useState(true)

  const [leads, setLeads] = useState<DatabaseLead[]>([])
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [selectedLead, setSelectedLead] = useState<DatabaseLead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())
  const stopRowClick = (e: React.MouseEvent<HTMLElement>) => e.stopPropagation()

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({ title: "Enter a search term", description: "Company name, industry, or job title", variant: "destructive" })
      return
    }
    setIsSearching(true)
    setHasSearched(true)
    setLeads([])
    setMeta(null)
    try {
      const result = await databaseFinderApi.search(query, location, limit, includeSignals)
      const normalizedLeads = Array.isArray(result.data.leads)
        ? result.data.leads.slice(0, Math.max(0, limit))
        : []
      setLeads(normalizedLeads)
      setMeta(result.data.meta)
      toast({
        title: "Search complete",
        description: `Showing ${normalizedLeads.length} lead${normalizedLeads.length === 1 ? "" : "s"} in ${(result.data.meta.execution_time_ms / 1000).toFixed(1)}s`,
      })
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message || "Please try again", variant: "destructive" })
    } finally {
      setIsSearching(false)
    }
  }

  const handleEnrich = async (lead: DatabaseLead) => {
    if (!lead.linkedin_url) {
      toast({ title: "No LinkedIn URL", variant: "destructive" })
      return
    }
    setEnrichingIds((prev) => new Set(prev).add(lead.id))
    try {
      const result = await databaseFinderApi.enrich(lead.linkedin_url)
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? result.data : l)))
      if (selectedLead?.id === lead.id) setSelectedLead(result.data)
      toast({ title: "Enriched", description: `${lead.full_name} updated` })
    } catch (err: any) {
      toast({ title: "Enrichment failed", description: err.message, variant: "destructive" })
    } finally {
      setEnrichingIds((prev) => { const n = new Set(prev); n.delete(lead.id); return n })
    }
  }

  const handleExport = () => {
    if (leads.length === 0) return
    const headers = [
      "ID", "First Name", "Last Name", "Full Name", "Email", "Phone", "LinkedIn", "Twitter", "Website",
      "Title", "Seniority", "Department", "Organization", "Company Domain", "Company LinkedIn",
      "Industry", "Education", "Degree", "Summary", "Skills",
      "Location", "City", "State", "Country", "Language",
      "Connections", "Followers", "Mutual Connections",
      "Signals Count", "Signals Summary", "Engagement Score",
      "Source", "Search Query", "Quality Score", "Discovered At", "Data Completeness",
      "Status", "Enrichment Status",
    ]
    const rows = leads.map((l) => [
      l.id, l.first_name, l.last_name, l.full_name, l.email, l.phone, l.linkedin_url, l.twitter_url, l.website,
      l.title, l.seniority_level, l.department, l.organization_name, l.company_domain, l.company_linkedin_url,
      l.industry, l.education, l.education_degree, l.summary, (l.skills || []).join("; "),
      l.location, l.city, l.state, l.country, l.profile_language,
      String(l.connections_count), String(l.followers_count), String(l.mutual_connections),
      String(l.signals_count), l.signals_summary, String(l.engagement_score),
      l.source, l.search_query, String(l.quality_score), l.discovered_at, String(l.data_completeness),
      l.status, l.enrichment_status,
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `database_leads_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Exported", description: `${leads.length} leads exported to CSV (${headers.length} columns)` })
  }

  const openDetail = (lead: DatabaseLead) => { setSelectedLead(lead); setDetailOpen(true) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-8 w-8" /> Outmate Database
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover leads with AI-powered intelligence. Search by company, industry, or job title.
          </p>
        </div>
        {leads.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {/* Search Panel */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>Enter a company name, industry term, or job title to discover leads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Search Query</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder='e.g. "Hotel Outreach Company", "SaaS Sales Director", "Tesla"...'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-1.5 block">Location</label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <label className="text-sm font-medium mb-1.5 block">Limit</label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 30, 50, 100, 150, 200, 300].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isSearching} className="h-10">
              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={includeSignals} onChange={(e) => setIncludeSignals(e.target.checked)} className="rounded" />
              <Sparkles className="h-3.5 w-3.5" /> Include signals (company + person news)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Meta bar */}
      {meta && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{meta.total_results} leads found</span>
          <span className="opacity-40">|</span>
          <span>{(meta.execution_time_ms / 1000).toFixed(1)}s</span>
          <span className="opacity-40">|</span>
          <span>Query: &quot;{meta.query}&quot;</span>
          <span className="opacity-40">|</span>
          <span>{meta.location}</span>
          <span className="opacity-40">|</span>
          <span className="font-medium">30 columns</span>
        </div>
      )}

      {/* Loading */}
      {isSearching && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Searching for leads...</p>
                <p className="text-sm text-muted-foreground mt-1">Discovering profiles and fetching signals. This may take 30-60 seconds.</p>
              </div>
              <div className="w-64"><Progress value={undefined} className="h-2" /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isSearching && hasSearched && leads.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <AlertCircle className="h-10 w-10" />
              <p className="font-medium">No leads found</p>
              <p className="text-sm">Try a different search term or broaden your location filter.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═════════ RESULTS TABLE — 29 columns, horizontally scrollable ═════════ */}
      {!isSearching && leads.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[2800px]">
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[80px] sticky left-0 bg-background z-10">Actions</TableHead>
                    <TableHead className="w-[50px]">#</TableHead>
                    {/* Identity */}
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    {/* Professional */}
                    <TableHead>Title</TableHead>
                    <TableHead>Seniority</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Company Domain</TableHead>
                    <TableHead>Company LinkedIn</TableHead>
                    <TableHead>Education</TableHead>
                    <TableHead className="min-w-[200px]">Summary</TableHead>
                    {/* Location */}
                    <TableHead>Location</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Country</TableHead>
                    {/* Network */}
                    <TableHead className="text-right">Connections</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    {/* Signals */}
                    <TableHead className="text-right">Signals</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="min-w-[250px]">Signals Summary</TableHead>
                    {/* Metadata */}
                    <TableHead>Search Query</TableHead>
                    <TableHead className="text-right">Quality</TableHead>
                    <TableHead>Discovered</TableHead>
                    <TableHead className="text-right">Completeness</TableHead>
                    {/* Status */}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead, idx) => (
                    <TableRow key={lead.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(lead)}>
                      <TCell className="sticky left-0 bg-background z-10">
                        <div className="flex gap-0.5" onClick={stopRowClick}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEnrich(lead)} disabled={enrichingIds.has(lead.id)} title="Re-enrich">
                            {enrichingIds.has(lead.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(lead)} title="Details">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TCell>
                      <TCell>{idx + 1}</TCell>
                      {/* Identity */}
                      <TCell>{lead.first_name || "—"}</TCell>
                      <TCell>{lead.last_name || "—"}</TCell>
                      <TCell className="font-medium">{lead.full_name || "—"}</TCell>
                      <TCell>{lead.email ? <a href={`mailto:${lead.email}`} className="text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>{lead.email}</a> : "—"}</TCell>
                      <TCell>{lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-500 hover:underline" onClick={stopRowClick}>{lead.phone}</a> : "—"}</TCell>
                      <TCell onClick={stopRowClick}><LinkCell href={lead.linkedin_url} label="Profile" /></TCell>
                      {/* Professional */}
                      <TCell className="max-w-[180px] truncate">{lead.title || "—"}</TCell>
                      <TCell><SeniorityBadge level={lead.seniority_level} /></TCell>
                      <TCell>{lead.department || "—"}</TCell>
                      <TCell className="font-medium">{lead.organization_name || "—"}</TCell>
                      <TCell>{lead.company_domain || "—"}</TCell>
                      <TCell onClick={stopRowClick}><LinkCell href={lead.company_linkedin_url} label="Company" /></TCell>
                      <TCell>{lead.education || "—"}</TCell>
                      <TCell className="max-w-[200px] truncate" title={lead.summary ? String(lead.summary) : undefined}>{lead.summary || "—"}</TCell>
                      {/* Location */}
                      <TCell>{lead.location || "—"}</TCell>
                      <TCell>{lead.city || "—"}</TCell>
                      <TCell>{lead.state || "—"}</TCell>
                      <TCell>{lead.country || "—"}</TCell>
                      {/* Network */}
                      <TCell className="text-right">{lead.connections_count || "—"}</TCell>
                      <TCell className="text-right">{lead.followers_count || "—"}</TCell>
                      {/* Signals */}
                      <TCell className="text-right">
                        {lead.signals_count > 0 ? (
                          <Badge variant="secondary" className="gap-0.5 text-[10px]"><Sparkles className="h-2.5 w-2.5" />{lead.signals_count}</Badge>
                        ) : "—"}
                      </TCell>
                      <TCell className="text-right"><QualityBar score={lead.engagement_score} /></TCell>
                      <TCell className="max-w-[250px] truncate" title={lead.signals_summary ? String(lead.signals_summary) : undefined}>{lead.signals_summary || "—"}</TCell>
                      {/* Metadata */}
                      <TCell>{lead.search_query}</TCell>
                      <TCell className="text-right"><QualityBar score={lead.quality_score} /></TCell>
                      <TCell>{new Date(lead.discovered_at).toLocaleDateString()}</TCell>
                      <TCell className="text-right">{lead.data_completeness}%</TCell>
                      {/* Status */}
                      <TCell><Badge variant="outline" className="text-[10px]">{lead.status}</Badge></TCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial state cards */}
      {!isSearching && !hasSearched && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Company Search</h3>
              <p className="text-sm text-muted-foreground">Search by company name to find key people</p>
              <p className="text-xs text-muted-foreground mt-2 italic">&quot;Tesla&quot;, &quot;Stripe&quot;, &quot;Acme Corp&quot;</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Industry Search</h3>
              <p className="text-sm text-muted-foreground">Find leads across an industry or vertical</p>
              <p className="text-xs text-muted-foreground mt-2 italic">&quot;Hotel Outreach Company&quot;, &quot;SaaS Startup&quot;</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <User className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Role Search</h3>
              <p className="text-sm text-muted-foreground">Target specific job titles or functions</p>
              <p className="text-xs text-muted-foreground mt-2 italic">&quot;VP of Sales SaaS&quot;, &quot;CTO Fintech&quot;</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═════════ Lead Detail Sheet ═════════ */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {selectedLead.first_name?.[0]}{selectedLead.last_name?.[0]}
                  </div>
                  {selectedLead.full_name}
                </SheetTitle>
                <SheetDescription>{selectedLead.title}{selectedLead.organization_name ? ` at ${selectedLead.organization_name}` : ""}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Scores */}
                <div className="grid grid-cols-3 gap-4">
                  <ScoreBox label="Quality" value={selectedLead.quality_score} />
                  <ScoreBox label="Engagement" value={selectedLead.engagement_score} />
                  <ScoreBox label="Completeness" value={selectedLead.data_completeness} suffix="%" />
                </div>

                <DetailSection icon={<User className="h-4 w-4" />} title="Professional">
                  <DRow label="Title" value={selectedLead.title} />
                  <DRow label="Seniority" value={selectedLead.seniority_level} />
                  <DRow label="Department" value={selectedLead.department} />
                  <DRow label="Organization" value={selectedLead.organization_name} />
                  <DRow label="Industry" value={selectedLead.industry} />
                  <DRow label="Education" value={selectedLead.education} />
                  <DRow label="Degree" value={selectedLead.education_degree} />
                  {selectedLead.summary && <DRow label="Summary" value={selectedLead.summary} />}
                  {(selectedLead.skills || []).length > 0 && <DRow label="Skills" value={selectedLead.skills.join(", ")} />}
                </DetailSection>

                <DetailSection icon={<Mail className="h-4 w-4" />} title="Contact">
                  <DRow label="Email" value={selectedLead.email} link={`mailto:${selectedLead.email}`} />
                  <DRow label="Phone" value={selectedLead.phone} link={`tel:${selectedLead.phone}`} />
                  <DRow label="LinkedIn" value={selectedLead.linkedin_url} link={selectedLead.linkedin_url} />
                  <DRow label="Twitter" value={selectedLead.twitter_url} link={selectedLead.twitter_url} />
                  <DRow label="Website" value={selectedLead.website} link={selectedLead.website} />
                  <DRow label="Company LI" value={selectedLead.company_linkedin_url} link={selectedLead.company_linkedin_url} />
                  <DRow label="Domain" value={selectedLead.company_domain} />
                </DetailSection>

                <DetailSection icon={<MapPin className="h-4 w-4" />} title="Location">
                  <DRow label="Location" value={selectedLead.location} />
                  <DRow label="City" value={selectedLead.city} />
                  <DRow label="State" value={selectedLead.state} />
                  <DRow label="Country" value={selectedLead.country} />
                  <DRow label="Language" value={selectedLead.profile_language} />
                </DetailSection>

                <DetailSection icon={<Users className="h-4 w-4" />} title="Network">
                  <DRow label="Connections" value={selectedLead.connections_count > 0 ? String(selectedLead.connections_count) : ""} />
                  <DRow label="Followers" value={selectedLead.followers_count > 0 ? String(selectedLead.followers_count) : ""} />
                </DetailSection>

                {/* Signals */}
                {selectedLead.signals_count > 0 && (
                  <DetailSection icon={<Sparkles className="h-4 w-4" />} title={`Signals (${selectedLead.signals_count})`}>
                    {selectedLead.company_signals.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Company Signals</p>
                        {selectedLead.company_signals.map((s, i) => <SignalCard key={i} signal={s} />)}
                      </div>
                    )}
                    {selectedLead.person_signals.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Person Signals</p>
                        {selectedLead.person_signals.map((s, i) => <SignalCard key={i} signal={s} />)}
                      </div>
                    )}
                  </DetailSection>
                )}

                {/* Meta */}
                <div className="border-t pt-4 grid gap-1 text-xs text-muted-foreground">
                  <p>Discovered: {new Date(selectedLead.discovered_at).toLocaleString()}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleEnrich(selectedLead)} disabled={enrichingIds.has(selectedLead.id)}>
                    {enrichingIds.has(selectedLead.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Re-enrich
                  </Button>
                  {selectedLead.linkedin_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedLead.linkedin_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open LinkedIn</a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ── Small helper components ──────────────────────────────────────────── */

function ScoreBox({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <p className="text-2xl font-bold">{value}{suffix}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">{icon} {title}</h4>
      <div className="grid gap-2 text-sm">{children}</div>
    </div>
  )
}

function DRow({ label, value, link }: { label: string; value?: string; link?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
          {value.length > 60 ? value.slice(0, 60) + "…" : value}
        </a>
      ) : (
        <span className="break-all">{value}</span>
      )}
    </div>
  )
}

function SignalCard({ signal }: { signal: { title: string; url: string; content: string } }) {
  const inferSignalType = (s: { title?: string; url?: string; content?: string }) => {
    const title = (s.title || "").toLowerCase()
    const url = (s.url || "").toLowerCase()
    const content = (s.content || "").toLowerCase()

    if (/(linkedin\.com|twitter\.com|x\.com|facebook\.com|medium\.com|instagram\.com)/.test(url)) {
      return "Social"
    }
    if (/\/blog\b|blog\./.test(url) || title.includes("blog") || content.includes("blog")) {
      return "Blog"
    }
    if (/news|press|announcement|launch/.test(title) || /news|press/.test(url)) {
      return "News"
    }
    if (/hiring|job|careers|opening/.test(title) || /hiring|careers/.test(url)) {
      return "Hiring"
    }
    if (/tech stack|technology|integration|uses|stack/.test(title + " " + content)) {
      return "Technology"
    }
    return "Research"
  }

  const signalType = inferSignalType(signal)

  return (
    <div className="p-2 rounded bg-muted/50 text-xs mb-1.5">
      <div className="flex items-center justify-between gap-2">
        <a href={signal.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-500 hover:underline">
          {signal.title}
        </a>
        <Badge variant="secondary" className="text-[10px]">
          {signalType}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-0.5 line-clamp-2">{signal.content}</p>
    </div>
  )
}
