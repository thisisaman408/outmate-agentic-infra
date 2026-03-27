"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, RefreshCw, Settings2, Trash2, Pencil, ChevronDown, Search, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import { ExploriumEventCard } from "@/components/signals/explorium-event-card"
import {
    eventsApi,
    type ExploriumEventCard as IExploriumEventCard,
    type EventEnrollment,
    type EventsMetadata,
} from "@/lib/api/events"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BUSINESS_EVENT_TYPES = [
    "ipo_announcement", "new_funding_round", "new_investment",
    "merger_and_acquisitions", "cost_cutting", "new_partnership",
    "new_product", "new_office", "closing_office", "company_award",
    "outages_and_security_breaches", "lawsuits_and_legal_issues",
    "increase_in_all_departments", "decrease_in_all_departments",
    "increase_in_engineering_department", "increase_in_sales_department",
    "decrease_in_engineering_department", "decrease_in_sales_department",
    "employee_joined_company",
    "hiring_in_engineering_department", "hiring_in_sales_department",
    "hiring_in_marketing_department", "hiring_in_finance_department",
]

const DEFAULT_PROSPECT_EVENT_TYPES = [
    "prospect_changed_company",
    "prospect_changed_role",
    "prospect_job_start_anniversary",
]

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function EventCardSkeleton() {
    return (
        <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Enrollment panel item
// ---------------------------------------------------------------------------

interface EnrollmentItemProps {
    enrollment: EventEnrollment
    onDelete: (id: string) => void
    onEdit: (enrollment: EventEnrollment) => void
}

function EnrollmentItem({ enrollment, onDelete, onEdit }: EnrollmentItemProps) {
    const displayId = enrollment.entityName || enrollment.entityId
  
    return (
      <div className="flex flex-col gap-2 py-3 border-b border-border/40 last:border-0">
        
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          
          {/* Entity name/email/link */}
          <p
            className="text-sm font-medium leading-snug break-all flex-1 pr-2"
            title={displayId}
          >
            {displayId}
          </p>
  
          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(enrollment)}
              title="Edit enrollment"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
  
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(enrollment.entityId)}
              title="Delete enrollment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
  
        </div>
  
        {/* Event badges */}
        <div className="flex flex-wrap gap-1.5">
          {enrollment.eventTypes.slice(0, 3).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="text-[10px] px-1.5 py-0 leading-tight capitalize"
            >
              {t.replace(/_/g, " ")}
            </Badge>
          ))}
  
          {enrollment.eventTypes.length > 3 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0"
            >
              +{enrollment.eventTypes.length - 3}
            </Badge>
          )}
        </div>
      </div>
    )
  }

// ---------------------------------------------------------------------------
// Add enrollment dialog
// ---------------------------------------------------------------------------

interface AddEnrollDialogProps {
    open: boolean
    onClose: () => void
    entityType: "business" | "prospect"
    eventTypeOptions: string[]
    onSave: (entityId: string, eventTypes: string[], entityName?: string) => Promise<void>
}

function AddEnrollDialog({ open, onClose, entityType, eventTypeOptions, onSave }: AddEnrollDialogProps) {
    const [query, setQuery] = useState("")
    const [bizMatches, setBizMatches] = useState<{ business_id: string; name: string; domain?: string }[]>([])
    const [proMatches, setProMatches] = useState<{ prospect_id: string; name: string; company?: string; email?: string }[]>([])
    const [selected, setSelected] = useState<string[]>(eventTypeOptions)
    const [chosenId, setChosenId] = useState("")
    const [chosenName, setChosenName] = useState("")
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) {
            setQuery(""); setBizMatches([]); setProMatches([]); setChosenId(""); setChosenName(""); setSelected(eventTypeOptions)
        }
    }, [open, eventTypeOptions])

    const handleSearch = async () => {
        if (!query.trim()) return
        setSearching(true)
        setBizMatches([]); setProMatches([]); setChosenId("")
        try {
            if (entityType === "prospect") {
                const q = query.trim()
                let payload: Record<string, string> = {}
                if (q.startsWith("http") || q.includes("linkedin.com")) {
                    payload = { linkedin: q }
                } else if (q.includes("@")) {
                    payload = { email: q }
                } else {
                    payload = { full_name: q }
                }
                const res = await eventsApi.matchProspect(payload)
                setProMatches(res.matches || [])
                if (res.matches?.length === 1) {
                    setChosenId(res.matches[0].prospect_id)
                    setChosenName(res.matches[0].name)
                }
                if (res.error) toast.error(`Lookup error: ${res.error}`)
            } else {
                const payload = query.includes(".") ? { domain: query.trim() } : { name: query.trim() }
                const res = await eventsApi.matchBusiness(payload)
                setBizMatches(res.matches || [])
                if (res.matches?.length === 1) {
                    setChosenId(res.matches[0].business_id)
                    setChosenName(res.matches[0].name)
                }
            }
        } catch {
            toast.error("Lookup failed — try a different query")
        } finally {
            setSearching(false)
        }
    }

    const toggle = (key: string) =>
        setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

    const handleSave = async () => {
        if (!chosenId || selected.length === 0) {
            toast.error(entityType === "business" ? "Search and select a company first" : "Search and select a prospect first")
            return
        }
        setSaving(true)
        try {
            await onSave(chosenId, selected, chosenName || chosenId)
            onClose()
        } catch {
            // onSave already surfaces the error via toast
        } finally {
            setSaving(false)
        }
    }

    const isProspect = entityType === "prospect"
    const matches = isProspect ? proMatches : bizMatches

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Add {isProspect ? "Prospect" : "Business"} Enrollment
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="entity-query">
                            {isProspect ? "Name, Email, or LinkedIn URL" : "Company Name or Domain"}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="entity-query"
                                placeholder={isProspect ? "e.g. john@acme.com or LinkedIn URL" : "e.g. Salesforce or salesforce.com"}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                            <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {matches.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Select {isProspect ? "Prospect" : "Company"}</Label>
                            <div className="border rounded-md divide-y">
                                {isProspect
                                    ? proMatches.map((m) => (
                                        <button
                                            key={m.prospect_id}
                                            type="button"
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${chosenId === m.prospect_id ? "bg-muted" : ""}`}
                                            onClick={() => { setChosenId(m.prospect_id); setChosenName(m.name) }}
                                        >
                                            <span>
                                                <span className="font-medium">{m.name}</span>
                                                {m.company && <span className="text-muted-foreground ml-2 text-xs">{m.company}</span>}
                                                {m.email && <span className="text-muted-foreground ml-2 text-xs">{m.email}</span>}
                                            </span>
                                            {chosenId === m.prospect_id && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                    ))
                                    : bizMatches.map((m) => (
                                        <button
                                            key={m.business_id}
                                            type="button"
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${chosenId === m.business_id ? "bg-muted" : ""}`}
                                            onClick={() => { setChosenId(m.business_id); setChosenName(m.name) }}
                                        >
                                            <span>
                                                <span className="font-medium">{m.name}</span>
                                                {m.domain && <span className="text-muted-foreground ml-2 text-xs">{m.domain}</span>}
                                            </span>
                                            {chosenId === m.business_id && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {chosenId && (
                        <p className="text-xs text-muted-foreground">
                            Selected: <strong>{chosenName}</strong> <span className="font-mono opacity-60">({chosenId})</span>
                        </p>
                    )}

                    <div className="space-y-2">
                        <Label>Event Types</Label>
                        <ScrollArea className="h-44 border rounded-md p-2">
                            {eventTypeOptions.map((key) => (
                                <div key={key} className="flex items-center gap-2 py-1">
                                    <Checkbox
                                        id={key}
                                        checked={selected.includes(key)}
                                        onCheckedChange={() => toggle(key)}
                                    />
                                    <label htmlFor={key} className="text-sm cursor-pointer capitalize">
                                        {key.replace(/_/g, " ")}
                                    </label>
                                </div>
                            ))}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || searching}>
                        {saving ? "Saving…" : "Enroll"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ---------------------------------------------------------------------------
// Edit enrollment dialog
// ---------------------------------------------------------------------------

interface EditEnrollDialogProps {
    open: boolean
    onClose: () => void
    enrollment: EventEnrollment | null
    eventTypeOptions: string[]
    onSave: (entityId: string, eventTypes: string[]) => Promise<void>
}

function EditEnrollDialog({ open, onClose, enrollment, eventTypeOptions, onSave }: EditEnrollDialogProps) {
    const [selected, setSelected] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (enrollment) setSelected(enrollment.eventTypes)
    }, [enrollment])

    const toggle = (key: string) =>
        setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

    const handleSave = async () => {
        if (!enrollment || selected.length === 0) {
            toast.error("Select at least one event type")
            return
        }
        setSaving(true)
        try {
            await onSave(enrollment.entityId, selected)
            onClose()
        } catch {
            // onSave already surfaces the error via toast
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Enrollment</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <p className="text-sm text-muted-foreground">
                        Editing: <strong>{enrollment?.entityName || enrollment?.entityId}</strong>
                    </p>
                    <ScrollArea className="h-48 border rounded-md p-2">
                        {eventTypeOptions.map((key) => (
                            <div key={key} className="flex items-center gap-2 py-1">
                                <Checkbox
                                    id={`edit-${key}`}
                                    checked={selected.includes(key)}
                                    onCheckedChange={() => toggle(key)}
                                />
                                <label htmlFor={`edit-${key}`} className="text-sm cursor-pointer capitalize">
                                    {key.replace(/_/g, " ")}
                                </label>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Update"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ---------------------------------------------------------------------------
// Events grid
// ---------------------------------------------------------------------------

interface EventsGridProps {
    events: IExploriumEventCard[]
    isLoading: boolean
    emptyMessage: string
    onDismiss: (id: string) => void
}

function EventsGrid({ events, isLoading, emptyMessage, onDismiss }: EventsGridProps) {
    if (isLoading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <EventCardSkeleton key={i} />)}
            </div>
        )
    }
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Settings2 className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
            </div>
        )
    }
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
                <ExploriumEventCard key={event.id} event={event} onDismiss={onDismiss} />
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EventsPage() {
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState<"business" | "prospect">("business")

    // Raw 180-day event sets — the full data cached from Explorium
    const [rawBusinessEvents, setRawBusinessEvents] = useState<IExploriumEventCard[]>([])
    const [rawProspectEvents, setRawProspectEvents] = useState<IExploriumEventCard[]>([])
    const [businessEnrollments, setBusinessEnrollments] = useState<EventEnrollment[]>([])
    const [prospectEnrollments, setProspectEnrollments] = useState<EventEnrollment[]>([])
    const [metadata, setMetadata] = useState<EventsMetadata | null>(null)

    const [loadingEvents, setLoadingEvents] = useState(false)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)

    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([])  // empty = all
    const [daysBack, setDaysBack] = useState<number>(90)
    const [showPanel, setShowPanel] = useState(false)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [editingEnrollment, setEditingEnrollment] = useState<EventEnrollment | null>(null)

    // Parse raw API enrollment response
    const extractEnrollments = (raw: any, entityType: "business" | "prospect"): EventEnrollment[] => {
        const list: any[] = Array.isArray(raw) ? raw
            : Array.isArray(raw?.enrollments) ? raw.enrollments
            : Array.isArray(raw?.data) ? raw.data : []
        return list.map((item: any) => ({
            entityId: item.business_id || item.prospect_id || item.id || "",
            entityName: item.business_name || item.prospect_name || item.name || item.business_id || item.prospect_id || "",
            entityType,
            eventTypes: item.event_types || [],
        }))
    }

    useEffect(() => { setMounted(true) }, [])

    // Load metadata
    useEffect(() => {
        eventsApi.getMetadata().then(setMetadata).catch(() => null)
    }, [])

    // Load enrollments
    const loadEnrollments = useCallback(async () => {
        setLoadingEnrollments(true)
        try {
            const [biz, pro] = await Promise.allSettled([
                eventsApi.getBusinessEnrollments(),
                eventsApi.getProspectEnrollments(),
            ])
            if (biz.status === "fulfilled") setBusinessEnrollments(extractEnrollments(biz.value, "business"))
            if (pro.status === "fulfilled") setProspectEnrollments(extractEnrollments(pro.value, "prospect"))
        } finally {
            setLoadingEnrollments(false)
        }
    }, [])

    useEffect(() => { loadEnrollments() }, [loadEnrollments])

    // Load events — backend handles DB caching (returns from DB if fetched today, hits Explorium if not).
    // forceRefresh=true bypasses DB cache and hits Explorium (2 credits). Used only by Refresh button.
    const loadEvents = useCallback(async (forceRefresh = false) => {
        const bizIds = businessEnrollments.map((e) => e.entityId).filter(Boolean)
        const proIds = prospectEnrollments.map((e) => e.entityId).filter(Boolean)

        if (bizIds.length === 0 && proIds.length === 0) return

        setLoadingEvents(true)
        try {
            const bizEventTypes = [...new Set(businessEnrollments.flatMap((e) => e.eventTypes))]
            const proEventTypes = [...new Set(prospectEnrollments.flatMap((e) => e.eventTypes))]

            const [bizResult, proResult] = await Promise.allSettled([
                bizIds.length > 0
                    ? eventsApi.fetchBusinessEvents({
                          business_ids: bizIds,
                          event_types: bizEventTypes.length > 0 ? bizEventTypes : undefined,
                          force_refresh: forceRefresh,
                      })
                    : Promise.resolve({ events: [], count: 0, error: null }),
                proIds.length > 0
                    ? eventsApi.fetchProspectEvents({
                          prospect_ids: proIds,
                          event_types: proEventTypes.length > 0 ? proEventTypes : undefined,
                          force_refresh: forceRefresh,
                      })
                    : Promise.resolve({ events: [], count: 0, error: null }),
            ])

            if (bizResult.status === "fulfilled") {
                setRawBusinessEvents(bizResult.value.events)
                if (bizResult.value.error) toast.error(`Events error: ${bizResult.value.error}`)
            } else {
                toast.error("Failed to load business events")
            }
            if (proResult.status === "fulfilled") {
                setRawProspectEvents(proResult.value.events)
                if (proResult.value.error) toast.error(`Prospect events error: ${proResult.value.error}`)
            }
        } catch {
            toast.error("Failed to load events")
        } finally {
            setLoadingEvents(false)
        }
    }, [businessEnrollments, prospectEnrollments])

    // Re-run when enrollments change (new entity = new cache key = cache miss = fresh fetch)
    // daysBack changes are handled purely by local filtering below — no API call needed
    useEffect(() => { loadEvents() }, [loadEvents])

    // Derive date-filtered views from raw 180d data — zero credits, pure JS
    const tsFilterFrom = daysBack === 0
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

    const businessEvents = rawBusinessEvents.filter((e) => new Date(e.timestamp) >= tsFilterFrom)
    const prospectEvents = rawProspectEvents.filter((e) => new Date(e.timestamp) >= tsFilterFrom)

    const currentEvents = activeTab === "business" ? businessEvents : prospectEvents
    const filteredEvents = currentEvents
        .filter((e) => selectedEnrollments.length === 0 || selectedEnrollments.includes(e.entityId))
        .filter((e) => selectedTypes.length === 0 || selectedTypes.includes(e.eventType))

    const eventTypeOptions = activeTab === "business"
        ? (metadata?.business_event_types.map((m) => m.key) ?? DEFAULT_BUSINESS_EVENT_TYPES)
        : (metadata?.prospect_event_types.map((m) => m.key) ?? DEFAULT_PROSPECT_EVENT_TYPES)

    const currentEnrollments = activeTab === "business" ? businessEnrollments : prospectEnrollments

    // Enrollment mutations
    const handleAddEnrollment = async (entityId: string, eventTypes: string[], entityName?: string) => {
        try {
            if (activeTab === "business") {
                await eventsApi.addBusinessEnrollment({ business_ids: [entityId], event_types: eventTypes, business_name: entityName })
            } else {
                await eventsApi.addProspectEnrollment({ prospect_ids: [entityId], event_types: eventTypes, prospect_names: entityName ? [entityName] : undefined })
            }
            toast.success("Enrollment added")
            await loadEnrollments()
        } catch (err: any) {
            const status = err?.response?.status
            if (status === 402) {
                const detail = err?.response?.data?.detail
                const msg = typeof detail === "string"
                    ? detail
                    : "Insufficient credits to enroll. Please add credits and try again."
                toast.error(msg)
                return
            }
            toast.error(err?.response?.data?.detail || "Failed to add enrollment")
        }
    }

    const handleUpdateEnrollment = async (entityId: string, eventTypes: string[]) => {
        try {
            if (activeTab === "business") {
                await eventsApi.updateBusinessEnrollment({ business_id: entityId, event_types: eventTypes })
            } else {
                await eventsApi.updateProspectEnrollment({ prospect_id: entityId, event_types: eventTypes })
            }
            toast.success("Enrollment updated")
            await loadEnrollments()
        } catch (err: any) {
            const status = err?.response?.status
            if (status === 402) {
                const detail = err?.response?.data?.detail
                const msg = typeof detail === "string"
                    ? detail
                    : "Insufficient credits to update enrollment. Please add credits and try again."
                toast.error(msg)
                return
            }
            toast.error(err?.response?.data?.detail || "Failed to update enrollment")
        }
    }

    const handleDeleteEnrollment = async (entityId: string) => {
        try {
            if (activeTab === "business") {
                await eventsApi.deleteBusinessEnrollment(entityId)
            } else {
                await eventsApi.deleteProspectEnrollment(entityId)
            }
            toast.success("Enrollment removed")
            await loadEnrollments()
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to remove enrollment")
        }
    }

    const handleDismissCard = (id: string) => {
        if (activeTab === "business") {
            setRawBusinessEvents((prev) => prev.filter((e) => e.id !== id))
        } else {
            setRawProspectEvents((prev) => prev.filter((e) => e.id !== id))
        }
    }

    if (!mounted) return null

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Events</h1>
                    <p className="text-muted-foreground">
                        Track business milestones and prospect career changes via Explorium.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => loadEvents(true)} disabled={loadingEvents}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingEvents ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPanel(true)}>
                        <Settings2 className="h-3.5 w-3.5" />
                        Enrollments
                        {currentEnrollments.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                {currentEnrollments.length}
                            </Badge>
                        )}
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        Enroll
                    </Button>
                </div>
            </div>

            {/* Tabs + filter */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => { setActiveTab(v as "business" | "prospect"); setSelectedTypes([]); setSelectedEnrollments([]) }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <TabsList>
                        <TabsTrigger value="business">
                            Business
                            {businessEvents.length > 0 && (
                                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                                    {businessEvents.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="prospect">
                            Prospect
                            {prospectEvents.length > 0 && (
                                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                                    {prospectEvents.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* Date range filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 h-9">
                                {daysBack === 0 ? "Today" : `Last ${daysBack}d`}
                                <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {[
                                { label: "Today", value: 0 },
                                { label: "Last 7 days", value: 7 },
                                { label: "Last 30 days", value: 30 },
                                { label: "Last 90 days", value: 90 },
                                { label: "Last 180 days", value: 180 },
                            ].map(({ label, value }) => (
                                <DropdownMenuCheckboxItem
                                    key={value}
                                    checked={daysBack === value}
                                    onCheckedChange={() => setDaysBack(value)}
                                >
                                    {label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Enrollment filter */}
                    {currentEnrollments.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                                    {selectedEnrollments.length === 0
                                        ? "All Companies"
                                        : selectedEnrollments.length === 1
                                        ? (currentEnrollments.find((e) => e.entityId === selectedEnrollments[0])?.entityName || selectedEnrollments[0])
                                        : `${selectedEnrollments.length} selected`}
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="start">
                                <DropdownMenuLabel>Filter by Enrollment</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={selectedEnrollments.length === 0}
                                    onCheckedChange={() => setSelectedEnrollments([])}
                                >
                                    All {activeTab === "business" ? "Companies" : "Prospects"}
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                {currentEnrollments.map((enr) => (
                                    <DropdownMenuCheckboxItem
                                        key={enr.entityId}
                                        checked={selectedEnrollments.includes(enr.entityId)}
                                        onCheckedChange={(checked) =>
                                            setSelectedEnrollments((prev) =>
                                                checked ? [...prev, enr.entityId] : prev.filter((id) => id !== enr.entityId)
                                            )
                                        }
                                    >
                                        {enr.entityName || enr.entityId}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Event type filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 h-9">
                                Filter
                                {selectedTypes.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                        {selectedTypes.length}
                                    </Badge>
                                )}
                                <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-60" align="start">
                            <DropdownMenuLabel>Event Types</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {eventTypeOptions.map((key) => (
                                <DropdownMenuCheckboxItem
                                    key={key}
                                    checked={selectedTypes.includes(key)}
                                    onCheckedChange={(checked) =>
                                        setSelectedTypes((prev) =>
                                            checked ? [...prev, key] : prev.filter((k) => k !== key)
                                        )
                                    }
                                    className="capitalize"
                                >
                                    {key.replace(/_/g, " ")}
                                </DropdownMenuCheckboxItem>
                            ))}
                            {selectedTypes.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={false}
                                        onCheckedChange={() => setSelectedTypes([])}
                                        className="text-muted-foreground"
                                    >
                                        Clear filters
                                    </DropdownMenuCheckboxItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <TabsContent value="business" className="mt-4">
                    <EventsGrid
                        events={filteredEvents}
                        isLoading={loadingEvents}
                        emptyMessage={
                            businessEnrollments.length === 0
                                ? "No businesses enrolled. Click Enroll to add a company to monitor."
                                : "No business events found for the selected filters and date range."
                        }
                        onDismiss={handleDismissCard}
                    />
                </TabsContent>

                <TabsContent value="prospect" className="mt-4">
                    <EventsGrid
                        events={filteredEvents}
                        isLoading={loadingEvents}
                        emptyMessage={
                            prospectEnrollments.length === 0
                                ? "No prospects enrolled. Click Enroll to add a prospect to monitor."
                                : "No prospect events found for the selected filters and date range."
                        }
                        onDismiss={handleDismissCard}
                    />
                </TabsContent>
            </Tabs>

            {/* Enrollments side panel */}
            <Sheet open={showPanel} onOpenChange={setShowPanel}>
                <SheetContent className="w-80">
                    <SheetHeader>
                        <SheetTitle>
                            {activeTab === "business" ? "Business" : "Prospect"} Enrollments
                        </SheetTitle>
                        <SheetDescription>Manage which entities are monitored for events.</SheetDescription>
                    </SheetHeader>
                    <Separator className="my-4" />
                    <ScrollArea className="h-[calc(100vh-14rem)]">
                        {loadingEnrollments ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
                            </div>
                        ) : currentEnrollments.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No enrollments yet.{" "}
                                <button
                                    onClick={() => { setShowPanel(false); setShowAddDialog(true) }}
                                    className="text-primary underline"
                                >
                                    Add one
                                </button>
                            </p>
                        ) : (
                            currentEnrollments.map((enrollment) => (
                                <EnrollmentItem
                                    key={enrollment.entityId}
                                    enrollment={enrollment}
                                    onDelete={handleDeleteEnrollment}
                                    onEdit={(e) => { setShowPanel(false); setEditingEnrollment(e) }}
                                />
                            ))
                        )}
                    </ScrollArea>
                    <div className="pt-4">
                        <Button
                            className="w-full gap-1.5"
                            onClick={() => { setShowPanel(false); setShowAddDialog(true) }}
                        >
                            <Plus className="h-4 w-4" /> Add Enrollment
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Add dialog */}
            <AddEnrollDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                entityType={activeTab}
                eventTypeOptions={eventTypeOptions}
                onSave={handleAddEnrollment}
            />

            {/* Edit dialog */}
            <EditEnrollDialog
                open={!!editingEnrollment}
                onClose={() => setEditingEnrollment(null)}
                enrollment={editingEnrollment}
                eventTypeOptions={eventTypeOptions}
                onSave={handleUpdateEnrollment}
            />
        </div>
    )
}
