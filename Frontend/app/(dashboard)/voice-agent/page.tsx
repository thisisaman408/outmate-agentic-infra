"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Phone,
  BarChart3,
  Upload,
  Plus,
  Pause,
  Play,
  Sparkles,
  X,
  FileUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  fetchVoiceAgentConfig,
  updateVoiceAgentConfig,
  fetchVoiceAgentStats,
  fetchRecentCalls,
  pauseAgent,
  aiRewriteScript,
  triggerVoiceCall,
  uploadContactList,
  fetchVoiceAnalytics,
  fetchCallDetails,
  VOICE_PERSONAS,
  CALL_OBJECTIVES,
  FALLBACK_ACTIONS,
  CALL_LIST_SOURCES,
  type VoiceAgentConfig,
  type VoiceAgentStats,
  type RecentCall,
  type VoiceAnalytics,
  type UploadResult,
  type CallDetails,
} from "@/lib/api/voice-agent"
import { CampaignWizard } from "@/components/voice-agent/campaign-wizard"
import { listCampaigns, type Campaign } from "@/lib/api/voice-campaigns"
import Link from "next/link"

// ============================================================================
// Status badge colors
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  Booked: "bg-green-100 text-green-700",
  Completed: "bg-blue-100 text-blue-700",
  "Call made": "bg-blue-50 text-blue-600",
  "Call back": "bg-blue-100 text-blue-700",
  Voicemail: "bg-purple-100 text-purple-700",
  "No answer": "bg-gray-100 text-gray-500",
  Failed: "bg-red-100 text-red-700",
  "In progress": "bg-amber-100 text-amber-700",
}

const TRIGGER_COLORS: Record<string, string> = {
  funding: "bg-green-500",
  vp_hired: "bg-violet-500",
  hiring_spike: "bg-blue-500",
  website_visitor: "bg-amber-500",
  tech_stack: "bg-red-500",
}

const TRIGGER_LETTERS: Record<string, string> = {
  funding: "S",
  vp_hired: "VP",
  hiring_spike: "H",
  website_visitor: "W",
  tech_stack: "T",
}

// ============================================================================
// Page
// ============================================================================

export default function VoiceAgentPage() {
  const [config, setConfig] = useState<VoiceAgentConfig | null>(null)
  const [stats, setStats] = useState<VoiceAgentStats | null>(null)
  const [calls, setCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)
  const [scriptTab, setScriptTab] = useState("opening")
  const [rewriting, setRewriting] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Dialog states
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<VoiceAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaignForm, setCampaignForm] = useState({
    prospect_name: "",
    prospect_phone: "",
    prospect_company: "",
    prospect_role: "",
    prospect_city: "",
    prospect_industry: "",
    call_objective: "discovery",
    context: "",
  })
  const [campaignSubmitting, setCampaignSubmitting] = useState(false)
  const [campaignResult, setCampaignResult] = useState<string | null>(null)
  const [campaignError, setCampaignError] = useState("")

  const [triggerOpen, setTriggerOpen] = useState(false)
  const [triggerForm, setTriggerForm] = useState({ name: "", description: "" })

  const [callDetailOpen, setCallDetailOpen] = useState(false)
  const [callDetail, setCallDetail] = useState<CallDetails | null>(null)
  const [callDetailLoading, setCallDetailLoading] = useState(false)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const loadCampaigns = useCallback(async () => {
    try { setCampaigns(await listCampaigns()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  useEffect(() => {
    const t = setInterval(loadCampaigns, 10_000)
    return () => clearInterval(t)
  }, [loadCampaigns])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s, r] = await Promise.all([
        fetchVoiceAgentConfig(),
        fetchVoiceAgentStats(),
        fetchRecentCalls(),
      ])
      setConfig(c)
      setStats(s)
      setCalls(r)
    } catch {
      setConfig({
        status: "active",
        voice_persona: "Alex (Neutral EN-US)",
        call_objective: "Book discovery call",
        max_calls_per_day: 50,
        fallback_action: "Leave voicemail + send follow-up email",
        call_list_source: "Outmate Database \u2014 live segment",
        icp_filter: "Series A\u2013C \u00b7 SaaS \u00b7 20\u2013200 employees \u00b7 EU + US",
        signal_triggers: [
          { id: "funding", name: "Funding round detected", description: "Call within 24h of Series A\u2013C announced", enabled: true },
          { id: "vp_hired", name: "New VP / C-suite hired", description: "GTM leader joins ICP company \u2014 call within 48h", enabled: true },
          { id: "hiring_spike", name: "Hiring spike \u2014 Sales / GTM", description: "Company posts 3+ GTM roles in 30 days", enabled: true },
          { id: "website_visitor", name: "Website visitor \u2014 pricing page", description: "ICP company visits pricing page, no demo booked", enabled: false },
          { id: "tech_stack", name: "Tech stack change", description: "Competitor tool removed or replaced", enabled: false },
        ],
        call_script: {
          opening: "Hi {{first_name}}, this is Alex calling from Outmate.\n\nI saw that {{company_name}} recently {{signal_event}} \u2014 congratulations on that. We work with GTM teams at companies like yours who are scaling outbound...",
          objection_handling: "I understand your concern. Many of our customers felt the same way before seeing how...",
          closing: "Would it make sense to schedule a quick 15-minute call with our team to explore this further?",
        },
        crm_settings: {
          auto_create_hubspot: true,
          log_transcript: true,
          send_followup_email: true,
          slack_booked_alert: false,
        },
      })
      setStats({
        calls_made: 0, calls_today: 0, meetings_booked: 0, booking_rate: 0,
        avg_call_duration: "0:00", signal_triggered: 0, signal_triggered_pct: 0,
        connected_rate: 0, voicemail_rate: 0, no_answer_rate: 0, in_queue: 0,
      })
      setCalls([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    loadAll()
  }, [loadAll])

  const saveConfig = useCallback(
    async (updates: Partial<VoiceAgentConfig>) => {
      if (!config) return
      const next = { ...config, ...updates }
      setConfig(next)
      try { await updateVoiceAgentConfig(next) } catch { /* local state is source of truth */ }
    },
    [config]
  )

  const handlePause = useCallback(async () => {
    if (!config) return
    const newStatus = config.status === "active" ? "paused" : "active"
    setConfig({ ...config, status: newStatus })
    try { await pauseAgent() } catch { setConfig(config) }
  }, [config])

  const handleToggleTrigger = useCallback(
    (triggerId: string) => {
      if (!config) return
      const triggers = config.signal_triggers.map((t) =>
        t.id === triggerId ? { ...t, enabled: !t.enabled } : t
      )
      saveConfig({ signal_triggers: triggers })
    },
    [config, saveConfig]
  )

  const handleScriptChange = useCallback(
    (section: "opening" | "objection_handling" | "closing", value: string) => {
      if (!config) return
      saveConfig({ call_script: { ...config.call_script, [section]: value } })
    },
    [config, saveConfig]
  )

  const handleAiRewrite = useCallback(async () => {
    if (!config) return
    const section = scriptTab as "opening" | "objection_handling" | "closing"
    setRewriting(true)
    try {
      const { rewritten } = await aiRewriteScript(section, config.call_script[section])
      handleScriptChange(section, rewritten)
    } catch { /* silent */ } finally { setRewriting(false) }
  }, [config, scriptTab, handleScriptChange])

  const handleCrmToggle = useCallback(
    (key: keyof VoiceAgentConfig["crm_settings"]) => {
      if (!config) return
      saveConfig({ crm_settings: { ...config.crm_settings, [key]: !config.crm_settings[key] } })
    },
    [config, saveConfig]
  )

  const insertVariable = useCallback(
    (variable: string) => {
      if (!config) return
      const section = scriptTab as "opening" | "objection_handling" | "closing"
      handleScriptChange(section, config.call_script[section] + ` {{${variable}}}`)
    },
    [config, scriptTab, handleScriptChange]
  )

  // --- Analytics dialog ---
  const openAnalytics = useCallback(async () => {
    setAnalyticsOpen(true)
    setAnalyticsLoading(true)
    try {
      const data = await fetchVoiceAnalytics()
      setAnalyticsData(data)
    } catch { setAnalyticsData(null) }
    finally { setAnalyticsLoading(false) }
  }, [])

  // --- Upload dialog ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError("")
    setUploadResult(null)
    try {
      const result = await uploadContactList(file)
      setUploadResult(result)
    } catch (err: any) {
      setUploadError(err.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }, [])

  // --- Campaign dialog ---
  const handleCampaignSubmit = useCallback(async () => {
    if (!campaignForm.prospect_name || !campaignForm.prospect_phone) return
    setCampaignSubmitting(true)
    setCampaignError("")
    setCampaignResult(null)
    try {
      const result: any = await triggerVoiceCall(campaignForm)
      setCampaignResult(result.call_id || result.run_id || "Call initiated")
      // Refresh calls list
      try { const r = await fetchRecentCalls(); setCalls(r) } catch {}
      try { const s = await fetchVoiceAgentStats(); setStats(s) } catch {}
    } catch (err: any) {
      setCampaignError(err.message || "Failed to trigger call")
    } finally {
      setCampaignSubmitting(false)
    }
  }, [campaignForm])

  // --- Custom trigger ---
  const handleAddTrigger = useCallback(() => {
    if (!config || !triggerForm.name) return
    const id = triggerForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
    const newTrigger = {
      id,
      name: triggerForm.name,
      description: triggerForm.description,
      enabled: true,
    }
    saveConfig({ signal_triggers: [...config.signal_triggers, newTrigger] })
    setTriggerForm({ name: "", description: "" })
    setTriggerOpen(false)
  }, [config, triggerForm, saveConfig])

  // --- Call details ---
  const openCallDetail = useCallback(async (runId: string) => {
    setCallDetailOpen(true)
    setCallDetailLoading(true)
    setCallDetail(null)
    try {
      const detail = await fetchCallDetails(runId)
      setCallDetail(detail)
    } catch { setCallDetail(null) }
    finally { setCallDetailLoading(false) }
  }, [])

  const waveformHeights = useMemo(
    () => Array.from({ length: 24 }, (_, i) => Math.max(6, Math.sin(i * 0.5) * 20 + (Math.sin(i * 1.7 + 3) * 0.5 + 0.5) * 16 + 8)),
    []
  )

  if (!mounted) return null

  const isActive = config?.status === "active"

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("inline-block h-2 w-2 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
            <span className="text-sm font-medium text-muted-foreground">
              {isActive ? "Agent live" : "Agent paused"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Voice AI Agent</h1>
          <p className="text-muted-foreground mt-1">
            Autonomous outbound calling &mdash; triggered by signals, powered by your GTM context
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={openAnalytics}>
            <BarChart3 className="h-4 w-4" />
            View analytics
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setUploadOpen(true); setUploadResult(null); setUploadError("") }}>
            <Upload className="h-4 w-4" />
            Upload list
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => { setCampaignOpen(true); setCampaignResult(null); setCampaignError("") }}>
            <Phone className="h-4 w-4" />
            Quick call
          </Button>
          <Button size="sm" className="gap-2 bg-primary" onClick={() => setWizardOpen(true)}>
            <Sparkles className="h-4 w-4" />
            New campaign
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">Calls made</p>
            <p className="text-3xl font-bold">{stats?.calls_made ?? 0}</p>
            <p className="text-xs text-green-600 mt-1">+{stats?.calls_today ?? 0} today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">Meetings booked</p>
            <p className="text-3xl font-bold">{stats?.meetings_booked ?? 0}</p>
            <p className="text-xs text-green-600 mt-1">{stats?.booking_rate ?? 0}% booking rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">Avg call duration</p>
            <p className="text-3xl font-bold">{stats?.avg_call_duration ?? "0:00"}</p>
            <p className="text-xs text-muted-foreground mt-1">min:sec</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">Signal-triggered</p>
            <p className="text-3xl font-bold">{stats?.signal_triggered ?? 0}</p>
            <p className="text-xs text-green-600 mt-1">{stats?.signal_triggered_pct ?? 0}% of all calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content: two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Agent Configuration */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Agent configuration</h2>
              <div className="flex items-center justify-center h-16 mb-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-[3px]">
                  {[...Array(24)].map((_, i) => (
                    <div key={i} className={cn("w-[3px] rounded-full transition-all", isActive ? "bg-primary" : "bg-muted-foreground/30")} style={{ height: `${waveformHeights[i]}px` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
                  <span className="text-sm font-medium">{isActive ? "Agent is active" : "Agent is paused"}</span>
                  <span className="text-sm text-muted-foreground">&middot; {stats?.in_queue ?? 0} calls in queue</span>
                </div>
                <Button variant={isActive ? "destructive" : "default"} size="sm" className="gap-2" onClick={handlePause}>
                  {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isActive ? "Pause" : "Resume"}
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Voice persona</label>
                  <Select value={config?.voice_persona} onValueChange={(v) => saveConfig({ voice_persona: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{VOICE_PERSONAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Call objective</label>
                  <Select value={config?.call_objective} onValueChange={(v) => saveConfig({ call_objective: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{CALL_OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Max calls / day</label>
                  <Input type="number" value={config?.max_calls_per_day ?? 50} onChange={(e) => saveConfig({ max_calls_per_day: parseInt(e.target.value) || 50 })} className="w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Script */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Call script</h2>
                <Button variant="ghost" size="sm" className="gap-2 text-primary" onClick={handleAiRewrite} disabled={rewriting}>
                  <Sparkles className="h-4 w-4" />
                  {rewriting ? "Rewriting..." : "AI rewrite"}
                </Button>
              </div>
              <Tabs value={scriptTab} onValueChange={setScriptTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="opening">Opening</TabsTrigger>
                  <TabsTrigger value="objection_handling">Objection handling</TabsTrigger>
                  <TabsTrigger value="closing">Closing</TabsTrigger>
                </TabsList>
                {(["opening", "objection_handling", "closing"] as const).map((section) => (
                  <TabsContent key={section} value={section}>
                    <textarea
                      className="w-full min-h-[120px] rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={config?.call_script[section] ?? ""}
                      onChange={(e) => handleScriptChange(section, e.target.value)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
              <div className="flex flex-wrap gap-2 mt-3">
                {["first_name", "company_name", "signal_event", "icp_pain"].map((v) => (
                  <button key={v} onClick={() => insertVariable(v)} className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", v === "signal_event" ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10")}>
                    + {v}
                  </button>
                ))}
              </div>
              <div className="mt-5">
                <label className="text-sm text-muted-foreground mb-1.5 block">Fallback if no answer</label>
                <Select value={config?.fallback_action} onValueChange={(v) => saveConfig({ fallback_action: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{FALLBACK_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Performance</h2>
              <div className="space-y-3">
                <PerformanceBar label="Connected rate" value={stats?.connected_rate ?? 0} color="bg-green-500" />
                <PerformanceBar label="Voicemail rate" value={stats?.voicemail_rate ?? 0} color="bg-amber-500" />
                <PerformanceBar label="Booking rate" value={stats?.booking_rate ?? 0} color="bg-emerald-600" />
                <PerformanceBar label="No answer" value={stats?.no_answer_rate ?? 0} color="bg-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Signal Triggers */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-1">Signal triggers</h2>
              <p className="text-sm text-muted-foreground mb-4">Call fires when signal detected</p>
              <div className="space-y-3">
                {config?.signal_triggers.map((trigger) => (
                  <div key={trigger.id} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", TRIGGER_COLORS[trigger.id] || "bg-gray-500")}>
                        {TRIGGER_LETTERS[trigger.id] || trigger.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{trigger.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{trigger.description}</p>
                      </div>
                    </div>
                    <Switch checked={trigger.enabled} onCheckedChange={() => handleToggleTrigger(trigger.id)} />
                  </div>
                ))}
              </div>
              <button onClick={() => setTriggerOpen(true)} className="flex items-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-4 w-4" />
                Add custom signal trigger
              </button>
            </CardContent>
          </Card>

          {/* Company Profile quick-link */}
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-sm">Your company profile</div>
                <div className="text-xs text-muted-foreground">
                  What the voice agent tells prospects about your company, pitch, pricing, and objection handling. Set once, used on every call.
                </div>
              </div>
              <Link href="/settings/company-profile">
                <Button size="sm" variant="outline" className="shrink-0">Configure</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Campaigns */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Campaigns</h2>
                <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
              </div>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No campaigns yet. Click <span className="font-medium">New campaign</span> to launch a background call batch.
                </p>
              ) : (
                <div className="divide-y text-sm">
                  {campaigns.slice(0, 10).map((c) => {
                    const pct = c.total_prospects ? Math.round((c.calls_made / c.total_prospects) * 100) : 0
                    return (
                      <Link key={c.id} href={`/voice-agent/campaigns/${c.id}`} className="flex items-center justify-between py-2 hover:bg-accent/30 -mx-6 px-6 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.source_type} &middot; {c.calls_made}/{c.total_prospects} calls &middot; {c.calls_booked} booked
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Calls */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Recent calls</h2>
              {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No calls yet. Use &quot;Quick call&quot; or launch a campaign to start.</p>
              ) : (
                <div className="space-y-3">
                  {calls.map((call) => (
                    <div key={call.id} className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors" onClick={() => openCallDetail(call.id)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                          {call.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{call.name} &middot; {call.company}</p>
                          <p className="text-xs text-muted-foreground truncate">{call.signal_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="secondary" className={cn("text-xs font-medium", STATUS_COLORS[call.status])}>
                          {call.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{call.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call List Source */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Call list source</h2>
              <Select value={config?.call_list_source} onValueChange={(v) => saveConfig({ call_list_source: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CALL_LIST_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">ICP filter</p>
                  <p className="text-sm">{config?.icp_filter}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">In queue</p>
                  <p className="text-xl font-bold">{stats?.in_queue ?? 0} <span className="text-sm font-normal text-muted-foreground">contacts</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CRM + follow-up */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">CRM + follow-up</h2>
              <div className="space-y-4">
                <CrmToggle label="Auto-create HubSpot contact after call" checked={config?.crm_settings.auto_create_hubspot ?? true} onChange={() => handleCrmToggle("auto_create_hubspot")} />
                <CrmToggle label="Log call transcript to CRM" checked={config?.crm_settings.log_transcript ?? true} onChange={() => handleCrmToggle("log_transcript")} />
                <CrmToggle label="Send follow-up email after voicemail" checked={config?.crm_settings.send_followup_email ?? true} onChange={() => handleCrmToggle("send_followup_email")} />
                <CrmToggle label={'Add "booked" contacts to Slack alert'} checked={config?.crm_settings.slack_booked_alert ?? false} onChange={() => handleCrmToggle("slack_booked_alert")} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Analytics Dialog */}
      {/* ================================================================ */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Voice Agent Analytics</DialogTitle>
            <DialogDescription>Detailed performance breakdown</DialogDescription>
          </DialogHeader>
          {analyticsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading analytics...</div>
          ) : analyticsData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{analyticsData.total_calls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{analyticsData.successful}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{analyticsData.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{analyticsData.booking_rate}%</p>
                  <p className="text-xs text-muted-foreground">Booking Rate</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{analyticsData.avg_duration_seconds}s</p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{analyticsData.total_credits_spent}</p>
                  <p className="text-xs text-muted-foreground">Credits Spent</p>
                </div>
              </div>
              {analyticsData.daily_calls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Calls per day (last 7 days)</h4>
                  <div className="flex items-end gap-1 h-24">
                    {analyticsData.daily_calls.map((d) => {
                      const max = Math.max(...analyticsData.daily_calls.map((x) => x.calls), 1)
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(d.calls / max) * 80}px` }} />
                          <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {analyticsData.top_companies.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Top companies called</h4>
                  <div className="space-y-1">
                    {analyticsData.top_companies.map((c) => (
                      <div key={c.company} className="flex items-center justify-between text-sm">
                        <span>{c.company}</span>
                        <span className="text-muted-foreground">{c.calls} calls</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No analytics data yet. Make some calls first.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Upload List Dialog */}
      {/* ================================================================ */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Contact List</DialogTitle>
            <DialogDescription>Upload a CSV with name, phone, company columns</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            {!uploadResult ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
              >
                <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{uploading ? "Uploading..." : "Click to select CSV file"}</p>
                <p className="text-xs text-muted-foreground mt-1">Max 5MB. Requires name and phone columns.</p>
              </button>
            ) : (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Upload successful</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">File</p>
                    <p className="font-medium">{uploadResult.filename}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contacts imported</p>
                    <p className="font-medium">{uploadResult.uploaded}</p>
                  </div>
                  {uploadResult.skipped > 0 && (
                    <div>
                      <p className="text-muted-foreground">Skipped (missing data)</p>
                      <p className="font-medium text-amber-600">{uploadResult.skipped}</p>
                    </div>
                  )}
                </div>
                {uploadResult.contacts_preview.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                    <div className="space-y-1">
                      {uploadResult.contacts_preview.map((c, i) => (
                        <p key={i} className="text-xs">{c.name} &middot; {c.phone} &middot; {c.company || "—"}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </div>
            )}
          </div>
          <DialogFooter>
            {uploadResult && (
              <Button variant="outline" onClick={() => { setUploadResult(null); fileInputRef.current && (fileInputRef.current.value = "") }}>
                Upload another
              </Button>
            )}
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* New Campaign Dialog */}
      {/* ================================================================ */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick call</DialogTitle>
            <DialogDescription>One-off call to a single prospect — for bulk or signal-triggered calls use &quot;+ New campaign&quot; instead. Costs 5 credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Prospect name *</Label>
              <Input value={campaignForm.prospect_name} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Phone number *</Label>
              <Input value={campaignForm.prospect_phone} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_phone: e.target.value })} placeholder="+1234567890" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={campaignForm.prospect_company} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_company: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={campaignForm.prospect_role} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_role: e.target.value })} placeholder="VP Sales" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={campaignForm.prospect_city} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_city: e.target.value })} placeholder="San Francisco" />
              </div>
              <div>
                <Label>Industry</Label>
                <Input value={campaignForm.prospect_industry} onChange={(e) => setCampaignForm({ ...campaignForm, prospect_industry: e.target.value })} placeholder="SaaS" />
              </div>
            </div>
            <div>
              <Label>Call objective</Label>
              <Select value={campaignForm.call_objective} onValueChange={(v) => setCampaignForm({ ...campaignForm, call_objective: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery call</SelectItem>
                  <SelectItem value="demo">Intro demo</SelectItem>
                  <SelectItem value="follow_up">Follow up</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Context (optional)</Label>
              <Input value={campaignForm.context} onChange={(e) => setCampaignForm({ ...campaignForm, context: e.target.value })} placeholder="Recently raised Series A..." />
            </div>
            {campaignResult && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                Call initiated: {campaignResult}
              </div>
            )}
            {campaignError && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {campaignError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignOpen(false)}>Cancel</Button>
            <Button onClick={handleCampaignSubmit} disabled={campaignSubmitting || !campaignForm.prospect_name || !campaignForm.prospect_phone}>
              <Phone className="h-4 w-4 mr-2" />
              {campaignSubmitting ? "Calling..." : "Trigger call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Call Details Dialog */}
      {/* ================================================================ */}
      <Dialog open={callDetailOpen} onOpenChange={setCallDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              {callDetail ? `${callDetail.prospect.name} at ${callDetail.prospect.company}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>
          {callDetailLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading call details...</div>
          ) : callDetail ? (
            <div className="space-y-5">
              {/* Call info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="secondary" className={cn("mt-1", callDetail.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                    {callDetail.status}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-lg font-bold mt-0.5">{callDetail.duration}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="text-lg font-bold mt-0.5">{callDetail.credits_used}</p>
                </div>
              </div>

              {/* Prospect info */}
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">Prospect</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {callDetail.prospect.name}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {callDetail.prospect.phone}</div>
                  <div><span className="text-muted-foreground">Company:</span> {callDetail.prospect.company}</div>
                  <div><span className="text-muted-foreground">Role:</span> {callDetail.prospect.role}</div>
                  {callDetail.prospect.city && <div><span className="text-muted-foreground">City:</span> {callDetail.prospect.city}</div>}
                  {callDetail.prospect.industry && <div><span className="text-muted-foreground">Industry:</span> {callDetail.prospect.industry}</div>}
                </div>
              </div>

              {/* Extracted Variables — the key intel from the call */}
              {callDetail.extracted_variables && Object.values(callDetail.extracted_variables).some(v => v) && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-3">Extracted from conversation</h4>
                  <div className="space-y-2">
                    {[
                      { key: "pain_points", label: "Pain Points", color: "text-red-600" },
                      { key: "current_tools", label: "Current Tools", color: "text-blue-600" },
                      { key: "budget_mentioned", label: "Budget", color: "text-green-600" },
                      { key: "decision_maker", label: "Decision Maker", color: "text-purple-600" },
                      { key: "next_steps", label: "Next Steps", color: "text-emerald-600" },
                      { key: "objections", label: "Objections", color: "text-amber-600" },
                      { key: "competitor_mentioned", label: "Competitors", color: "text-orange-600" },
                      { key: "timeline", label: "Timeline", color: "text-indigo-600" },
                      { key: "key_quotes", label: "Key Quotes", color: "text-pink-600" },
                    ].map(({ key, label, color }) => {
                      const val = callDetail.extracted_variables[key as keyof typeof callDetail.extracted_variables]
                      if (!val) return null
                      return (
                        <div key={key} className="flex gap-2">
                          <span className={cn("text-xs font-medium w-28 shrink-0 pt-0.5", color)}>{label}</span>
                          <span className="text-sm">{val}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {callDetail.transcript && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-2">Transcript</h4>
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground max-h-60 overflow-y-auto bg-muted/30 rounded p-3">
                    {callDetail.transcript}
                  </div>
                </div>
              )}

              {callDetail.disconnection_reason && (
                <p className="text-xs text-muted-foreground">Disconnection: {callDetail.disconnection_reason}</p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No details available for this call.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Custom Signal Trigger Dialog */}
      {/* ================================================================ */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Signal Trigger</DialogTitle>
            <DialogDescription>Create a custom trigger for automatic voice calls</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Trigger name *</Label>
              <Input value={triggerForm.name} onChange={(e) => setTriggerForm({ ...triggerForm, name: e.target.value })} placeholder="e.g., Product launch detected" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={triggerForm.description} onChange={(e) => setTriggerForm({ ...triggerForm, description: e.target.value })} placeholder="e.g., Call when company launches new product" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTrigger} disabled={!triggerForm.name}>
              <Plus className="h-4 w-4 mr-2" />
              Add trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(c) => { setCampaigns((prev) => [c, ...prev]) }}
      />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function PerformanceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums w-12 text-right">{value}%</span>
    </div>
  )
}

function CrmToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
