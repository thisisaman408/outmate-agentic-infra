"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Search, Plus, RefreshCw,
  Share2, ArrowUpRight, Flame, Target, UserPlus, Send,
  Activity, Mail, Linkedin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  fetchSearches,
  createSearch,
  updateSearch,
  deleteSearch,
  runSearchAndWait,
  fetchSignals,
  fetchStats,
  enrichSignal,
  signalOutreach,
  signalCrmPush,
  fetchIntegrations,
  getHubSpotAuthUrl,
  SIGNAL_TYPE_OPTIONS,
  SORT_OPTIONS,
  STRENGTH_OPTIONS,
  type SocialSearch,
  type SocialSignal,
  type SocialStats,
  type SignalFeedParams,
  type CreateSearchPayload,
  type IntegrationStatus,
} from "@/lib/social-listening"

/* ─── types ─── */
interface SavedSearch {
  id: string
  name: string
  platform: "linkedin" | "x"
  frequency: string
  updatedAt: string
  keywords: string[]
  paused?: boolean
  matchCount?: number
  enrichedCount?: number
}

const SIGNAL_CATEGORIES = [
  "All Signals", "Sales-Led", "Product-Led", "Community-Led",
  "Competitor", "Technographic", "Event", "Partner"
] as const

const INTENT_OPTIONS = ["Highest Intent", "High Intent", "All Intent"] as const
const TIME_OPTIONS = ["Anytime", "Today", "This Week", "This Month"] as const

export default function SocialAgentPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [signals, setSignals] = useState<SocialSignal[]>([])
  const [stats, setStats] = useState<SocialStats>({
    total_signals: 0, total_signals_delta_pct: 0,
    enriched_contacts: 0, enriched_contacts_delta_pct: 0,
    hot_intent_leads: 0, hot_intent_leads_delta: 0,
    active_searches: 0, running_searches: 0,
  })
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [view, setView] = useState<"feed" | "builder">("feed")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newSearchName, setNewSearchName] = useState("")
  const [newSearchKeywords, setNewSearchKeywords] = useState("")

  // Filters
  const [activeCategory, setActiveCategory] = useState("All Signals")
  const [intentFilter, setIntentFilter] = useState<typeof INTENT_OPTIONS[number]>("Highest Intent")
  const [timeFilter, setTimeFilter] = useState<typeof TIME_OPTIONS[number]>("Anytime")
  const [strengthFilter, setStrengthFilter] = useState<"all" | "High" | "Medium" | "Low">("all")
  const [enrichedOnly, setEnrichedOnly] = useState(false)
  const [hotOnly, setHotOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"recent" | "intent" | "engagement">("recent")
  const [enrichingId, setEnrichingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [searchData, statsData] = await Promise.all([fetchSearches(), fetchStats()])
      setSearches(searchData.map(s => ({
        id: s.id, name: s.name, platform: "linkedin" as const,
        frequency: s.schedule,
        updatedAt: s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "Never",
        keywords: s.keywords, paused: s.status === "paused",
        matchCount: s.total_signals, enrichedCount: s.enriched_signals
      })))
      setStats(statsData)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSignals = useCallback(async () => {
    const params: SignalFeedParams = {
      search_id: selectedSearchId || undefined,
      signal_type: activeCategory === "All Signals" ? undefined : activeCategory,
      sort: sortBy,
      limit: 50,
      enriched_only: enrichedOnly || undefined,
      hot_only: hotOnly || undefined,
      strength: strengthFilter === "all" ? undefined : strengthFilter,
      since: timeFilter === "Anytime" ? undefined
        : timeFilter === "Today" ? "today"
        : timeFilter === "This Week" ? "week"
        : timeFilter === "This Month" ? "month" : undefined,
      min_intent: intentFilter === "Highest Intent" ? 80
        : intentFilter === "High Intent" ? 60 : undefined,
    }
    try {
      const data = await fetchSignals(params)
      setSignals(data)
    } catch (error) {
      console.error("Failed to load signals:", error)
    }
  }, [selectedSearchId, activeCategory, sortBy, enrichedOnly, hotOnly, strengthFilter, timeFilter, intentFilter])

  async function handleEnrich(signalId: string) {
    setEnrichingId(signalId)
    try {
      await enrichSignal(signalId)
      await loadSignals()
      await fetchStats().then(setStats)
    } catch (e) { console.error("Enrich failed:", e) }
    finally { setEnrichingId(null) }
  }

  async function handleRefresh() {
    setLoading(true)
    await Promise.all([loadAll(), loadSignals()])
    setLoading(false)
  }

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] border-r border-border bg-card flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">All Searches</h2>
          <Button onClick={() => setView('builder')} variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-primary/10 text-primary">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/5">
        {view === 'builder' ? (
          <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Create New Search</h1>
              <Button variant="outline" size="sm" onClick={() => setView('feed')}>
                Cancel
              </Button>
            </div>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Search Name</label>
                  <Input
                    placeholder="e.g., SaaS Companies in Series A"
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Keywords</label>
                  <Input
                    placeholder="e.g., SaaS, Series A, B2B"
                    value={newSearchKeywords}
                    onChange={(e) => setNewSearchKeywords(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (!newSearchName || !newSearchKeywords) return
                    setCreating(true)
                    try {
                      await createSearch({
                        name: newSearchName,
                        keywords: newSearchKeywords.split(',').map(k => k.trim()),
                        signal_types: ['Sales-Led'],
                      })
                      setNewSearchName('')
                      setNewSearchKeywords('')
                      setView('feed')
                      await loadAll()
                    } catch (error) {
                      console.error('Failed to create search:', error)
                    } finally {
                      setCreating(false)
                    }
                  }}
                  disabled={creating || !newSearchName || !newSearchKeywords}
                >
                  {creating ? 'Creating...' : 'Create Search'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Social Agent</h1>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">Total Signals</p>
                  <p className="text-3xl font-bold">{stats.total_signals}</p>
                  <p className="text-xs text-green-600 mt-1">{stats.total_signals_delta_pct >= 0 ? '+' : ''}{stats.total_signals_delta_pct}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">Enriched Contacts</p>
                  <p className="text-3xl font-bold">{stats.enriched_contacts}</p>
                  <p className="text-xs text-green-600 mt-1">{stats.enriched_contacts_delta_pct >= 0 ? '+' : ''}{stats.enriched_contacts_delta_pct}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">Hot Intent Leads</p>
                  <p className="text-3xl font-bold">{stats.hot_intent_leads}</p>
                  <p className="text-xs text-green-600 mt-1">+{stats.hot_intent_leads_delta} today</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground mb-1">Active Searches</p>
                  <p className="text-3xl font-bold">{stats.active_searches}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.running_searches} running</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge
                variant={activeCategory === "All Signals" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveCategory("All Signals")}
              >
                All Signals
              </Badge>
              {SIGNAL_CATEGORIES.slice(1).map((cat) => (
                <Badge
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>

            {/* Signals Grid */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading signals...</div>
            ) : signals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No signals found. Create a search to start monitoring social media.
              </div>
            ) : (
              <div className="grid gap-4">
                {signals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    expanded={false}
                    onToggle={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================================================
// Signal Card
// ============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  "Sales-Led": "bg-blue-500/15 text-blue-400",
  "Product-Led": "bg-emerald-500/15 text-emerald-400",
  "Community-Led": "bg-violet-500/15 text-violet-400",
  "Competitor": "bg-red-500/15 text-red-400",
  "System": "bg-cyan-500/15 text-cyan-400",
  "Event": "bg-pink-500/15 text-pink-400",
  "Partner": "bg-orange-500/15 text-orange-400",
}

// Deterministic gradient per name so cards look distinct but stable across renders.
// Scraped data rarely includes a profile picture (BrightData Discover doesn't
// surface one and many Apify actors return an empty avatar field), so this
// gradient avatar has to stand on its own as the default.
const AVATAR_GRADIENTS: string[] = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-emerald-600",
]

function gradientForName(name: string | null | undefined): string {
  const s = (name || "?").trim()
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

/**
 * Full-bleed LinkedIn-branded thumbnail rendered whenever the scraper
 * didn't capture raw post imagery.  Designed to occupy the same visual
 * slot a real thumbnail would — 16:9 hero band on top (gradient + the
 * LinkedIn glyph as a "cover image") plus a footer strip with the post
 * preview text, the same way LinkedIn's own link cards are laid out.
 */
function LinkedInPostPlaceholder({
  snippet,
  postUrl,
  personName,
}: {
  snippet: string | null
  postUrl: string | null
  personName: string | null
}) {
  const preview = (snippet || "").slice(0, 220).trim()
  return (
    <a
      href={postUrl || "#"}
      target={postUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!postUrl) e.preventDefault()
        e.stopPropagation()
      }}
      className="group relative block rounded-lg overflow-hidden border border-border/50 hover:border-[#0A66C2]/60 hover:shadow-lg hover:shadow-[#0A66C2]/15 transition-all"
    >
      {/* ─── Compact hero band (wide, ~4:1) ─── */}
      <div className="relative aspect-[4/1] w-full bg-gradient-to-br from-[#0A66C2] via-[#0a5fb2] to-[#003a73] overflow-hidden">
        {/* Decorative light + grid so the hero reads like a graphic cover */}
        <div className="absolute inset-0 opacity-25 mix-blend-overlay bg-[radial-gradient(circle_at_top_right,_white,_transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(transparent_95%,white_95%),linear-gradient(90deg,transparent_95%,white_95%)] bg-[length:20px_20px]" />

        {/* Centred LinkedIn glyph — smaller, responsive */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-9 sm:size-11 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-md ring-1 ring-white/25 shadow-md">
            <span className="text-white font-black text-lg sm:text-xl leading-none">in</span>
          </div>
        </div>

        {/* Top-left "LinkedIn Post" chip */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-sm ring-1 ring-white/20">
          <span className="size-1 rounded-full bg-white animate-pulse" />
          <span className="text-[9px] uppercase tracking-[0.12em] text-white font-bold">
            LinkedIn Post
          </span>
        </div>

        {/* Top-right "View" CTA */}
        {postUrl && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 text-[9px] font-semibold text-white group-hover:bg-white/25 transition-colors">
            <span>View</span>
            <ArrowUpRight className="size-2.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        )}
      </div>

      {/* ─── Footer strip (post preview) ─── */}
      <div className="px-3 py-2 bg-card border-t border-border/40">
        <p className="text-[11px] text-foreground/80 line-clamp-1 leading-snug">
          <span className="text-muted-foreground font-medium">
            {personName ? `${personName.split(" ")[0]}:` : "Preview:"}
          </span>{" "}
          {preview || "Open on LinkedIn →"}
        </p>
      </div>
    </a>
  )
}

// ─── LinkedIn native post embed ─────────────────────────────────────────
// Pulls the activity ID out of a LinkedIn post URL and renders LinkedIn's
// own embed iframe, which shows the real post with its actual images,
// reactions, and comments — the same UX as on linkedin.com.  Beats
// anything we could scrape ourselves, and works even for signals our
// scraper captured zero media for.

function getLinkedInActivityId(url: string | null | undefined): string | null {
  if (!url) return null
  const patterns = [
    /-activity[-:](\d{10,25})/i,
    /urn:li:activity:(\d{10,25})/i,
    /urn:li:ugcPost:(\d{10,25})/i,
    /urn:li:share:(\d{10,25})/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function LinkedInPostEmbed({ activityId }: { activityId: string }) {
  return (
    <div
      className="rounded-lg overflow-hidden border border-border/50 bg-white"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={`https://www.linkedin.com/embed/feed/update/urn:li:activity:${activityId}`}
        className="w-full block"
        height={520}
        loading="lazy"
        title="LinkedIn post"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
      />
    </div>
  )
}

// ─── Post image grid ────────────────────────────────────────────────────
// LinkedIn-style layout for the cases where the scraper did capture raw
// image URLs: 1 big / 2 side-by-side / 3 with featured-left / 4 grid
// (with "+N" overlay for extras).

function PostImageGrid({
  images,
  postUrl,
}: {
  images: string[]
  postUrl: string | null
}) {
  if (images.length === 0) return null
  const href = (url: string) => postUrl || url

  const Tile = ({
    url,
    className,
    overlay,
  }: {
    url: string
    className: string
    overlay?: React.ReactNode
  }) => (
    <a
      href={href(url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative block overflow-hidden bg-muted border border-border/30 hover:border-primary/50 transition-colors",
        className,
      )}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.parentElement?.remove()
        }}
      />
      {overlay}
    </a>
  )

  const n = images.length

  if (n === 1) {
    return (
      <div className="rounded-lg overflow-hidden">
        <Tile url={images[0]} className="aspect-[16/9] rounded-lg" />
      </div>
    )
  }
  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
        {images.slice(0, 2).map((u, i) => (
          <Tile key={i} url={u} className="aspect-square" />
        ))}
      </div>
    )
  }
  if (n === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 rounded-lg overflow-hidden h-[320px]">
        <Tile url={images[0]} className="row-span-2 h-full" />
        <Tile url={images[1]} className="h-full" />
        <Tile url={images[2]} className="h-full" />
      </div>
    )
  }
  // 4+
  const extra = n - 4
  return (
    <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
      {images.slice(0, 4).map((u, i) => (
        <Tile
          key={i}
          url={u}
          className="aspect-square"
          overlay={
            i === 3 && extra > 0 ? (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">+{extra}</span>
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  )
}

// ─── Render-time sanitizers ────────────────────────────────────────────
// BrightData Discover's `content` blob ships with LinkedIn's public-page
// footer appended (`, you agree to * [About](...) * [Accessibility](...)`),
// and if the scraper couldn't pull the author's name the row lands in the
// DB as NULL → the UI shows "Unknown".  Rather than depend on a backend
// backfill migration, clean/recover at render time so every existing row
// is fixed the moment a user reloads the feed.

const BOILERPLATE_CUTS: RegExp[] = [
  /\s*,\s*you agree to\b/i,
  /\s*\*\s*\[About\]/i,
  /\s*\*\s*\[Accessibility\]/i,
  /\s*\*\s*\[User Agreement\]/i,
  /\s*\*\s*\[Privacy Policy\]/i,
  /\s*\*\s*\[Cookie Policy\]/i,
  /\s*\*\s*\[Copyright Policy\]/i,
  /\s*\*\s*\[Brand Policy\]/i,
  /\s*\*\s*\[Guest Controls\]/i,
  /\s*\*\s*\[Community Guidelines\]/i,
  /\s*LinkedIn and 3rd parties/i,
  /\s*Agree & Join LinkedIn/i,
  /\s*By clicking Continue to join/i,
]

function cleanPostSnippet(snippet: string | null | undefined): string {
  if (!snippet) return ""
  let out = snippet
  for (const re of BOILERPLATE_CUTS) {
    const m = out.match(re)
    if (m && m.index !== undefined) out = out.slice(0, m.index)
  }
  // Drop trailing "… | Firstname Lastname" author tag that LinkedIn
  // sometimes appends right before the footer cruft.
  out = out.replace(/\s*\|\s*[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){0,3}\s*$/, "")
  return out.trim()
}

function extractNameFromSnippet(snippet: string | null | undefined): string {
  if (!snippet) return ""
  // "… | Subbakrishna Rao , you agree to …"  →  "Subbakrishna Rao"
  const pipe = snippet.match(
    /\|\s*([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})\s*(?:,|·|\||$)/,
  )
  if (pipe) return pipe[1].trim()
  return ""
}

function humanizeLinkedInSlug(postUrl: string | null | undefined): string {
  if (!postUrl) return ""
  const m = postUrl.match(/linkedin\.com\/posts\/([a-zA-Z0-9_-]+)/)
  if (!m) return ""
  let slug = m[1].split("_")[0]                   // strip activity suffix
  slug = slug.replace(/-[a-f0-9]{4,}$/, "")       // strip trailing hash
  const parts = slug.split(/[-.]+/).filter((p) => p && isNaN(Number(p)))
  if (parts.length === 0) return ""
  return parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ")
}

function resolvePersonName(signal: SocialSignal): string {
  const raw = (signal.person_name || "").trim()
  if (raw && raw.toLowerCase() !== "unknown") return raw
  return (
    extractNameFromSnippet(signal.post_snippet) ||
    humanizeLinkedInSlug(signal.post_url) ||
    humanizeLinkedInSlug(signal.person_linkedin) ||
    "Unknown"
  )
}

function resolveCompany(signal: SocialSignal): string {
  const raw = (signal.person_company || "").trim()
  if (raw && raw.toLowerCase() !== "unknown") return raw
  return ""   // empty string → the "·" separator + company line hides
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function IntentBadge({ score, tier }: { score: number; tier?: string }) {
  const getColor = () => {
    if (score >= 80) return "bg-orange-500/15 text-orange-400 border-orange-500/30"
    if (score >= 60) return "bg-amber-500/15 text-amber-400 border-amber-500/30"
    return "bg-slate-500/15 text-slate-400 border-slate-500/30"
  }
  return (
    <Badge variant="outline" className={cn("text-[9px] font-medium px-1.5 py-0", getColor())}>
      {score}
    </Badge>
  )
}

function SignalCard({ signal, expanded, onToggle }: { signal: SocialSignal; expanded: boolean; onToggle: () => void }) {
  const signalName = signal.signal_type?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Activity"
  const category = signal.signal_category || "Sales-Led"
  const activityColor = CATEGORY_COLORS[category] || "bg-muted text-muted-foreground"
  const displayName = resolvePersonName(signal)
  const displayCompany = resolveCompany(signal)
  const displaySnippet = cleanPostSnippet(signal.post_snippet)
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"
  const ago = signal.discovered_at ? formatTimeAgo(new Date(signal.discovered_at).getTime()) : ""

  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(!!signal.person_email)
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [outreachDraft, setOutreachDraft] = useState<string | null>(signal.outreach_message || null)
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmResult, setCrmResult] = useState<string | null>(null)

  const handleEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (revealed) return
    setEnriching(true)
    try {
      const res = await enrichSignal(signal.id)
      if (res?.email) {
        signal.person_email = res.email
        signal.person_email_verified = !res.email_unverified
      }
      setRevealed(true)
      setEnrichResult(res?.status === "already_enriched" ? "Already enriched" : res?.email ? `Found: ${res.email}` : "No email found")
    } catch { setEnrichResult("Failed") }
    finally { setEnriching(false); setTimeout(() => setEnrichResult(null), 5000) }
  }

  const handleOutreach = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outreachDraft) { onToggle(); return }
    setOutreachLoading(true)
    try {
      const res = await signalOutreach(signal.id)
      const msg = res?.message || res?.error || "No outreach draft available — LLM may be unavailable."
      setOutreachDraft(msg)
      if (!expanded) onToggle()
    } catch { setOutreachDraft("Failed to generate outreach draft.") }
    finally { setOutreachLoading(false) }
  }

  const handleCrm = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCrmLoading(true)
    try {
      const res = await signalCrmPush(signal.id)
      if (res?.status === "not_connected" && res?.auth_url) {
        window.open(res.auth_url, "_blank", "width=600,height=700")
        setCrmResult("Connect HubSpot to push contacts")
      } else if (res?.status === "not_connected") {
        const authUrl = await getHubSpotAuthUrl()
        if (authUrl) window.open(authUrl, "_blank", "width=600,height=700")
        setCrmResult("Connect HubSpot first")
      } else if (res?.status === "skipped") {
        setCrmResult(res.note || "Enrich first — no email")
      } else {
        setCrmResult(res?.note || "Pushed to HubSpot")
      }
      setTimeout(() => setCrmResult(null), 4000)
    } catch { setCrmResult("CRM push failed") }
    finally { setCrmLoading(false) }
  }

  return (
    <Card className={cn("border-border/60 transition-all cursor-pointer hover:border-primary/30", expanded && "border-primary/50 ring-1 ring-primary/20")} onClick={onToggle}>
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Avatar wrapper keeps the LinkedIn "in" corner badge aligned to
                both real DP + gradient fallback variants. */}
            <div className="relative shrink-0">
              {signal.profile_picture_url ? (
                /* Author DP — falls back to the gradient+initials tile on 404/broken URL.
                   LinkedIn serves DPs from media.licdn.com which often hot-links fine
                   from a browser but sometimes returns 403 without a referrer. */
                <img
                  src={signal.profile_picture_url}
                  alt={displayName || "profile"}
                  className="size-10 rounded-full object-cover ring-1 ring-border/40"
                  onError={(e) => {
                    const img = e.currentTarget
                    img.style.display = "none"
                    img.nextElementSibling?.classList.remove("hidden")
                  }}
                />
              ) : null}
              {/* Branded gradient avatar with initials.  Uses a per-name hash so
                  two different people never share the same colour but the same
                  person is always the same tile across refreshes.  A ring +
                  LinkedIn glyph makes it read as a designed template, not a
                  placeholder for missing data. */}
              <div className={cn(
                "size-10 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-sm bg-gradient-to-br ring-1 ring-white/10",
                gradientForName(displayName),
                signal.profile_picture_url && "hidden",
              )}>{initials}</div>
              {/* Small LinkedIn "in" badge in the corner — shows on both real
                  DPs and the gradient fallback so every signal card reads as
                  a LinkedIn-sourced contact. */}
              <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-[#0A66C2] flex items-center justify-center ring-2 ring-card shadow-sm">
                <span className="text-white font-black text-[8px] leading-none">in</span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{displayName}</span>
                {signal.person_linkedin && <Linkedin className="size-3.5 text-blue-400" />}
                <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", activityColor)}>
                  {signalName}
                </Badge>
                {signal.signal_strength && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    signal.signal_strength === "High" ? "bg-red-500/15 text-red-400" :
                    signal.signal_strength === "Medium" ? "bg-amber-500/15 text-amber-400" :
                    "bg-slate-500/15 text-slate-400"
                  )}>
                    {signal.signal_strength}
                  </span>
                )}
                {signal.intent_score != null && <IntentBadge score={signal.intent_score} tier={signal.intent_tier} />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {signal.person_title}{signal.person_title && displayCompany && " · "}
                {displayCompany && (
                  <span className="font-medium text-foreground/80">{displayCompany}</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{ago}</span>
                {signal.matched_search_names.map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">{name}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div>
        {displaySnippet && (
          <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">
            {displaySnippet}
            {signal.post_url && (
              <a href={signal.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary text-xs ml-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                Read more <ArrowUpRight className="size-3" />
              </a>
            )}
          </p>
        )}

        {/* Post media — always render SOMETHING so every card has the
            same visual weight.  Raw images when we've got them, a big
            LinkedIn-branded thumbnail placeholder when we don't.  No
            iframes (LinkedIn blocks guest embeds so those went blank). */}
        {signal.post_images && signal.post_images.length > 0 ? (
          <PostImageGrid images={signal.post_images} postUrl={signal.post_url} />
        ) : (
          <LinkedInPostPlaceholder
            snippet={displaySnippet}
            postUrl={signal.post_url}
            personName={displayName}
          />
        )}

        {signal.best_hook && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            <strong>Hook:</strong> {signal.best_hook}
          </p>
        )}
        </div>
      </CardContent>
    </Card>
  )
}
