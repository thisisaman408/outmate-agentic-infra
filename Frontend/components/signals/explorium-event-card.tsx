"use client"

import { useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ExternalLink, ChevronDown, ChevronUp, Building2, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ExploriumEventCard, EventImpact } from "@/lib/api/events"

// ---------------------------------------------------------------------------
// Badge colour helpers
// ---------------------------------------------------------------------------

function impactClass(impact: EventImpact): string {
    switch (impact) {
        case "high":   return "bg-red-100 text-red-700 border-red-200"
        case "medium": return "bg-amber-100 text-amber-700 border-amber-200"
        case "low":    return "bg-slate-100 text-slate-600 border-slate-200"
        default:       return "bg-slate-100 text-slate-600 border-slate-200"
    }
}

function categoryClass(category: string): string {
    switch (category) {
        case "Growth":    return "bg-emerald-100 text-emerald-700 border-emerald-200"
        case "Risk":      return "bg-red-100 text-red-700 border-red-200"
        case "Corporate": return "bg-blue-100 text-blue-700 border-blue-200"
        case "Prospect":  return "bg-violet-100 text-violet-700 border-violet-200"
        default:          return "bg-slate-100 text-slate-600 border-slate-200"
    }
}

function impactDot(impact: EventImpact): string {
    switch (impact) {
        case "high":   return "bg-red-500"
        case "medium": return "bg-amber-400"
        case "low":    return "bg-slate-400"
        default:       return "bg-slate-400"
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ts: string): string {
    if (!ts) return "Unknown time"
    try {
        return formatDistanceToNow(parseISO(ts), { addSuffix: true })
    } catch {
        return ts
    }
}

const SKIP_KEYS = new Set([
    "event_name", "event_time", "timestamp", "business_id", "prospect_id",
    "id", "source_url", "url", "snippet", "description", "summary",
])

function buildMetaChips(metadata: Record<string, any>): { label: string; value: string }[] {
    const chips: { label: string; value: string }[] = []
    for (const [k, v] of Object.entries(metadata)) {
        if (SKIP_KEYS.has(k) || v == null || v === "") continue
        const label = k.replace(/_/g, " ")
        const value = Array.isArray(v) ? v.slice(0, 3).join(", ") : String(v).slice(0, 60)
        if (value) chips.push({ label, value })
        if (chips.length >= 4) break
    }
    return chips
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExploriumEventCardProps {
    event: ExploriumEventCard
    onDismiss?: (id: string) => void
}

export function ExploriumEventCard({ event, onDismiss }: ExploriumEventCardProps) {
    const [expanded, setExpanded] = useState(false)
    const metaChips = buildMetaChips(event.metadata)

    return (
        <Card className="border border-border/60 hover:border-border transition-colors">
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                        {event.entityType === "business" ? (
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                        ) : (
                            <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                <User className="h-4 w-4 text-violet-600" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                                {event.entityName || event.entityId}
                            </span>
                            <Badge variant="outline" className={cn("text-xs px-2 py-0.5 rounded-full border", categoryClass(event.category))}>
                                {event.eventLabel}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", impactClass(event.impact))}>
                                <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1", impactDot(event.impact))} />
                                {event.impact}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(event.timestamp)}</p>
                    </div>

                    {onDismiss && (
                        <button
                            onClick={() => onDismiss(event.id)}
                            className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Description */}
                <p className={cn("text-sm text-muted-foreground leading-relaxed", !expanded && "line-clamp-2")}>
                    {event.description}
                </p>

                {/* Expanded metadata chips */}
                {expanded && metaChips.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {metaChips.map((chip) => (
                            <span key={chip.label} className="inline-flex flex-col text-xs bg-muted rounded-md px-2 py-1 leading-tight">
                                <span className="font-medium text-muted-foreground capitalize">{chip.label}</span>
                                <span className="text-foreground">{chip.value}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                        {event.sourceUrl && (
                            <a
                                href={event.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Source
                            </a>
                        )}
                        <Badge variant="outline" className={cn("text-xs px-2 py-0.5 border", categoryClass(event.category))}>
                            {event.category}
                        </Badge>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {expanded ? (
                            <><ChevronUp className="h-3 w-3 mr-1" />Less</>
                        ) : (
                            <><ChevronDown className="h-3 w-3 mr-1" />Details</>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
