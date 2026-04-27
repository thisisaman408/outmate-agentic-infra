"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Plus, RefreshCw, Settings2, Trash2, Search, Check, Sparkles, Mic, X, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Separator } from "@/components/ui/separator"

import { ExploriumEventCard } from "@/components/signals/explorium-event-card"
import {
    eventsApi,
    type ExploriumEventCard as IExploriumEventCard,
    type EventEnrollment,
    type EventsMetadata,
} from "@/lib/api/events"
import { authService } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Constants & Mappings
// ---------------------------------------------------------------------------

const SIDEBAR_GROUPS = [
    {
        title: "TRENDING NOW",
        items: [
            { label: "Job change", keys: ["job_change", "changed_role", "joined_company", "vp_hired", "cro_change", "ceo_change", "executive_hire", "prospect_changed_company", "prospect_changed_role"] },
            { label: "Funding events", keys: ["funding", "investment", "ipo", "series_a", "series_b", "series_c", "acquisition", "seed_round"] },
            { label: "Hiring signals", keys: ["hiring_in", "headcount", "new_role_posted", "job_posting", "increase_in"] },
            { label: "Buying intent", keys: ["pricing_page", "competitor_comparison", "demo_request", "g2", "roi_calculator"] },
        ]
    },
    {
        title: "COMPANY SIGNALS",
        items: [
            { label: "Tech stack", keys: ["tech_stack", "tool_removed", "crm_replaced", "tool_adopted", "software_change"] },
            { label: "Company growth", keys: ["new_office", "expansion", "headcount_growth", "company_growth", "partnership", "award"] },
            { label: "News & events", keys: ["product_launch", "announcement", "lawsuits", "outages", "breaches", "merger", "legal_issues", "security_breaches"] },
            { label: "Leadership change", keys: ["leadership", "board_member", "executive_change"] },
        ]
    },
    {
        title: "PEOPLE SIGNALS",
        items: [
            { label: "Email engagement", keys: ["email_open", "email_click", "email_reply"] },
            { label: "Website behavior", keys: ["website_visit", "page_view", "web_activity"] },
            { label: "Social signals", keys: ["linkedin", "social_mention", "social_activity"] },
        ]
    },
    {
        title: "REVENUE SIGNALS",
        items: [
            { label: "CRM signals", keys: ["crm_activity", "deal_stage", "pipeline"] },
            { label: "Expansion & churn", keys: ["expansion", "churn", "renewal", "upsell", "cost_cutting", "closing_office", "decrease_in"] },
            { label: "Competitor signals", keys: ["competitor", "displacement", "comparison"] },
        ]
    }
];

// Helper to assign a group to an event based on its type
function getGroupForEventType(eventType: string): string {
    for (const group of SIDEBAR_GROUPS) {
        for (const item of group.items) {
            if (item.keys.some(k => eventType.includes(k))) return item.label;
        }
    }
    return "Other Signals";
}

// Helper to count how many events fall into a specific group
function countEventsForGroup(groupKeys: string[], events: IExploriumEventCard[]): number {
    return events.filter(e => groupKeys.some(gk => e.eventType.includes(gk))).length;
}

// ---------------------------------------------------------------------------
// Time Helpers
// ---------------------------------------------------------------------------

function isNew(timestamp: string): boolean {
    return (Date.now() - new Date(timestamp).getTime()) < 30 * 24 * 60 * 60 * 1000;
}

function isTrending(timestamp: string): boolean {
    return (Date.now() - new Date(timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function EventCardSkeleton() {
    return (
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-4 w-1/2" />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Add Enrollment Dialog
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

    // Auto-suggest state
    const [preloadedCompanies, setPreloadedCompanies] = useState<any[]>([])
    const [preloadedProspects, setPreloadedProspects] = useState<any[]>([])

    const [selected, setSelected] = useState<string[]>(eventTypeOptions)
    const [chosenId, setChosenId] = useState("")
    const [chosenName, setChosenName] = useState("")
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)

    // Attempt to preload database entities when dialog opens
    useEffect(() => {
        if (open) {
            const fetchDb = async () => {
                try {
                    const token = authService.getToken();
                    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                    if (entityType === "business") {
                        const { data } = await axios.get(`${BASE}/api/v1/companies?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
                        setPreloadedCompanies(Array.isArray(data) ? data : data.companies || []);
                    } else {
                        const { data } = await axios.get(`${BASE}/api/v1/prospects?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
                        setPreloadedProspects(Array.isArray(data) ? data : data.prospects || []);
                    }
                } catch (e) {
                    // Fail silently
                }
            }
            fetchDb();
        } else {
            // reset state
            setQuery(""); setBizMatches([]); setProMatches([]); setChosenId(""); setChosenName(""); setSelected(eventTypeOptions)
        }
    }, [open, entityType, eventTypeOptions])

    const handleSearch = async () => {
        if (!query.trim()) return
        setSearching(true)
        setBizMatches([]); setProMatches([]); setChosenId("")
        try {
            if (entityType === "prospect") {
                const q = query.trim()
                let payload: Record<string, string> = {}
                if (q.startsWith("http") || q.includes("linkedin.com")) payload = { linkedin: q }
                else if (q.includes("@")) payload = { email: q }
                else payload = { full_name: q }

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
                if ((res as any).error) toast.error(`Lookup error: ${(res as any).error}`)
            }
        } catch {
            toast.error("Lookup failed — try a different query")
        } finally {
            setSearching(false)
        }
    }

    const handleSelectPreloaded = async (item: any) => {
        setSearching(true);
        try {
            if (entityType === "business") {
                const payload = item.domain ? { domain: item.domain } : { name: item.name };
                const res = await eventsApi.matchBusiness(payload);
                setBizMatches(res.matches || []);
                if (res.matches?.length > 0) {
                    setChosenId(res.matches[0].business_id);
                    setChosenName(res.matches[0].name);
                } else {
                    toast.error("Could not verify company with Explorium.");
                }
            } else {
                const payload = { email: item.email, full_name: item.name || item.full_name, linkedin: item.linkedin_url };
                const res = await eventsApi.matchProspect(payload);
                setProMatches(res.matches || []);
                if (res.matches?.length > 0) {
                    setChosenId(res.matches[0].prospect_id);
                    setChosenName(res.matches[0].name);
                } else {
                    toast.error("Could not verify prospect with Explorium.");
                }
            }
        } catch {
            toast.error("Failed to map database entity to signal provider.");
        } finally {
            setSearching(false);
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
                    <DialogTitle className="text-xl">
                        Add {isProspect ? "Prospect" : "Business"} Signal
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="entity-query" className="text-sm font-medium">
                            Search Directory
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="entity-query"
                                placeholder={isProspect ? "e.g. john@acme.com or Profile URL" : "e.g. Salesforce or salesforce.com"}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                className="bg-muted/50 focus-visible:bg-background"
                            />
                            <Button variant="default" size="icon" onClick={handleSearch} disabled={searching} className="shrink-0">
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {!query && matches.length === 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Suggested from your database</Label>
                            <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-card">
                                {isProspect ? preloadedProspects.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSelectPreloaded(p)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="font-medium text-foreground">{p.name || p.full_name || p.email}</div>
                                        <div className="text-xs text-muted-foreground">{p.company || p.company_name}</div>
                                    </button>
                                )) : preloadedCompanies.map((c, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSelectPreloaded(c)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="font-medium text-foreground">{c.name}</div>
                                        <div className="text-xs text-muted-foreground">{c.domain}</div>
                                    </button>
                                ))}
                                {isProspect && preloadedProspects.length === 0 && <div className="p-3 text-xs text-muted-foreground">Type to search the global database.</div>}
                                {!isProspect && preloadedCompanies.length === 0 && <div className="p-3 text-xs text-muted-foreground">Type to search the global database.</div>}
                            </div>
                        </div>
                    )}

                    {matches.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Search Results</Label>
                            <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-card shadow-sm">
                                {isProspect
                                    ? proMatches.map((m) => (
                                        <button
                                            key={m.prospect_id}
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/80 transition-colors flex items-center justify-between ${chosenId === m.prospect_id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                                            onClick={() => { setChosenId(m.prospect_id); setChosenName(m.name) }}
                                        >
                                            <div>
                                                <div className="font-medium text-foreground">{m.name}</div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    {m.company && <span>{m.company}</span>}
                                                    {m.email && <span>{m.email}</span>}
                                                </div>
                                            </div>
                                            {chosenId === m.prospect_id && <Check className="h-4 w-4 text-primary shrink-0" />}
                                        </button>
                                    ))
                                    : bizMatches.map((m) => (
                                        <button
                                            key={m.business_id}
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/80 transition-colors flex items-center justify-between ${chosenId === m.business_id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                                            onClick={() => { setChosenId(m.business_id); setChosenName(m.name) }}
                                        >
                                            <div>
                                                <div className="font-medium text-foreground">{m.name}</div>
                                                <div className="text-xs text-muted-foreground">{m.domain}</div>
                                            </div>
                                            {chosenId === m.business_id && <Check className="h-4 w-4 text-primary shrink-0" />}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {chosenId && (
                        <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                            <p className="text-sm">
                                Ready to enroll: <strong className="text-foreground">{chosenName}</strong>
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Signals to Track</Label>
                        <div className="h-40 overflow-y-auto border rounded-md p-3 bg-card shadow-inner">
                            <div className="grid grid-cols-1 gap-2">
                                {eventTypeOptions.map((key) => (
                                    <div key={key} className="flex items-start gap-2.5 py-1">
                                        <Checkbox
                                            id={key}
                                            checked={selected.includes(key)}
                                            onCheckedChange={() => toggle(key)}
                                            className="mt-0.5"
                                        />
                                        <label htmlFor={key} className="text-sm cursor-pointer capitalize leading-tight">
                                            {key.replace(/_/g, " ")}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter className="pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || searching} className="min-w-[100px] shadow-sm">
                        {saving ? "Enrolling..." : "Enroll Now"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EventsPage() {
    const [mounted, setMounted] = useState(false)

    // Data State
    const [rawBusinessEvents, setRawBusinessEvents] = useState<IExploriumEventCard[]>([])
    const [rawProspectEvents, setRawProspectEvents] = useState<IExploriumEventCard[]>([])
    const [businessEnrollments, setBusinessEnrollments] = useState<EventEnrollment[]>([])
    const [prospectEnrollments, setProspectEnrollments] = useState<EventEnrollment[]>([])
    const [metadata, setMetadata] = useState<EventsMetadata | null>(null)

    // UI State
    const [loadingEvents, setLoadingEvents] = useState(false)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)

    // Filters State
    const [searchQuery, setSearchQuery] = useState("")
    const [activeCategory, setActiveCategory] = useState<string>("All") // Part A Sidebar
    const [activeFilterChip, setActiveFilterChip] = useState<string>("All") // Part C Chips
    const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null) // Sidebar subparts

    const [showEnrollmentsPanel, setShowEnrollmentsPanel] = useState(false)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [enrollDialogType, setEnrollDialogType] = useState<"business" | "prospect">("business")

    useEffect(() => { setMounted(true) }, [])

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

            if (bizResult.status === "fulfilled") setRawBusinessEvents(bizResult.value.events)
            if (proResult.status === "fulfilled") setRawProspectEvents(proResult.value.events)
        } catch {
            toast.error("Failed to load events")
        } finally {
            setLoadingEvents(false)
        }
    }, [businessEnrollments, prospectEnrollments])

    useEffect(() => { loadEvents() }, [loadEvents])
    useEffect(() => { eventsApi.getMetadata().then(setMetadata).catch(() => null) }, [])

    // Combine all events
    const allEvents = useMemo(() => {
        return [...rawBusinessEvents, ...rawProspectEvents].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [rawBusinessEvents, rawProspectEvents])

    // Part A: Categories dynamically derived from fetched data
    const categoriesMap: Record<string, number> = { "All": allEvents.length, "Trending": 0 };
    allEvents.forEach(e => {
        const c = e.category || "Corporate";
        categoriesMap[c] = (categoriesMap[c] || 0) + 1;
        if (isTrending(e.timestamp)) categoriesMap["Trending"]++;
    });
    const categoryKeys = ["All", "Trending", "Growth", "Risk", "People", "Corporate"].filter(k => k === "All" || k === "Trending" || categoriesMap[k] > 0);

    // Part B: Metadata mapping counts
    const allMetadataKeys = useMemo(() => {
        if (!metadata) return [];
        return [
            ...metadata.business_event_types.map(m => m.key),
            ...metadata.prospect_event_types.map(m => m.key)
        ];
    }, [metadata]);

    // Apply all filters: Hero Search + Category (Part A) + Filter Chip (Part C)
    const filteredEvents = useMemo(() => {
        let result = allEvents;

        // 1. Hero Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(e =>
                e.entityName.toLowerCase().includes(query) ||
                e.eventLabel.toLowerCase().includes(query) ||
                e.description.toLowerCase().includes(query)
            );
        }

        // 2. Part A: Category Filter
        if (activeCategory !== "All") {
            if (activeCategory === "Trending") {
                result = result.filter(e => isTrending(e.timestamp));
            } else {
                result = result.filter(e => (e.category || "Corporate").toLowerCase() === activeCategory.toLowerCase());
            }
        }

        // 3. Part C: Horizontal Chip Filter
        if (activeFilterChip !== "All") {
            if (activeFilterChip === "Trending") {
                result = result.filter(e => isTrending(e.timestamp));
            } else if (activeFilterChip === "High strength") {
                result = result.filter(e => e.impact === "high");
            } else if (activeFilterChip === "New") {
                result = result.filter(e => isNew(e.timestamp));
            } else {
                // Tier filter: check metadata map for the event's tier
                const eventMetadataMap = [
                    ...(metadata?.business_event_types || []),
                    ...(metadata?.prospect_event_types || [])
                ];
                result = result.filter(e => {
                    const meta = eventMetadataMap.find(m => m.key === e.eventType) as any;
                    return meta?.tier === activeFilterChip;
                });
            }
        }

        // 4. Part B: Sidebar Subpart Filter
        if (activeSubFilter) {
            const groupItem = SIDEBAR_GROUPS.flatMap(g => g.items).find(i => i.label === activeSubFilter);
            if (groupItem) {
                result = result.filter(e => groupItem.keys.some(k => e.eventType.includes(k)));
            }
        }

        return result;
    }, [allEvents, searchQuery, activeCategory, activeFilterChip, activeSubFilter, metadata]);

    // Group the filtered results for the Card Grid
    const groupedEvents = useMemo(() => {
        const groups: Record<string, IExploriumEventCard[]> = {};
        filteredEvents.forEach(e => {
            const groupName = getGroupForEventType(e.eventType);
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(e);
        });
        return groups;
    }, [filteredEvents]);

    // Handlers
    const handleAddEnrollment = async (entityId: string, eventTypes: string[], entityName?: string) => {
        try {
            if (enrollDialogType === "business") {
                await eventsApi.addBusinessEnrollment({ business_ids: [entityId], event_types: eventTypes, business_name: entityName })
            } else {
                await eventsApi.addProspectEnrollment({ prospect_ids: [entityId], event_types: eventTypes, prospect_names: entityName ? [entityName] : undefined })
            }
            toast.success("Enrollment active! Fetching initial signals...")
            await loadEnrollments()
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to add enrollment")
        }
    }

    const handleDeleteEnrollment = async (id: string, type: "business" | "prospect") => {
        try {
            if (type === "business") await eventsApi.deleteBusinessEnrollment(id)
            else await eventsApi.deleteProspectEnrollment(id)
            toast.success("Enrollment removed")
            await loadEnrollments()
        } catch (err: any) {
            toast.error("Failed to remove enrollment")
        }
    }

    const handleDismissCard = (id: string) => {
        setRawBusinessEvents(prev => prev.filter(e => e.id !== id))
        setRawProspectEvents(prev => prev.filter(e => e.id !== id))
    }

    if (!mounted) return null

    return (
        <div className="flex flex-col bg-background/50 min-h-screen relative">
            {/* TOP RIGHT BUTTONS */}
            <div className="w-full flex justify-between pt-4 pb-2 px-6">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Signals Library</span>
                    <span className="text-muted-foreground/40 text-sm">·</span>
                    <span className="text-xs text-muted-foreground">4000+ Signals</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => loadEvents(true)} disabled={loadingEvents} title="Refresh Data" className="h-8 w-8 bg-background/50 hover:bg-background/80 backdrop-blur-sm border shadow-sm rounded-md">
                        <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground ${loadingEvents ? "animate-spin" : ""}`} />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1"></div>
                    <Button variant="outline" size="sm" onClick={() => setShowEnrollmentsPanel(!showEnrollmentsPanel)} className="h-8 text-xs bg-background/80 backdrop-blur-sm">
                        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                        Enrollments
                        <Badge variant="secondary" className="ml-1.5 h-4 px-1 rounded-sm text-[10px]">
                            {businessEnrollments.length + prospectEnrollments.length}
                        </Badge>
                    </Button>
                    <div className="flex bg-primary rounded-md overflow-hidden shadow-sm h-8 ml-1">
                        <Button
                            className="rounded-none border-0 bg-transparent hover:bg-primary/90 transition-colors h-full text-xs px-3"
                            onClick={() => { setEnrollDialogType("business"); setShowAddDialog(true); }}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Track Company
                        </Button>
                        <div className="w-px bg-primary-foreground/20"></div>
                        <Button
                            className="rounded-none border-0 bg-transparent hover:bg-primary/90 transition-colors h-full text-xs px-3"
                            onClick={() => { setEnrollDialogType("prospect"); setShowAddDialog(true); }}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Track Person
                        </Button>
                    </div>
                </div>
            </div>

            {/* ROW 2: AI HERO SECTION (No sticky) */}
            <div className="px-6 py-8 relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent border-b">
                <div className="max-w-3xl mx-auto text-center space-y-5 relative z-10">
                    <div className="space-y-1.5">
                        <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-primary/20 text-primary px-2.5 py-0.5 text-[10px] mb-2 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3 mr-1 inline-block" />
                            AI-POWERED SIGNALS DISCOVERY
                        </Badge>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            Find signals for your GTM use case
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                            Describe your ideal trigger and Outmate will suggest the best signals.
                        </p>
                    </div>

                    <div className="relative group max-w-xl mx-auto">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        <div className="relative flex items-center bg-background rounded-full border shadow-sm overflow-hidden p-1">
                            <div className="pl-3 text-muted-foreground">
                                <Search className="h-4 w-4" />
                            </div>
                            <input
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60"
                                placeholder="e.g. 'VP of Sales joins', 'Tech layoffs', 'New funding'"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="p-1.5 text-muted-foreground hover:text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <div className="pr-3 pl-2 border-l hidden sm:flex">
                                <Mic className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground mr-1 font-medium uppercase">Try:</span>
                        {[
                            { label: "New funding round", query: "funding" },
                            { label: "Hiring engineering", query: "hiring" },
                            { label: "VP Sales joins", query: "sales" },
                            { label: "Mergers & Acq", query: "m&a" },
                        ].map((chip) => (
                            <button
                                key={chip.label}
                                onClick={() => setSearchQuery(chip.query)}
                                className="text-[10px] bg-background/60 hover:bg-background border text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full transition-all shadow-sm"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ROW 3: DISCOVERY LAYOUT (Scrolls with page) */}
            <div className="flex flex-col md:flex-row w-full max-w-[1400px] mx-auto px-4 py-6 gap-6 items-start">

                {/* LEFT SIDEBAR (Sticky to viewport while scrolling the grid) */}
                <div className="w-64 shrink-0 space-y-8 sticky top-6">

                    {/* Part A: Browse Signals (Filter buttons based on real data) */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-3">Browse Signals</h3>
                        <nav className="space-y-0.5">
                            {categoryKeys.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setActiveCategory(cat);
                                        setActiveSubFilter(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors ${activeCategory === cat
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-muted"
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {cat === "Trending" && <span className="text-orange-500">🔥</span>}
                                        {cat}
                                    </div>
                                    {categoriesMap[cat] !== undefined && (
                                        <span className={`text-[10px] ${activeCategory === cat ? "bg-primary/20 text-primary" : "text-muted-foreground"} px-1.5 py-0.5 rounded-sm`}>
                                            {categoriesMap[cat]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Part B: Signal Groups (Headers showing Metadata Counts) */}
                    <div className="space-y-6">
                        {SIDEBAR_GROUPS.map((group, idx) => (
                            <div key={idx} className="space-y-2">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-3">
                                    {group.title}
                                </h3>
                                <div className="space-y-0.5">
                                    {group.items.map((item, i) => {
                                        // Count based on the actual fetched events
                                        const count = countEventsForGroup(item.keys, allEvents);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    const newValue = activeSubFilter === item.label ? null : item.label;
                                                    setActiveSubFilter(newValue);
                                                    if (newValue) setActiveCategory("All");
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors ${activeSubFilter === item.label
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground opacity-80"
                                                    }`}
                                            >
                                                <span>{item.label}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${activeSubFilter === item.label ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                                                    {count}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT CONTENT (Card Grid) */}
                <div className="flex-1 min-w-0 space-y-6">

                    {/* Horizontal Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2 border-b pb-4">
                        {["All", "🔥 Trending", "High strength", "New", "Free", "Starter", "Growth", "Scale"].map(chip => (
                            <button
                                key={chip}
                                onClick={() => setActiveFilterChip(chip)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeFilterChip === chip
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-background text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    {/* Header + Search info */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">
                            {activeCategory === "Trending" ? "🔥 Trending Signals" : `${activeCategory} Signals`}
                            <Badge variant="secondary" className="ml-2 font-normal text-xs">{filteredEvents.length}</Badge>
                        </h2>
                        {searchQuery && (
                            <p className="text-xs text-muted-foreground">
                                Showing results for <span className="font-medium text-foreground">"{searchQuery}"</span>
                            </p>
                        )}
                    </div>

                    {/* Dynamic Grid Rendering */}
                    {loadingEvents ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => <EventCardSkeleton key={i} />)}
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/20 border border-dashed rounded-xl">
                            <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                                <Search className="h-5 w-5 opacity-50" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">No signals found</p>
                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                    Try adjusting your filters or search terms.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Render groups that have matching events */}
                            {Object.entries(groupedEvents).map(([groupName, eventsInGroup]) => (
                                <div key={groupName} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold tracking-tight">{groupName}</h3>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {eventsInGroup.map((event) => {
                                            // Badges based on real data logic
                                            const tags = [];
                                            if (isNew(event.timestamp)) tags.push("New");
                                            if (isTrending(event.timestamp)) tags.push("Trending");

                                            return (
                                                <div key={event.id} className="relative group">
                                                    <div className="absolute -top-2 -right-1.5 z-10 flex gap-1">
                                                        {tags.includes("New") && (
                                                            <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-sm text-[9px] px-1.5 py-0">New</Badge>
                                                        )}
                                                        {tags.includes("Trending") && (
                                                            <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-sm text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                                                                <Sparkles className="h-2 w-2" /> Trending
                                                            </Badge>
                                                        )}
                                                        {event.impact === "high" && (
                                                            <Badge className="bg-red-500/90 hover:bg-red-600 text-white border-0 shadow-sm text-[9px] px-1.5 py-0">High Strength</Badge>
                                                        )}
                                                    </div>
                                                    <ExploriumEventCard event={event} onDismiss={handleDismissCard} />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AddEnrollDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                entityType={enrollDialogType}
                eventTypeOptions={enrollDialogType === "business"
                    ? (metadata?.business_event_types.map(m => m.key) ?? [])
                    : (metadata?.prospect_event_types.map(m => m.key) ?? [])}
                onSave={handleAddEnrollment}
            />
        </div>
    )
}
