"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Eye, Search, Download, Plus,
  Activity, UserCheck, Building2,
  AlertCircle, RefreshCw
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { WatcherFilterSidebar } from "@/components/leads/watcher/watcher-filter-sidebar"
import { WatcherCard } from "@/components/leads/watcher/watcher-card"
import { CreateWatcherDialog } from "@/components/leads/watcher/create-watcher-dialog"
import { Badge } from "@/components/ui/badge"

// ──────────────────────────────────────────────
// Types  (mirrors Pydantic WatcherResponse)
// ──────────────────────────────────────────────
interface Watcher {
  id: string
  name: string
  description: string | null
  type: "event" | "account" | "lead"
  status: "active" | "paused" | "draft"
  match_count: number
  new_matches_count: number
  last_triggered_at: string | null
  created_at: string
}

// ──────────────────────────────────────────────
// API layer
// ──────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init
  })
  if (res.status === 204) return null as unknown as T
  const body = await res.json()
  if (!res.ok) throw new Error(body.detail ?? res.statusText)
  return body as T
}

const api = {
  listByType:    (type: string)                  => req<Watcher[]>(`/api/watchers?type=${type}`),
  createEvent:   (p: Record<string, unknown>)   => req<Watcher>("/api/watchers/event",   { method: "POST", body: JSON.stringify(p) }),
  createAccount: (p: Record<string, unknown>)   => req<Watcher>("/api/watchers/account", { method: "POST", body: JSON.stringify(p) }),
  createLead:    (p: Record<string, unknown>)   => req<Watcher>("/api/watchers/lead",    { method: "POST", body: JSON.stringify(p) }),
  toggle:        (id: string)                   => req<Watcher>(`/api/watchers/${id}/toggle`, { method: "POST" }),
  remove:        (id: string)                   => req<void>   (`/api/watchers/${id}`,        { method: "DELETE" }),
  sync:          (id: string)                   => req<Watcher>(`/api/watchers/${id}/sync`,   { method: "POST" })
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function WatcherPage() {
  const [activeTab, setActiveTab] = useState<"events"|"accounts"|"leads">("events")
  const [q, setQ] = useState("")

  const [events,   setEvents]   = useState<Watcher[]>([])
  const [accounts, setAccounts] = useState<Watcher[]>([])
  const [leads,    setLeads]    = useState<Watcher[]>([])

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // ── fetch ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [ev, ac, ld] = await Promise.all([
        api.listByType("event"),
        api.listByType("account"),
        api.listByType("lead")
      ])
      setEvents(ev); setAccounts(ac); setLeads(ld)
    } catch (e) { setError((e as Error).message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── state helpers ─────────────────────────────────────────
  const setterFor = (type: string) =>
    type === "event" ? setEvents : type === "account" ? setAccounts : setLeads

  // ── create ────────────────────────────────────────────────
  const handleCreate = async (payload: Record<string, unknown>) => {
    try {
      const type   = payload.type as string
      const create = type === "event" ? api.createEvent : type === "account" ? api.createAccount : api.createLead
      const created = await create(payload)
      setterFor(type)(prev => [created, ...prev])
      setCreateOpen(false)
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

  // ── local search ──────────────────────────────────────────
  const filter = (list: Watcher[]) =>
    q ? list.filter(w =>
      w.name.toLowerCase().includes(q.toLowerCase()) ||
      (w.description ?? "").toLowerCase().includes(q.toLowerCase())
    ) : list

  const activeCount = (list: Watcher[]) => list.filter(w => w.status === "active").length

  // ── render ────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <WatcherFilterSidebar activeTab={activeTab} />

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
                  <Button variant="outline" className="gap-2 bg-background" onClick={load} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                  </Button>
                  <Button variant="outline" className="gap-2 bg-background">
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
            <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/8 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 flex-1">{error}</p>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10" onClick={() => setError(null)}>Dismiss</Button>
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
                <TabBody watchers={filter(events)}   loading={loading} emptyIcon={Activity}  emptyTitle="No event watchers yet"   emptyDesc="Create watchers to discover accounts or leads based on funding rounds, tech stack changes, or executive hires."  emptyAction="Create Event Watcher"   onToggle={handleToggle} onDelete={handleDelete} onEmpty={() => setCreateOpen(true)} />
              </TabsContent>
              <TabsContent value="accounts" className="mt-0">
                <TabBody watchers={filter(accounts)} loading={loading} emptyIcon={Building2} emptyTitle="No account watchers yet" emptyDesc="Track real-time updates on specific companies including funding, hiring, and technology changes."                 emptyAction="Create Account Watcher" onToggle={handleToggle} onDelete={handleDelete} onEmpty={() => setCreateOpen(true)} />
              </TabsContent>
              <TabsContent value="leads"    className="mt-0">
                <TabBody watchers={filter(leads)}    loading={loading} emptyIcon={UserCheck} emptyTitle="No lead watchers yet"    emptyDesc="Monitor decision makers for job changes, published content, speaking engagements, and other key signals."            emptyAction="Create Lead Watcher"    onToggle={handleToggle} onDelete={handleDelete} onEmpty={() => setCreateOpen(true)} />
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
  onEmpty: () => void
}

function TabBody({ watchers, loading, emptyIcon: Icon, emptyTitle, emptyDesc, emptyAction, onToggle, onDelete, onEmpty }: TabBodyProps) {
  const handleToggleFor = (w: Watcher) => () => onToggle(w);
  const handleDeleteFor = (w: Watcher) => () => onDelete(w);
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
        />
      ))}
    </div>
  );
}