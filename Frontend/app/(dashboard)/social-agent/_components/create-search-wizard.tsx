"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Zap, Mail, ArrowUpRight, Check, AlertCircle, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { SourceSelector, type MonitorSource } from "./source-selector"
import { QueryBuilder, type BooleanQuery, type QueryFilters } from "./query-builder"
import { fetchIntegrations, disconnectHubSpot, getHubSpotAuthUrl, type CreateSearchPayload, type IntegrationStatus } from "@/lib/social-listening"

const STEPS = ["Source & Name", "Query Builder", "Frequency & Actions"]

const SCHEDULE_OPTIONS = [
  { value: "hourly", label: "Hourly", desc: "Check every hour for new signals" },
  { value: "daily", label: "Daily", desc: "Run once per day (recommended)" },
  { value: "weekly", label: "Weekly", desc: "Run once per week" },
  { value: "manual", label: "Manual", desc: "Only run when you trigger it" },
]

interface CreateSearchWizardProps {
  onClose: () => void
  onCreate: (payload: CreateSearchPayload) => void
}

export function CreateSearchWizard({ onClose, onCreate }: CreateSearchWizardProps) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null)

  useEffect(() => {
    fetchIntegrations().then(setIntegrations)
  }, [])

  // Step 1 state
  const [name, setName] = useState("")
  const [source, setSource] = useState<MonitorSource>("linkedin_posts")

  // Step 2 state
  const [query, setQuery] = useState<BooleanQuery>({ must: [], should: [], must_not: [] })
  const [filters, setFilters] = useState<QueryFilters>({
    job_titles: [],
    seniority: [],
    industries: [],
    languages: [],
    countries: [],
    hide_replies: true,
    must_contain_links: false,
    exclude_sponsored: true,
  })
  const [timeFrame, setTimeFrame] = useState("week")

  // Step 3 state
  const [schedule, setSchedule] = useState("daily")
  const [maxLeads, setMaxLeads] = useState(25)
  const [autoEnrich, setAutoEnrich] = useState(true)
  const [autoOutreach, setAutoOutreach] = useState(false)
  const [autoCrmPush, setAutoCrmPush] = useState(false)

  const allKeywords = [...query.must, ...query.should]
  const canProceedStep0 = name.trim().length > 0
  const canProceedStep1 = allKeywords.length > 0
  const canSubmit = canProceedStep0 && canProceedStep1

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        keywords: allKeywords,
        description: `Source: ${source}`,
        signal_types: [source.startsWith("twitter") ? "social_post" : "social_post"],
        schedule,
        max_leads: maxLeads,
        source,
        boolean_query: query,
        filters,
        time_frame: timeFrame,
        auto_enrich: autoEnrich,
        auto_outreach: autoOutreach,
        auto_crm_push: autoCrmPush,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with step indicator */}
        <div className="px-6 pt-5 pb-4 border-b border-border/60">
          <h2 className="text-lg font-semibold mb-4">New search</h2>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary/20 text-primary border border-primary/40" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium truncate",
                  i === step ? "text-foreground" : "text-muted-foreground"
                )}>
                  {s}
                </span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border/60 min-w-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Give your search a descriptive name. Choose which platform to monitor.
              </p>
              <div>
                <label className="text-sm font-medium">Search name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "CTOs posting about AI automation"'
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <SourceSelector value={source} onChange={setSource} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define what to search for using boolean logic. Add job title and seniority filters to narrow results.
              </p>
              <QueryBuilder
                query={query}
                filters={filters}
                timeFrame={timeFrame}
                onQueryChange={setQuery}
                onFiltersChange={setFilters}
                onTimeFrameChange={setTimeFrame}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Choose how often to run this search and what to do with new signals.
              </p>

              {/* Schedule */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Run frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSchedule(opt.value)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg border text-left transition-all",
                        schedule === opt.value
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border/60 hover:border-primary/30"
                      )}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max leads */}
              <div>
                <label className="text-sm font-medium">Max signals per run</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(Number(e.target.value))}
                  className="mt-1.5 w-24"
                />
              </div>

              {/* Auto-actions */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <label className="text-sm font-medium">Automatic actions on new signals</label>

                {/* Enrich — always available */}
                <ActionToggle
                  icon={Zap}
                  label="Enrich contact automatically"
                  description="Find email, phone, and company data for each signal"
                  checked={autoEnrich}
                  onChange={setAutoEnrich}
                />

                {/* Email outreach — show connection status */}
                <div className="relative">
                  <ActionToggle
                    icon={Mail}
                    label="Send AI outreach email"
                    description={
                      integrations?.email.connected
                        ? `Connected as ${integrations.email.email}`
                        : "Draft and queue personalized outreach for review"
                    }
                    checked={autoOutreach}
                    onChange={setAutoOutreach}
                    statusBadge={
                      integrations?.email.connected
                        ? { text: `Connected as ${integrations.email.email}`, variant: "connected" }
                        : { text: "Connect Gmail \u2192", variant: "disconnected" }
                    }
                  />
                  {autoOutreach && !integrations?.email.connected && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-[52px] text-xs text-amber-400">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>Gmail not connected — outreach will be queued for later</span>
                    </div>
                  )}
                </div>

                {/* LinkedIn outreach — show connection status */}
                <ActionToggle
                  icon={Linkedin}
                  label="LinkedIn outreach via Unipile"
                  description={
                    integrations?.linkedin.connected
                      ? "LinkedIn connected via Unipile"
                      : "Not connected"
                  }
                  checked={false}
                  onChange={() => {}}
                  disabled={!integrations?.linkedin.connected}
                  statusBadge={
                    integrations?.linkedin.connected
                      ? { text: "LinkedIn connected via Unipile", variant: "connected" }
                      : { text: "Not connected", variant: "disconnected" }
                  }
                />

                <ActionToggle
                  icon={ArrowUpRight}
                  label="Push to CRM"
                  description="Auto-create contacts in HubSpot"
                  checked={autoCrmPush}
                  onChange={setAutoCrmPush}
                  statusBadge={
                    integrations?.crm?.connected
                      ? { text: `HubSpot Connected${integrations.crm.portal_id ? ` (${integrations.crm.portal_id})` : ""}`, variant: "connected" }
                      : integrations?.crm?.available
                      ? { text: "HubSpot — Click CRM on any signal to connect", variant: "disconnected" }
                      : { text: "HubSpot — Set HUBSPOT_CLIENT_ID to enable", variant: "disconnected" }
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between">
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? "Cancel" : <><ChevronLeft className="size-4 mr-1" /> Previous</>}
          </Button>
          <div className="flex gap-2">
            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
              >
                Next <ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="animate-spin size-4 mr-1.5" /> : null}
                Complete
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionToggle({ icon: Icon, label, description, checked, onChange, disabled, statusBadge }: {
  icon: any
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  statusBadge?: { text: string; variant: "connected" | "disconnected" | "coming_soon" }
}) {
  const badgeColors: Record<string, string> = {
    connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    disconnected: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    coming_soon: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  }

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onChange(!checked) }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
        disabled && "opacity-60 cursor-not-allowed",
        !disabled && checked ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-border"
      )}
    >
      <div className={cn(
        "size-9 rounded-lg flex items-center justify-center shrink-0",
        checked && !disabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{label}</span>
          {statusBadge && (
            <span className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
              badgeColors[statusBadge.variant] || badgeColors.disconnected
            )}>
              {statusBadge.variant === "connected" && <Check className="size-2.5 mr-0.5" />}
              {statusBadge.text}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={cn(
        "size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
        disabled ? "border-muted-foreground/20 bg-muted/50" :
        checked ? "bg-primary border-primary" : "border-muted-foreground/30"
      )}>
        {checked && !disabled && <Check className="size-3 text-primary-foreground" />}
      </div>
    </button>
  )
}
