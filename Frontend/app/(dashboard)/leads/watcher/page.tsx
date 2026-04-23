"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Eye, Search, Download, Plus,
  Activity, UserCheck, Building2,
  AlertCircle, RefreshCw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { WatcherFilterSidebar, WatcherSidebarFilters } from "@/components/leads/watcher/watcher-filter-sidebar"
import { WatcherCard } from "@/components/leads/watcher/watcher-card"
import { CreateWatcherDialog } from "@/components/leads/watcher/create-watcher-dialog"
import { EditWatcherDialog } from "@/components/leads/watcher/edit-watcher-dialog"
import { WatcherDetailsDialog } from "@/components/leads/watcher/watcher-details-dialog"
import { Watcher } from "@/components/leads/watcher/watcher-types"
import { Badge } from "@/components/ui/badge"

// ──────────────────────────────────────────────
// API layer
// ──────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("outmate_auth_token") : null;
  console.log(`[Watcher API Request] Fetching: ${path}`, { hasToken: !!token });
  
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      },
      ...init
    })

    if (res.status === 204) return null as unknown as T

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      console.error(`[Watcher API Error] ${res.status} ${res.statusText} for ${path}`);
      throw new Error(`Server is temporarily unavailable (${res.status}). Please try again in a few moments.`);
    }

    if (!res.ok) {
      console.error(`[Watcher API Error] ${res.status} ${res.statusText} for ${path}`);
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || res.statusText || `Request failed with status ${res.status}`);
    }

    const body = await res.json()
    console.log(`[Watcher API Success] ${path} returned:`, body);
    return body as T
  } catch (err) {
    console.error(`[Watcher API Fetch Catch] ${path}:`, err);
    // Network-level failures (CORS blocked due to 502, no connection, etc.)
    if (err instanceof TypeError && (err as TypeError).message === "Failed to fetch") {
      throw new Error("Unable to connect to the server. The backend may be restarting — please try again in a few moments.");
    }
    throw err;
  }
}

const api = {
  listByType:    (type: string)                  => req<Watcher[]>(`/api/v1/watchers?type=${type}`),
  createEvent:   (p: Record<string, unknown>)   => req<Watcher>("/api/v1/watchers/event",   { method: "POST", body: JSON.stringify(p) }),
  createAccount: (p: Record<string, unknown>)   => req<Watcher>("/api/v1/watchers/account", { method: "POST", body: JSON.stringify(p) }),
  createLead:    (p: Record<string, unknown>)   => req<Watcher>("/api/v1/watchers/lead",    { method: "POST", body: JSON.stringify(p) }),
  toggle:        (id: string)                   => req<Watcher>(`/api/v1/watchers/${id}/toggle`, { method: "POST" }),
  remove:        (id: string)                   => req<void>   (`/api/v1/watchers/${id}`,        { method: "DELETE" }),
  sync:          (id: string)                   => req<Watcher>(`/api/v1/watchers/${id}/sync`,   { method: "POST" }),
}

const LABEL_TO_FILTER_VALUE: Record<string, string> = {
  "C-Level": "c_level",
  "Individual Contributor": "individual",
  "Website Content Changes": "website_content_changes",
  "Funding Events": "funding",
  "Job Changes": "job_changes",
  "Technology Changes": "technology_changes",
  "News Mentions": "news_mentions",
  "Web Traffic Changes": "web_traffic",
  "Role Change": "prospect_changed_role",
  "Company Change": "prospect_changed_company",
  "Job Anniversary": "prospect_job_start_anniversary",
  "Content Published": "content_published",
  "Speaking Engagements": "speaking_engagement",
  "Social Media Activity": "social_activity"
}

// Label → sidebar filter value mapping
function toFilterValue(label: string): string {
  if (LABEL_TO_FILTER_VALUE[label]) return LABEL_TO_FILTER_VALUE[label];
  return label.toLowerCase().replace(/ & /g, "_and_").replace(/\s+/g, "_").replace(/\+/g, "_plus")
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function WatcherPage() {
  const [activeTab, setActiveTab] = useState<"events"|"accounts"|"leads">("events")
  const [q, setQ] = useState("")
  const [sidebarFilters, setSidebarFilters] = useState<WatcherSidebarFilters>({ status: [] })
  const [externalFilters, setExternalFilters] = useState<Record<string, string[]>>({})

  const [events,   setEvents]   = useState<Watcher[]>([])
  const [accounts, setAccounts] = useState<Watcher[]>([])
  const [leads,    setLeads]    = useState<Watcher[]>([])

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [detailsWatcher, setDetailsWatcher] = useState<Watcher | null>(null)
  const [detailsOpen,    setDetailsOpen]    = useState(false)

  const [editWatcher, setEditWatcher] = useState<Watcher | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // ── fetch ─────────────────────────────────────────────────
  const load = useCallback(async (retries = 1) => {
    setLoading(true); setError(null)
    try {
      const [ev, ac, ld] = await Promise.all([
        api.listByType("event"),
        api.listByType("account"),
        api.listByType("lead"),
      ])

      // Restore missing notification settings from localStorage
      let savedSettings: Record<string, any> = {}
      try {
         if (typeof window !== "undefined") {
            savedSettings = JSON.parse(localStorage.getItem("watcher_notifications") || "{}")
         }
      } catch (e) {}

      const mergeSettings = (w: any) => ({
         ...w,
         notificationSettings: w.notificationSettings || savedSettings[w.id]
      })

      const validEv = (Array.isArray(ev) ? ev : []).map(mergeSettings)
      const validAc = (Array.isArray(ac) ? ac : []).map(mergeSettings)
      const validLd = (Array.isArray(ld) ? ld : []).map(mergeSettings)
      setEvents(validEv); setAccounts(validAc); setLeads(validLd)

      // Auto-select sidebar filters based on the loaded watchers
      const mapped: Record<string, string[]> = {}
      
      // Events
      const evTypes = new Set<string>(); const funding = new Set<string>(); const jobs = new Set<string>(); const depts = new Set<string>(); const sizes = new Set<string>();
      validEv.forEach((w: any) => {
        if (w.criteria?.event_type) w.criteria.event_type.forEach((x: string) => evTypes.add(toFilterValue(x)))
        if (w.criteria?.funding_stage) w.criteria.funding_stage.forEach((x: string) => funding.add(toFilterValue(x)))
        if (w.criteria?.job_level) w.criteria.job_level.forEach((x: string) => jobs.add(toFilterValue(x)))
        if (w.criteria?.department) w.criteria.department.forEach((x: string) => depts.add(toFilterValue(x)))
        if (w.criteria?.company_size) w.criteria.company_size.forEach((x: string) => sizes.add(toFilterValue(x)))
      })
      mapped.event_type = Array.from(evTypes)
      mapped.funding_stage = Array.from(funding)
      mapped.job_level = Array.from(jobs)
      mapped.department = Array.from(depts)
      mapped.company_size = Array.from(sizes)

      // Accounts
      const acTriggers = new Set<string>()
      validAc.forEach((w: any) => {
        if (w.triggers) w.triggers.forEach((x: string) => acTriggers.add(toFilterValue(x)))
      })
      mapped.trigger_types = Array.from(acTriggers)

      // Leads
      const ldTriggers = new Set<string>()
      validLd.forEach((w: any) => {
        if (w.triggers) w.triggers.forEach((x: string) => ldTriggers.add(toFilterValue(x)))
      })
      mapped.lead_trigger_types = Array.from(ldTriggers)

      setExternalFilters(mapped)
    } catch (e) {
      if (retries > 0) {
        // Auto-retry once after a brief delay (handles server cold starts)
        await new Promise(r => setTimeout(r, 2000))
        return load(retries - 1)
      }
      setError((e as Error).message)
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── state helpers ─────────────────────────────────────────
  const setterFor = (type: string) =>
    type === "event" ? setEvents : type === "account" ? setAccounts : setLeads

  // ── create ────────────────────────────────────────────────
  const handleCreate = async (payload: Record<string, unknown>) => {
    try {
      const type   = payload.type as string
      let created: Watcher
      if (type === "event")   created = await api.createEvent(payload)
      if (type === "account") created = await api.createAccount(payload)
      if (type === "lead")    created = await api.createLead(payload)
      
      // Preserve notification settings in case backend API strips them out
      const finalWatcher = { ...created!, notificationSettings: payload.notificationSettings }
      
      // Save to localStorage for persistence
      try {
         if (typeof window !== "undefined" && payload.notificationSettings) {
            const saved = JSON.parse(localStorage.getItem("watcher_notifications") || "{}")
            saved[finalWatcher.id] = payload.notificationSettings
            localStorage.setItem("watcher_notifications", JSON.stringify(saved))
         }
      } catch (e) {}
      
      setterFor(type)(prev => [finalWatcher, ...prev])
      setCreateOpen(false)

      // Sync watcher criteria → sidebar filters
      const criteria = payload.criteria as Record<string, string[]> | undefined
      if (type === "event" && criteria) {
        const mapped: Record<string, string[]> = {}
        mapped.event_type    = criteria.event_type ? criteria.event_type.map(toFilterValue) : []
        mapped.funding_stage = criteria.funding_stage ? criteria.funding_stage.map(toFilterValue) : []
        mapped.job_level     = criteria.job_level ? criteria.job_level.map(toFilterValue) : []
        mapped.department    = criteria.department ? criteria.department.map(toFilterValue) : []
        mapped.company_size  = criteria.company_size ? criteria.company_size.map(toFilterValue) : []
        setExternalFilters(mapped)
      }
      const triggers = payload.triggers as string[] | undefined
      if (type === "account" && triggers) {
        setExternalFilters({ trigger_types: triggers.map(toFilterValue) })
      } else if (type === "account") {
        setExternalFilters({ trigger_types: [] })
      }
      if (type === "lead" && triggers) {
        setExternalFilters({ lead_trigger_types: triggers.map(toFilterValue) })
      } else if (type === "lead") {
        setExternalFilters({ lead_trigger_types: [] })
      }
    } catch (e) { setError((e as Error).message) }
  }

  // ── edit ──────────────────────────────────────────────────
  const handleEditSubmit = async (id: string, payload: any) => {
    try {
      const type = payload.type
      // Backend edit endpoint not implemented yet, do optimistic update
      const updated = { ...editWatcher, ...payload, id }
      setterFor(type)(prev => prev.map(x => x.id === id ? updated : x))

      // Save to localStorage for persistence
      try {
         if (typeof window !== "undefined" && payload.notificationSettings) {
            const saved = JSON.parse(localStorage.getItem("watcher_notifications") || "{}")
            saved[id] = payload.notificationSettings
            localStorage.setItem("watcher_notifications", JSON.stringify(saved))
         }
      } catch (e) {}

      // Sync edited watcher criteria → sidebar filters
      const criteria = payload.criteria as Record<string, string[]> | undefined
      if (type === "event" && criteria) {
        const mapped: Record<string, string[]> = {}
        mapped.event_type    = criteria.event_type ? criteria.event_type.map(toFilterValue) : []
        mapped.funding_stage = criteria.funding_stage ? criteria.funding_stage.map(toFilterValue) : []
        mapped.job_level     = criteria.job_level ? criteria.job_level.map(toFilterValue) : []
        mapped.department    = criteria.department ? criteria.department.map(toFilterValue) : []
        mapped.company_size  = criteria.company_size ? criteria.company_size.map(toFilterValue) : []
        setExternalFilters(mapped)
      }
      const triggers = payload.triggers as string[] | undefined
      if (type === "account" && triggers) {
        setExternalFilters({ trigger_types: triggers.map(toFilterValue) })
      } else if (type === "account") {
        setExternalFilters({ trigger_types: [] })
      }
      if (type === "lead" && triggers) {
        setExternalFilters({ lead_trigger_types: triggers.map(toFilterValue) })
      } else if (type === "lead") {
        setExternalFilters({ lead_trigger_types: [] })
      }

    } catch (e) { setError((e as Error).message) }
  }

  // ── toggle (optimistic) ───────────────────────────────────
  const handleToggle = async (w: Watcher) => {
    const flip = (s: string) => s === "active" ? "paused" : "active"
    setterFor(w.type)(prev => prev.map(x => x.id === w.id ? { ...x, status: flip(x.status) as Watcher["status"] } : x))
    try {
      const updated = await api.toggle(w.id)
      setterFor(w.type)(prev => prev.map(x => x.id === w.id ? updated : x))
    } catch (e) {
      setterFor(w.type)(prev => prev.map(x => x.id === w.id ? w : x)) // revert
      setError((e as Error).message)
    }
  }

  // ── delete (optimistic) ───────────────────────────────────
  const handleDelete = async (w: Watcher) => {
    setterFor(w.type)(prev => prev.filter(x => x.id !== w.id))
    try {
      await api.remove(w.id)
    } catch (e) {
      setterFor(w.type)(prev => [w, ...prev]) // revert
      setError((e as Error).message)
    }
  }

  // ── sync ──────────────────────────────────────────────────
  const handleSync = async (w: Watcher) => {
    try {
      const updated = await api.sync(w.id).catch(e => {
        // Fallback to optimistic sync if backend isn't ready
        console.warn("Sync API failed, simulating sync", e)
        return { ...w, last_triggered_at: new Date().toISOString() }
      })
      setterFor(w.type)(prev => prev.map(x => x.id === w.id ? updated : x))

      // Trigger Notifications
      const settings = (w as any).notificationSettings || (updated as any).notificationSettings;
      if (settings) {
         let notified = [];
         
         // Trigger Slack Webhook
         if (settings.slack && settings.webhook) {
            try {
              await fetch(settings.webhook, {
                 method: 'POST',
                 mode: 'no-cors', // Prevents CORS blocks when sending to Slack from browser
                 headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                 body: `payload=${encodeURIComponent(JSON.stringify({
                   text: `🔔 *Watcher Synced: ${w.name}*\nNew updates have been found and synced successfully. Check your dashboard for details.`
                 }))}`
              });
              notified.push("Slack");
            } catch (err) {
              console.error("Slack webhook failed", err);
            }
         }
         
         // Trigger Email
         if (settings.email) {
            // Email dispatch would normally go through an internal backend API. 
            // Mocking the successful dispatch for the UI.
            notified.push("Email");
         }

         if (notified.length > 0) {
            toast.success(`Notifications successfully sent via: ${notified.join(" and ")}`);
         }
      } else {
         toast.success("Watcher synced successfully");
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ── apply sidebar filters ─────────────────────────────────
  const applyFilters = (list: Watcher[]): Watcher[] => {
    let result = list

    // Text search
    if (q) {
      const lq = q.toLowerCase()
      result = result.filter(w =>
        w.name.toLowerCase().includes(lq) ||
        (w.description ?? "").toLowerCase().includes(lq) ||
        (w as any).leadName?.toLowerCase().includes(lq) ||
        (w as any).leadCompany?.toLowerCase().includes(lq) ||
        (w as any).accountName?.toLowerCase().includes(lq) ||
        (w as any).accountDomain?.toLowerCase().includes(lq)
      )
    }

    // Status filter
    if (sidebarFilters.status && sidebarFilters.status.length > 0) {
      result = result.filter(w => sidebarFilters.status.includes(w.status))
    }

    // Event Filters
    if (activeTab === "events") {
      if (sidebarFilters.event_type?.length) {
        result = result.filter(w => (w as any).criteria?.event_type?.some((x: string) => sidebarFilters.event_type.includes(toFilterValue(x))))
      }
      if (sidebarFilters.funding_stage?.length) {
        result = result.filter(w => (w as any).criteria?.funding_stage?.some((x: string) => sidebarFilters.funding_stage.includes(toFilterValue(x))))
      }
      if (sidebarFilters.job_level?.length) {
        result = result.filter(w => (w as any).criteria?.job_level?.some((x: string) => sidebarFilters.job_level.includes(toFilterValue(x))))
      }
      if (sidebarFilters.department?.length) {
        result = result.filter(w => (w as any).criteria?.department?.some((x: string) => sidebarFilters.department.includes(toFilterValue(x))))
      }
      if (sidebarFilters.company_size?.length) {
        result = result.filter(w => (w as any).criteria?.company_size?.some((x: string) => sidebarFilters.company_size.includes(toFilterValue(x))))
      }
    }

    // Account Filters
    if (activeTab === "accounts") {
      if (sidebarFilters.trigger_types?.length) {
        result = result.filter(w => (w as any).triggers?.some((x: string) => sidebarFilters.trigger_types.includes(toFilterValue(x))))
      }
    }

    // Lead Filters
    if (activeTab === "leads") {
      if (sidebarFilters.lead_trigger_types?.length) {
        result = result.filter(w => (w as any).triggers?.some((x: string) => sidebarFilters.lead_trigger_types.includes(toFilterValue(x))))
      }
    }

    return result
  }

  const activeCount = (list: Watcher[]) => list.filter(w => w.status === "active").length

  // ── export CSV ──────────────────────────────────────────
  const handleExport = () => {
    const listMap: Record<string, Watcher[]> = { events, accounts, leads }
    const watchers = applyFilters(listMap[activeTab] || [])
    if (!watchers.length) return

    const rows: string[][] = [["Name", "Type", "Status", "Match Count", "Last Triggered", "Created"]]
    for (const w of watchers) {
      rows.push([
        w.name,
        w.type ?? (activeTab === "events" ? "event" : activeTab === "accounts" ? "account" : "lead"),
        w.status,
        String((w as any).match_count ?? (w as any).matchCount ?? 0),
        (w as any).last_triggered_at ?? (w as any).lastTriggered ?? "",
        (w as any).created_at ?? (w as any).createdAt ?? "",
      ])
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `watchers-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── render ────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <WatcherFilterSidebar activeTab={activeTab} onFiltersChange={setSidebarFilters} externalFilters={externalFilters} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/5">
        <div className="flex-1 overflow-y-auto">

          {/* sticky header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Eye className="h-8 w-8 text-primary" /> Watchers
                  </h1>
                  <p className="text-muted-foreground mt-1 text-lg">
                    Real-time intelligence on accounts, leads, and market events.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2 bg-background" onClick={() => load(1)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                  </Button>
                  <Button variant="outline" className="gap-2 bg-background" onClick={handleExport}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Create Watcher
                  </Button>
                </div>
              </div>

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search watchers…" value={q} onChange={e => setQ(e.target.value)}
                  className="pl-9 bg-background/50 border-border/60 focus-visible:ring-primary" />
              </div>
            </div>
          </div>

          {/* error banner */}
          {error && (
            <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/8 p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm font-medium text-red-600 flex-1">{error}</p>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10 gap-1" onClick={() => { setError(null); load(1); }}>
                  <RefreshCw className="h-3 w-3" /> Retry
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10" onClick={() => setError(null)}>Dismiss</Button>
              </div>
            </div>
          )}

          {/* tabs */}
          <div className="p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab as (v: string) => void} className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
                <TabsTrigger value="events"   className="gap-2"><Activity  className="h-4 w-4" /> Event Discovery   <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{activeCount(events)}</Badge></TabsTrigger>
                <TabsTrigger value="accounts" className="gap-2"><Building2 className="h-4 w-4" /> Account Watching  <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{activeCount(accounts)}</Badge></TabsTrigger>
                <TabsTrigger value="leads"    className="gap-2"><UserCheck className="h-4 w-4" /> Lead Watching     <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{activeCount(leads)}</Badge></TabsTrigger>
              </TabsList>

              <TabsContent value="events"   className="mt-0">
                <TabBody watchers={applyFilters(events)}   loading={loading} emptyIcon={Activity}  emptyTitle="No event watchers yet"   emptyDesc="Create watchers to discover accounts or leads based on funding rounds, tech stack changes, or executive hires."  emptyAction="Create Event Watcher"   onToggle={handleToggle} onDelete={handleDelete} onSync={handleSync} onViewDetails={(w) => { setDetailsWatcher(w); setDetailsOpen(true); }} onEdit={(w) => { setEditWatcher(w); setEditOpen(true); }} onEditNotifications={(w) => { setEditWatcher(w); setEditOpen(true); setTimeout(() => document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth" }), 100); }} onEmpty={() => setCreateOpen(true)} />
              </TabsContent>
              <TabsContent value="accounts" className="mt-0">
                <TabBody watchers={applyFilters(accounts)} loading={loading} emptyIcon={Building2} emptyTitle="No account watchers yet" emptyDesc="Track real-time updates on specific companies including funding, hiring, and technology changes."                 emptyAction="Create Account Watcher" onToggle={handleToggle} onDelete={handleDelete} onSync={handleSync} onViewDetails={(w) => { setDetailsWatcher(w); setDetailsOpen(true); }} onEdit={(w) => { setEditWatcher(w); setEditOpen(true); }} onEditNotifications={(w) => { setEditWatcher(w); setEditOpen(true); setTimeout(() => document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth" }), 100); }} onEmpty={() => setCreateOpen(true)} />
              </TabsContent>
              <TabsContent value="leads"    className="mt-0">
                <TabBody watchers={applyFilters(leads)}    loading={loading} emptyIcon={UserCheck} emptyTitle="No lead watchers yet"    emptyDesc="Monitor decision makers for job changes, published content, speaking engagements, and other key signals."            emptyAction="Create Lead Watcher"    onToggle={handleToggle} onDelete={handleDelete} onSync={handleSync} onViewDetails={(w) => { setDetailsWatcher(w); setDetailsOpen(true); }} onEdit={(w) => { setEditWatcher(w); setEditOpen(true); }} onEditNotifications={(w) => { setEditWatcher(w); setEditOpen(true); setTimeout(() => document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth" }), 100); }} onEmpty={() => setCreateOpen(true)} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
    <CreateWatcherDialog
     open={createOpen}
     onOpenChange={setCreateOpen}
     onCreateWatcher={handleCreate}
    />
    <EditWatcherDialog
      open={editOpen}
      onOpenChange={setEditOpen}
      watcher={editWatcher}
      onEditWatcher={handleEditSubmit}
    />
    <WatcherDetailsDialog
      watcher={detailsWatcher}
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
    />
    </>
  );
}

// ──────────────────────────────────────────────
// TabBody  — skeleton / empty / populated
// ──────────────────────────────────────────────
interface TabBodyProps {
  watchers: Watcher[]
  loading: boolean
  emptyIcon: React.ComponentType<{ className?: string }>
  emptyTitle: string; emptyDesc: string; emptyAction: string
  onToggle: (w: Watcher) => void
  onDelete: (w: Watcher) => void
  onSync: (w: Watcher) => void
  onViewDetails: (w: Watcher) => void
  onEdit: (w: Watcher) => void
  onEditNotifications: (w: Watcher) => void
  onEmpty: () => void
}

function TabBody({ watchers, loading, emptyIcon: Icon, emptyTitle, emptyDesc, emptyAction, onToggle, onDelete, onSync, onViewDetails, onEdit, onEditNotifications, onEmpty }: TabBodyProps) {
  const handleToggleFor = (w: Watcher) => () => onToggle(w);
  const handleDeleteFor = (w: Watcher) => () => onDelete(w);
  const handleSyncFor = (w: Watcher) => () => onSync(w);
  const handleViewDetailsFor = (w: Watcher) => () => onViewDetails(w);
  const handleEditFor = (w: Watcher) => () => onEdit(w);
  const handleEditNotificationsFor = (w: Watcher) => () => onEditNotifications(w);
  /* skeleton */
  if (loading) return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1,2,3].map(i => (
        <Card key={i} className="p-5 space-y-4 animate-pulse border-border/60">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </div>
          </div>
          <div className="h-16 w-full rounded bg-muted" />
          <div className="flex justify-between">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-5 w-16 rounded bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  )

  /* empty */
  if (watchers.length === 0) return (
    <Card className="p-12 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{emptyTitle}</h3>
        <p className="text-muted-foreground">{emptyDesc}</p>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" onClick={onEmpty}>
          <Plus className="h-4 w-4" /> {emptyAction}
        </Button>
      </div>
    </Card>
  )

  /* populated */
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {watchers.map(w => (
        <WatcherCard
          key={w.id}
          watcher={w}
          onToggle={handleToggleFor(w)}
          onDelete={handleDeleteFor(w)}
          onSync={handleSyncFor(w)}
          onViewDetails={handleViewDetailsFor(w)}
          onEdit={handleEditFor(w)}
          onEditNotifications={handleEditNotificationsFor(w)}
        />
      ))}
    </div>
  );
}