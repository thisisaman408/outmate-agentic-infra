"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  UserCheck,
  UserMinus,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
  Plus,
} from "lucide-react"
import {
  ChampionChangeEvent,
  markChampionAlertRead,
  updateChampionAlertStatus,
} from "@/lib/api/copilot"

interface Props {
  event: ChampionChangeEvent
  onRefresh: () => void
}

const CHANGE_CONFIG = {
  left_account: {
    label: "Left Account",
    Icon: UserMinus,
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  joined_account: {
    label: "New Champion",
    Icon: UserCheck,
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  promoted: {
    label: "Promoted",
    Icon: TrendingUp,
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
} as const

function parseDraftEmail(raw: string | null): { subject?: string; body?: string; ps_line?: string | null } | null {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return { body: raw }
  }
}

export function ChampionAlertCard({ event, onRefresh }: Props) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState<"act" | "dismiss" | "watch" | null>(null)

  const cfg = CHANGE_CONFIG[event.change_type] ?? CHANGE_CONFIG.left_account
  const { Icon } = cfg
  const draft = parseDraftEmail(event.draft_email)

  async function handleAct() {
    setLoading("act")
    try {
      await markChampionAlertRead(event.id)
      await updateChampionAlertStatus(event.id, "acted")
    } finally {
      setLoading(null)
      onRefresh()
    }
  }

  async function handleDismiss() {
    setLoading("dismiss")
    try {
      await markChampionAlertRead(event.id)
      await updateChampionAlertStatus(event.id, "dismissed")
    } finally {
      setLoading(null)
      onRefresh()
    }
  }

  async function handleCopyEmail() {
    if (!draft) return
    const text = draft.subject
      ? `Subject: ${draft.subject}\n\n${draft.body ?? ""}${draft.ps_line ? `\n\nP.S. ${draft.ps_line}` : ""}`
      : (draft.body ?? "")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleWatchNewCompany() {
    if (!event.new_company) return
    setLoading("watch")
    try {
      const guessedDomain = event.new_company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"
      await fetch("/api/watchers/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${event.new_company} (champion auto-watch)`,
          accountName: event.new_company,
          accountDomain: guessedDomain,
          triggers: ["Job Changes", "Funding Events"],
        }),
      })
    } catch {
      // Non-blocking — watcher may already exist or domain guess may be imprecise
    } finally {
      setLoading(null)
      onRefresh()
    }
  }

  const isPending = event.status === "pending"

  return (
    <Card
      className={[
        "transition-opacity",
        !event.is_read ? "border-l-4 border-l-primary" : "opacity-75",
      ].join(" ")}
    >
      <CardContent className="p-4 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">
                {event.contact_name ?? "Unknown Contact"}
              </span>
              <Badge variant="outline" className={`text-xs shrink-0 ${cfg.badge}`}>
                <Icon className="h-3 w-3 mr-1" />
                {cfg.label}
              </Badge>
              {!event.is_read && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </div>

            {/* Before → after transition */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="text-foreground font-medium">{event.prev_company ?? "—"}</span>
              {event.prev_title && <span className="opacity-60">({event.prev_title})</span>}
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium">{event.new_company ?? "—"}</span>
              {event.new_title && <span className="opacity-60">({event.new_title})</span>}
            </div>
          </div>

          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {new Date(event.detected_at).toLocaleDateString()}
          </span>
        </div>

        {/* ── Suggested action ── */}
        <p className="text-xs text-muted-foreground italic">{event.suggested_action}</p>

        {/* ── Draft email preview ── */}
        {draft && (
          <div className="rounded-md bg-muted/60 border p-3 text-xs space-y-1">
            {draft.subject && (
              <p className="font-medium text-foreground">Subject: {draft.subject}</p>
            )}
            {draft.body && (
              <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{draft.body}</p>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        {isPending ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {event.draft_email && (
              <Button size="sm" variant="outline" onClick={handleCopyEmail} className="h-7 text-xs">
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copied" : "Copy Email"}
              </Button>
            )}

            {event.contact_linkedin && (
              <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                <a href={event.contact_linkedin} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  LinkedIn
                </a>
              </Button>
            )}

            {event.new_company && event.change_type !== "promoted" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleWatchNewCompany}
                disabled={loading === "watch"}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Watch {event.new_company}
              </Button>
            )}

            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={!!loading}
                className="h-7 text-xs text-muted-foreground"
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleAct}
                disabled={!!loading}
                className="h-7 text-xs"
              >
                Mark Acted
              </Button>
            </div>
          </div>
        ) : (
          <Badge variant="secondary" className="text-xs capitalize">
            {event.status}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
