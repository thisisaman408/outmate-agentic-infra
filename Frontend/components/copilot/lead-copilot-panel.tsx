"use client"

import { useEffect, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Mail,
  Users,
  Search,
  Target,
  Shield,
  Sparkles,
  MapPin,
  Building2,
  Globe,
  Linkedin,
  Copy,
  Check,
  Loader2,
  Coins,
  Swords,
  FileCheck,
  Zap,
  UserX,
  TrendingUp,
  ArrowRightLeft,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useState, useRef } from "react"
import ReactMarkdown from "react-markdown"
import { useToast } from "@/hooks/use-toast"
import { CopilotCommandInput } from "./copilot-command-input"
import {
  useCopilotPanelStore,
  useLeadContext,
  useLeadAction,
  useLeadSuggestions,
  type CopilotMessage,
} from "@/hooks/use-copilot-panel"
import type {
  LeadActionType,
  AnnotatedEmailSegment,
  LeadSuggestion,
} from "@/lib/api/copilot"

// ── Tag Colors ───────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  PERSONALIZATION: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  RELEVANCE: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  TIMING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  VALUE_PROP: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  CTA: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
}

const TAG_ICONS: Record<string, string> = {
  PERSONALIZATION: "🎯",
  RELEVANCE: "🔗",
  TIMING: "⏰",
  VALUE_PROP: "💎",
  CTA: "📩",
}

// ── Quick Action Definitions ─────────────────────────────────

const QUICK_ACTIONS: { type: LeadActionType; label: string; icon: typeof Mail; cost: number }[] = [
  { type: "draft_email", label: "Draft Email", icon: Mail, cost: 1 },
  { type: "meeting_prep", label: "Meeting Prep", icon: Users, cost: 2 },
  { type: "research", label: "Research", icon: Search, cost: 2 },
  { type: "find_similar", label: "Find Similar", icon: Target, cost: 1 },
  { type: "objection_handler", label: "Objection Handler", icon: Shield, cost: 1 },
  { type: "crossfire", label: "Crossfire Intelligence", icon: Swords, cost: 2 },
  { type: "compliance", label: "Compliance Oracle", icon: FileCheck, cost: 1 },
  { type: "bombora_intent", label: "Business Intent", icon: Zap, cost: 2 },
  { type: "talent_radar", label: "Talent Radar", icon: UserX, cost: 2 },
  { type: "virality", label: "Virality Engine", icon: TrendingUp, cost: 1 },
  { type: "regime_shift", label: "Regime Shifter", icon: ArrowRightLeft, cost: 2 },
  { type: "website_traffic", label: "Website Traffic", icon: BarChart3, cost: 1 },
  { type: "business_events", label: "Business Events", icon: Calendar, cost: 1 },
  { type: "linkedin_posts", label: "Social Post Analysis", icon: Linkedin, cost: 1 },
]

// ── Smart Follow-up Suggestions ──────────────────────────────

const FOLLOW_UP_SUGGESTIONS: Partial<Record<LeadActionType | string, { type: LeadActionType; label: string; emoji: string }[]>> = {
  linkedin_posts:   [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "objection_handler", label: "Objection Handler", emoji: "🛡" }],
  website_traffic:  [{ type: "research", label: "Research", emoji: "🔍" }, { type: "draft_email", label: "Draft Email", emoji: "✉️" }],
  business_events:  [{ type: "meeting_prep", label: "Meeting Prep", emoji: "📋" }, { type: "draft_email", label: "Draft Email", emoji: "✉️" }],
  bombora_intent:   [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "meeting_prep", label: "Meeting Prep", emoji: "📋" }],
  research:         [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "meeting_prep", label: "Meeting Prep", emoji: "📋" }],
  meeting_prep:     [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "objection_handler", label: "Objection Handler", emoji: "🛡" }],
  crossfire:        [{ type: "objection_handler", label: "Objection Handler", emoji: "🛡" }, { type: "draft_email", label: "Draft Email", emoji: "✉️" }],
  regime_shift:     [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "meeting_prep", label: "Meeting Prep", emoji: "📋" }],
  virality:         [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "crossfire", label: "Crossfire", emoji: "⚔️" }],
  talent_radar:     [{ type: "research", label: "Research", emoji: "🔍" }, { type: "draft_email", label: "Draft Email", emoji: "✉️" }],
  compliance:       [{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "objection_handler", label: "Objection Handler", emoji: "🛡" }],
  objection_handler:[{ type: "draft_email", label: "Draft Email", emoji: "✉️" }, { type: "crossfire", label: "Crossfire", emoji: "⚔️" }],
}

// ── Action Label & Emoji Map ─────────────────────────────────

const ACTION_DISPLAY: Partial<Record<string, { emoji: string; label: string }>> = {
  draft_email:      { emoji: "✉️",  label: "Draft Email" },
  meeting_prep:     { emoji: "📋",  label: "Meeting Prep" },
  research:         { emoji: "🔍",  label: "Research" },
  find_similar:     { emoji: "🔗",  label: "Find Similar" },
  objection_handler:{ emoji: "🛡",  label: "Objection Handler" },
  crossfire:        { emoji: "⚔️",  label: "Crossfire" },
  compliance:       { emoji: "⚖️",  label: "Compliance Oracle" },
  bombora_intent:   { emoji: "🎯",  label: "Business Intent" },
  talent_radar:     { emoji: "📡",  label: "Talent Radar" },
  virality:         { emoji: "🚀",  label: "Virality Engine" },
  regime_shift:     { emoji: "🌐",  label: "Regime Shift" },
  website_traffic:  { emoji: "📈",  label: "Website Traffic" },
  business_events:  { emoji: "💰",  label: "Business Events" },
  linkedin_posts:   { emoji: "💼",  label: "Social Posts" },
  custom:           { emoji: "💬",  label: "Custom" },
}

// ── Helper to get prospect ID ────────────────────────────────

function getProspectId(prospect: any): string | null {
  const raw = prospect?.copilot_id || prospect?.person_id || prospect?.id || prospect?.linkedin_profile_urn || null
  return raw ? String(raw) : null
}

function getProspectName(prospect: any): string {
  return prospect?.name || prospect?.full_name ||
    `${prospect?.first_name || ""} ${prospect?.last_name || ""}`.trim() || "Unknown"
}

function getProspectCompany(prospect: any): string {
  const employer = prospect?.current_employers?.[0] || prospect?.employer?.[0]
  return employer?.name || prospect?.company || ""
}

function getProspectTitle(prospect: any): string {
  const employer = prospect?.current_employers?.[0] || prospect?.employer?.[0]
  return employer?.title || prospect?.headline || prospect?.job_title || ""
}

function buildContextOverrides(prospect: any) {
  if (!prospect) return undefined
  if (prospect?.entity_type === "company") {
    const company = {
      name: prospect?.name || prospect?.company || "",
      domain: prospect?.domain || "",
      industry: prospect?.industry || "",
      employee_count: prospect?.employee_count_exact ?? prospect?.employee_count ?? prospect?.employee_count_range,
      revenue_range: prospect?.revenue_range ?? prospect?.revenue_exact,
      funding_stage: prospect?.funding_stage,
      funding_total: prospect?.funding_total,
      technologies: prospect?.technologies || [],
      headquarters: prospect?.headquarters || prospect?.location_display || prospect?.headquarters_address || prospect?.headquarters_city || "",
      employee_growth_6m_percent: prospect?.employee_growth_6m_percent,
    }
    const contextProspect = {
      id: getProspectId(prospect),
      name: prospect?.primary_contact_name || prospect?.name || "Decision Maker",
      title: prospect?.primary_contact_title || prospect?.title || "Decision Maker",
      company: company.name,
      email: prospect?.email,
      phone: prospect?.phone,
      linkedin_url: prospect?.linkedin_url,
      location: company.headquarters || prospect?.location,
      seniority: prospect?.seniority_level,
      department: prospect?.department,
      data_quality_score: prospect?.data_quality_score,
    }
    return { prospect: contextProspect, company, entity_type: "company" }
  }
  const employer = prospect?.current_employers?.[0] || prospect?.employer?.[0] || {}
  const company = {
    name: employer?.name || prospect?.company || "",
    domain: employer?.company_website_domain || employer?.company_domain || prospect?.domain || "",
    industry: employer?.company_linkedin_industry || prospect?.industry || "",
    employee_count: employer?.company_headcount_latest || undefined,
    revenue_range: prospect?.revenue_range || undefined,
    funding_stage: prospect?.funding_stage || undefined,
    funding_total: prospect?.funding_total || undefined,
    technologies: prospect?.technologies || [],
    headquarters: employer?.company_hq_location || prospect?.headquarters || "",
    employee_growth_6m_percent: prospect?.employee_growth_6m_percent || undefined,
  }
  const contextProspect = {
    id: getProspectId(prospect),
    name: getProspectName(prospect),
    title: getProspectTitle(prospect),
    company: company.name,
    email: prospect?.email || prospect?.work_email || prospect?.personal_email,
    phone: prospect?.phone,
    linkedin_url: prospect?.linkedin_profile_url || prospect?.flagship_profile_url || prospect?.linkedin_url,
    location: prospect?.region || prospect?.location,
    seniority: prospect?.seniority_level,
    department: prospect?.department,
    data_quality_score: prospect?.data_quality_score,
  }
  return { prospect: contextProspect, company }
}

// ── Copy helper ──────────────────────────────────────────────

function useCopyText() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])
  return { copiedKey, copy }
}

// ── Main Component ───────────────────────────────────────────

const ACTIONS_REQUIRING_INPUT: Partial<Record<LeadActionType, { label: string; placeholder: string }>> = {
  crossfire: {
    label: "Enter the competitor name to compare against Outmate:",
    placeholder: "e.g. HubSpot, Salesforce, Apollo.io...",
  },
}

export function LeadCopilotPanel() {
  const { isPanelOpen, selectedProspect, messages, closePanel } = useCopilotPanelStore()
  const isCompanyEntity = selectedProspect?.entity_type === "company"
  const prospectId = selectedProspect ? getProspectId(selectedProspect) : null
  const { context, isLoading: contextLoading, fetchContext } = useLeadContext(prospectId)
  const { isLoading: actionLoading, streamingStage, streamingMessage, executeAction } = useLeadAction()
  const { suggestions, isLoading: suggestionsLoading, fetchSuggestions } = useLeadSuggestions(prospectId)
  const [awaitingInput, setAwaitingInput] = useState<LeadActionType | null>(null)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [decisionMakers, setDecisionMakers] = useState<any[]>([])
  const [isDMLoading, setIsDMLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)


  // Auto-scroll the ScrollArea viewport to bottom when messages change
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages.length, actionLoading])

  useEffect(() => {
    if (isPanelOpen && prospectId) {
      if (!isCompanyEntity) {
        fetchContext()
        fetchSuggestions()
      } else {
        // For companies, fetch decision makers
        const fetchDMs = async () => {
          setIsDMLoading(true)
          try {
            const domain = selectedProspect.domain || selectedProspect.website || ""
            if (domain) {
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/contactout/decision-makers/${encodeURIComponent(domain)}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("outmate_auth_token")}` }
              })
              if (res.ok) {
                const data = await res.json()
                setDecisionMakers(data.data || [])
              }
            }
          } catch (err) {
            console.error("Failed to fetch decision makers:", err)
          } finally {
            setIsDMLoading(false)
          }
        }
        fetchDMs()
      }
    } else if (!isPanelOpen) {
      setDecisionMakers([])
      setAwaitingInput(null)
    }
  }, [isPanelOpen, prospectId, fetchContext, fetchSuggestions, isCompanyEntity, selectedProspect])

  const handleQuickAction = useCallback(
    (actionType: LeadActionType) => {
      if (!prospectId) return
      if (ACTIONS_REQUIRING_INPUT[actionType]) {
        setAwaitingInput(actionType)
        setInputValue("")
        setTimeout(() => inputRef.current?.focus(), 50)
        return
      }
      const overrides = buildContextOverrides(selectedProspect) || {}
      if (actionType === "find_similar") {
        overrides.refresh = true
      }
      executeAction({
        prospect_id: prospectId,
        action_type: actionType,
        context_overrides: overrides,
      })
    },
    [prospectId, executeAction, selectedProspect]
  )

  const handleInputSubmit = useCallback(() => {
    if (!prospectId || !awaitingInput || !inputValue.trim()) return
    executeAction({
      prospect_id: prospectId,
      action_type: awaitingInput,
      prompt: inputValue.trim(),
      context_overrides: buildContextOverrides(selectedProspect),
    })
    setAwaitingInput(null)
    setInputValue("")
  }, [prospectId, awaitingInput, inputValue, executeAction, selectedProspect])

  const handleCustomCommand = useCallback(
    (prompt: string) => {
      if (!prospectId) return
      executeAction({
        prospect_id: prospectId,
        action_type: "custom",
        prompt,
        context_overrides: buildContextOverrides(selectedProspect),
      })
    },
    [prospectId, executeAction, selectedProspect]
  )

  const name = selectedProspect ? (isCompanyEntity ? (selectedProspect?.name || "Company") : getProspectName(selectedProspect)) : ""
  const title = selectedProspect ? (isCompanyEntity ? "Company" : getProspectTitle(selectedProspect)) : ""
  const company = selectedProspect ? (isCompanyEntity ? "" : getProspectCompany(selectedProspect)) : ""
  const location = selectedProspect
    ? (isCompanyEntity
      ? (selectedProspect?.headquarters || selectedProspect?.location_display || selectedProspect?.headquarters_address || selectedProspect?.headquarters_city || "")
      : (selectedProspect?.region || selectedProspect?.location))
    : ""
  const companyContext = context?.company || (isCompanyEntity ? buildContextOverrides(selectedProspect)?.company : null)

  return (
    <Sheet open={isPanelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col border-l border-border/60 bg-background/95 backdrop-blur-xl">
        <SheetHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold tracking-tight">Lead Copilot</SheetTitle>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">AI Intelligence</p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">
            {/* Profile Header */}
            {contextLoading ? (
              <ProfileSkeleton />
            ) : (
              <ProfileHeader
                name={context?.prospect?.name || name}
                title={context?.prospect?.title || title}
                company={company || context?.company?.name}
                email={context?.prospect?.email}
                phone={context?.prospect?.phone}
                linkedin={context?.prospect?.linkedin_url || selectedProspect?.linkedin_profile_url}
                location={context?.prospect?.location || location}
                seniority={context?.prospect?.seniority}
              />
            )}

            {/* Company Card */}
            {companyContext && <CompanyCard company={companyContext} />}

            {/* Decision Makers (Companies only) */}
            {/* Decision Makers (Companies only) */}
            {isCompanyEntity && (isDMLoading || decisionMakers.length > 0) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-primary/60" /> Top Decision Makers
                  </p>
                  {isDMLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full rounded-lg" />
                      <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {decisionMakers.slice(0, 5).map((dm, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {dm.name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium truncate">{dm.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{dm.title}</p>
                          </div>
                          {dm.linkedin_url ? (
                            <a href={dm.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-blue-500/10 text-blue-400">
                              <Linkedin className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 opacity-50">Locked</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}


            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Quick Actions</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.type}
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-8 px-2.5 text-xs border-border/50 bg-transparent hover:bg-muted/60 hover:border-border hover:shadow-sm active:scale-[0.98] transition-all duration-150"
                    disabled={actionLoading}
                    onClick={() => handleQuickAction(action.type)}
                  >
                    <action.icon className="h-3 w-3 text-muted-foreground/70" />
                    <span className="text-[11px] truncate">{action.label}</span>
                    <span className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground/50 font-mono tabular-nums">
                      <Coins className="h-2 w-2" />
                      {action.cost}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Competitor Input Prompt */}
            {awaitingInput && ACTIONS_REQUIRING_INPUT[awaitingInput] && (
              <>
                <Separator />
                <div className="space-y-2.5 p-3.5 rounded-xl border border-primary/20 bg-primary/[0.04]">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Swords className="h-3.5 w-3.5 text-primary" />
                    {ACTIONS_REQUIRING_INPUT[awaitingInput]!.label}
                  </p>
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInputSubmit()
                        if (e.key === "Escape") { setAwaitingInput(null); setInputValue("") }
                      }}
                      placeholder={ACTIONS_REQUIRING_INPUT[awaitingInput]!.placeholder}
                      className="flex-1 text-sm px-3 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button size="sm" onClick={handleInputSubmit} disabled={!inputValue.trim()}>
                      Run
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAwaitingInput(null); setInputValue("") }}>
                      ✕
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Conversation Thread */}
            {messages.length > 0 && (
              <>
                <Separator />
                <ConversationThread
                  messages={messages}
                  isLoading={actionLoading}
                  streamingStage={streamingStage}
                  streamingMessage={streamingMessage}
                  onFollowUpAction={handleQuickAction}
                />
              </>
            )}
          </div>
        </ScrollArea>

        <CopilotCommandInput onSubmit={handleCustomCommand} isLoading={actionLoading} />
      </SheetContent>
    </Sheet>
  )
}

// ── Profile Header ───────────────────────────────────────────

function ProfileHeader({
  name, title, company, email, phone, linkedin, location, seniority,
}: {
  name: string; title: string; company: string; email?: string; phone?: string
  linkedin?: string; location?: string; seniority?: string
}) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 text-primary font-semibold text-sm shrink-0 select-none">
          {initials}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight truncate">{name}</h3>
          <p className="text-[13px] text-muted-foreground truncate">
            {title}{company ? <span className="text-foreground/50"> @ </span> : ""}{company && <span className="font-medium text-foreground/70">{company}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        {seniority && <Badge variant="secondary" className="text-[10px] font-medium bg-primary/8 text-primary/80 border-primary/12 hover:bg-primary/12 transition-colors">{seniority}</Badge>}
        {location && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50">
            <MapPin className="h-2.5 w-2.5 text-muted-foreground/60" />{location}
          </span>
        )}
        {email && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 truncate max-w-[200px]">
            <Mail className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />{email}
          </span>
        )}
        {phone && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50">{phone}</span>
        )}
        {linkedin && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/8 border border-blue-500/15 text-blue-400 hover:bg-blue-500/15 transition-colors">
            <Linkedin className="h-2.5 w-2.5" />Social
          </a>
        )}
      </div>
    </div>
  )
}

// ── Company Card ─────────────────────────────────────────────

function CompanyCard({ company }: { company: NonNullable<import("@/lib/api/copilot").LeadContextData["company"]> }) {
  return (
    <Card className="bg-gradient-to-br from-muted/60 to-muted/30 border-border/60 shadow-sm">
      <CardContent className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-foreground/5 border border-border/50">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">{company.name}</span>
          {company.industry && (
            <Badge variant="outline" className="text-[10px] ml-auto font-medium border-border/60">{company.industry}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          {company.employee_count && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs opacity-70">👥</span>
              <span>{company.employee_count.toLocaleString()} employees</span>
            </span>
          )}
          {company.revenue_range && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs opacity-70">💰</span>
              <span>{company.revenue_range}</span>
            </span>
          )}
          {company.funding_stage && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs opacity-70">🏦</span>
              <span>{company.funding_stage}</span>
            </span>
          )}
          {company.employee_growth_6m_percent != null && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs opacity-70">{company.employee_growth_6m_percent > 0 ? "📈" : "📉"}</span>
              <span className={company.employee_growth_6m_percent > 0 ? "text-emerald-500" : "text-red-400"}>{company.employee_growth_6m_percent}% growth (6mo)</span>
            </span>
          )}
          {company.domain && (
            <span className="flex items-center gap-1.5"><Globe className="h-3 w-3 opacity-50" />{company.domain}</span>
          )}
          {company.headquarters && (
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 opacity-50" />{company.headquarters}</span>
          )}
        </div>
        {company.technologies && company.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {company.technologies.slice(0, 8).map((tech) => (
              <Badge key={tech} variant="secondary" className="text-[9.5px] px-1.5 py-0 font-mono bg-muted/80 border border-border/40">{tech}</Badge>
            ))}
            {company.technologies.length > 8 && (
              <Badge variant="secondary" className="text-[9.5px] px-1.5 py-0 font-mono bg-muted/80 border border-border/40">+{company.technologies.length - 8}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Suggestions Section ───────────────────────────────────────

function SuggestionsSection({
  suggestions, isLoading, onSuggestionClick,
}: {
  suggestions: LeadSuggestion[]; isLoading: boolean; onSuggestionClick: (actionType: LeadActionType) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary/60" /> AI Suggestions
        </p>
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-primary/60" /> AI Suggestions
      </p>
      {suggestions.map((s, i) => (
        <button key={i}
          className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 hover:shadow-sm active:scale-[0.99] ${
            s.priority === "high"
              ? "border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] hover:border-primary/30"
              : "border-border/50 hover:bg-muted/50 hover:border-border"
          }`}
          style={{ animation: `slideIn 0.25s ease ${i * 0.06}s forwards`, opacity: 0 }}
          onClick={() => s.action_type && onSuggestionClick(s.action_type as LeadActionType)}>
          <div className="flex items-start gap-2.5">
            <span className="text-base mt-0.5">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{s.title}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{s.description}</p>
            </div>
            {s.priority === "high" && (
              <Badge className="text-[9px] shrink-0 font-bold bg-primary/15 text-primary border-primary/20 hover:bg-primary/15 px-1.5">HIGH</Badge>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Conversation Thread ──────────────────────────────────────

function ConversationThread({
  messages, isLoading, streamingStage, streamingMessage, onFollowUpAction,
}: {
  messages: CopilotMessage[]
  isLoading: boolean
  streamingStage?: string | null
  streamingMessage?: string | null
  onFollowUpAction: (type: LeadActionType) => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stageDisplay = streamingStage === "enriching"
    ? { text: streamingMessage || "Researching lead...", icon: Search, color: "text-blue-500" }
    : streamingStage === "generating"
    ? { text: streamingMessage || "Generating response...", icon: Sparkles, color: "text-purple-500" }
    : null

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Conversation</p>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === "user" ? "flex justify-end w-full" : "w-full max-w-full overflow-hidden"}>
          {msg.role === "user" ? (
            <div className="bg-primary/90 text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2 max-w-[85%] break-words shadow-sm">
              <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{msg.prompt}</p>
            </div>
          ) : (
            <AssistantMessage msg={msg} onFollowUpAction={onFollowUpAction} isLoading={isLoading} />
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
      {isLoading && (
        <div className="rounded-xl border border-border/40 bg-muted/40 px-3.5 py-3 space-y-2">
          {stageDisplay ? (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <stageDisplay.icon className={`h-4 w-4 ${stageDisplay.color}`} />
                <div className={`absolute inset-0 ${stageDisplay.color} animate-ping opacity-30`}>
                  <stageDisplay.icon className="h-4 w-4" />
                </div>
              </div>
              <span className="text-[12px] text-muted-foreground font-medium">{stageDisplay.text}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
              <span className="text-[12px] text-muted-foreground font-medium">Thinking...</span>
            </div>
          )}
          {streamingStage === "enriching" && (
            <div className="flex gap-1.5 ml-6">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400/80 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400/80 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400/80 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Assistant Message Wrapper ────────────────────────────────

function AssistantMessage({ msg, onFollowUpAction, isLoading }: { msg: CopilotMessage; onFollowUpAction: (type: LeadActionType) => void; isLoading: boolean }) {
  const { copiedKey, copy } = useCopyText()
  const display = ACTION_DISPLAY[msg.action_type || ""] || { emoji: "✨", label: "Copilot" }
  const followUps = FOLLOW_UP_SUGGESTIONS[msg.action_type || ""] || []

  const fullText = msg.result
    ? (msg.result.result || msg.result.battle_card || msg.result.response || msg.result.executive_summary || JSON.stringify(msg.result, null, 2))
    : ""

  const relativeTime = msg.timestamp
    ? (() => {
        const diff = Math.floor((Date.now() - msg.timestamp) / 1000)
        if (diff < 60) return "just now"
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        return `${Math.floor(diff / 3600)}h ago`
      })()
    : ""

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {/* Action chip header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-muted/70 border border-border/50 text-muted-foreground tracking-wide">
          {display.emoji} {display.label}
        </span>
        {relativeTime && <span className="text-[9.5px] text-muted-foreground/60 ml-auto font-mono tabular-nums">{relativeTime}</span>}
      </div>

      {/* Result card */}
      <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5 space-y-2 w-full max-w-full overflow-x-hidden break-words">
        {msg.result && (
          <div className="w-full max-w-full overflow-hidden">
            <ActionResult actionType={msg.action_type} result={msg.result} />
          </div>
        )}
      </div>

      {/* Footer: credits + copy all */}
      <div className="flex items-center justify-between px-1">
        {msg.credits_used != null && (
          <span className="text-[9.5px] text-muted-foreground/50 flex items-center gap-1 font-mono tabular-nums">
            <Coins className="h-2.5 w-2.5" />{msg.credits_used} credit{msg.credits_used !== 1 ? "s" : ""}
          </span>
        )}
        {fullText && (
          <button
            onClick={() => copy(fullText, `msg-${msg.id}`)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 border border-border/40 rounded-md px-2 py-0.5 hover:bg-muted/60 hover:text-foreground hover:border-border transition-all duration-150 ml-auto"
          >
            {copiedKey === `msg-${msg.id}` ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
            {copiedKey === `msg-${msg.id}` ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {/* Smart follow-up suggestions */}
      {followUps.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[9.5px] text-muted-foreground/50 font-medium uppercase tracking-wider">Next</span>
          {followUps.map((f) => (
            <button
              key={f.type}
              disabled={isLoading}
              onClick={() => onFollowUpAction(f.type)}
              className="inline-flex items-center gap-1 text-[10.5px] px-2.5 py-1 rounded-lg border border-border/40 bg-transparent hover:bg-muted/50 hover:border-border active:scale-[0.97] transition-all duration-150 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lead Panel Markdown Renderer ─────────────────────────────

function LeadMarkdown({ content }: { content: string }) {
  return (
    <div className="text-[12.5px] leading-snug text-foreground/80">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 ml-3 list-disc space-y-0.5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-3 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="text-[12px] leading-snug">{children}</li>,
          h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-[12.5px] font-bold text-foreground tracking-tight first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-1 mt-2.5 text-xs font-bold text-foreground tracking-tight first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1 mt-2 text-[10.5px] font-semibold text-foreground/80 uppercase tracking-widest first:mt-0">{children}</h4>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[10.5px] font-mono">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-foreground/60 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── Action Result Renderer ───────────────────────────────────

function ActionResult({ actionType, result }: { actionType?: string; result: Record<string, any> }) {
  // Show inline error if the action failed
  if (result.error) {
    return (
      <div className="flex items-start gap-2 text-destructive/80">
        <span className="text-xs mt-0.5">⚠</span>
        <p className="text-xs break-words whitespace-pre-wrap">{result.error}</p>
      </div>
    )
  }
  if (actionType === "draft_email" && result.segments) return <AnnotatedEmailResult result={result} />
  if (actionType === "research" && result.executive_summary) return <ResearchResult result={result} />
  if (actionType === "objection_handler" && result.rebuttals) return <ObjectionResult result={result} />
  if (actionType === "find_similar" && result.similar_companies) return <FindSimilarResult result={result} />
  if (actionType === "custom" && result.response) {
    return (
      <div className="space-y-2 w-full max-w-full overflow-hidden">
        <LeadMarkdown content={result.response} />
        {result.action_items?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Action Items</p>
            {result.action_items.map((item: string, i: number) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                <p className="text-xs text-foreground/80 leading-snug break-words">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (result.company_snapshot || (result.talking_points && !result.executive_summary)) return <MeetingPrepResult result={result} />
  if (actionType === "bombora_intent") return <BomboraIntentResult result={result} />
  if (["website_traffic", "business_events", "linkedin_posts"].includes(actionType || "")) return <SignalResult result={result} />
  if (actionType === "crossfire") return <BattleCard result={result} />
  if (["compliance", "virality", "regime_shift", "talent_radar"].includes(actionType || "")) return <GTMActionResult result={result} />
  // Fallback: render raw_text or response with markdown, else friendly message with collapsible raw
  if (result.raw_text) return <LeadMarkdown content={result.raw_text} />
  if (result.response) return <LeadMarkdown content={result.response} />
  return (
    <div className="space-y-1.5 w-full max-w-full overflow-hidden">
      <p className="text-xs text-muted-foreground italic">Unable to format this response nicely.</p>
      <details className="text-xs">
        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">Show raw data</summary>
        <pre className="mt-1 text-[10px] whitespace-pre-wrap text-foreground/60 bg-muted/30 rounded p-2 border border-border/50 max-h-40 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  )
}

// ── Signal Cards ─────────────────────────────────────────────

const URGENCY_STYLES: Record<string, { border: string; badge: string; badgeText: string; glow: string }> = {
  high:   { border: "border-l-red-500",   badge: "bg-red-500/[0.15] border border-red-500/25 text-red-400",   badgeText: "HIGH",   glow: "shadow-red-500/5" },
  medium: { border: "border-l-amber-500", badge: "bg-amber-500/[0.12] border border-amber-500/25 text-amber-400", badgeText: "MEDIUM", glow: "" },
  low:    { border: "border-l-teal-500",  badge: "bg-teal-500/[0.12] border border-teal-500/25 text-teal-400",  badgeText: "LOW",    glow: "" },
}

function SignalCard({ signal, index }: { signal: any; index: number }) {
  const { copiedKey, copy } = useCopyText()
  const urgency = (signal.urgency || "low").toLowerCase()
  const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.low
  const copyText = `${signal.type?.replace(/_/g, " ").toUpperCase()} [${urgency.toUpperCase()}]\n${signal.description}${signal.suggested_action ? `\n→ ${signal.suggested_action}` : ""}`

  return (
    <div
      className={`relative rounded-xl border border-border/50 border-l-4 ${styles.border} bg-muted/20 p-3 space-y-2 transition-all duration-200 hover:translate-x-0.5 hover:bg-muted/30 ${styles.glow}`}
      style={{ animation: `slideIn 0.3s ease ${index * 0.08}s forwards`, opacity: 0 }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2">
        <span className={`text-[9.5px] font-bold tracking-wider px-2 py-0.5 rounded font-mono ${styles.badge}`}>
          {styles.badgeText}
        </span>
        <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          {signal.type?.replace(/_/g, " ")}
        </span>
        <button
          onClick={() => copy(copyText, `sig-${index}`)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Copy signal"
        >
          {copiedKey === `sig-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      {/* Description */}
      <p className="text-[12px] text-foreground/75 leading-snug line-clamp-2">
        {signal.description}
      </p>

      {/* Suggested action */}
      {signal.suggested_action && (
        <div className="flex gap-2 items-start bg-teal-500/[0.07] border border-teal-500/[0.18] rounded-lg px-2.5 py-2">
          <span className="text-teal-400 text-xs mt-0.5 shrink-0">→</span>
          <p className="text-[11.5px] text-teal-300 leading-snug">{signal.suggested_action}</p>
        </div>
      )}

      {signal.detected_at && (
        <p className="text-[10px] text-muted-foreground">
          {new Date(signal.detected_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

function SignalResult({ result }: { result: Record<string, any> }) {
  const signals = result.signals || []
  return (
    <div className="space-y-2 w-full">
      {signals.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">No signals found in recent audit.</p>
      )}
      {signals.map((signal: any, i: number) => (
        <SignalCard key={i} signal={signal} index={i} />
      ))}
    </div>
  )
}

// ── Crossfire Battle Card ─────────────────────────────────────

const BATTLE_SECTIONS = [
  { key: "competitive_edge",     icon: "⚡", label: "Competitive Edge",      defaultOpen: true },
  { key: "handling_objections",  icon: "🛡", label: "Handling Objections",   defaultOpen: true },
  { key: "winning_talking_points",icon: "🎯",label: "Winning Talking Points", defaultOpen: false },
  { key: "poaching_sequence",    icon: "🔄", label: "Poaching Sequence",     defaultOpen: false },
]

function parseBattleSections(content: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const keyMap: Record<string, string> = {
    "competitive edge": "competitive_edge",
    "handling objections": "handling_objections",
    "winning talking points": "winning_talking_points",
    "poaching sequence": "poaching_sequence",
  }
  const lines = content.split("\n")
  let currentKey = ""
  for (const line of lines) {
    const heading = line.replace(/^#+\s*/, "").trim().toLowerCase()
    if (keyMap[heading]) {
      currentKey = keyMap[heading]
      result[currentKey] = []
    } else if (currentKey && line.trim()) {
      const cleaned = line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "").trim()
      if (cleaned) result[currentKey].push(cleaned)
    }
  }
  return result
}

function BattleSectionPanel({ section, points, defaultOpen }: { section: typeof BATTLE_SECTIONS[0]; points: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { copiedKey, copy } = useCopyText()
  const copyText = points.join("\n")

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/20 transition-all duration-150 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{section.icon}</span>
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{section.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {open && points.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); copy(copyText, section.key) }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copy section"
            >
              {copiedKey === section.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {points.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No data available.</p>
          )}
          {points.map((pt, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 mt-[7px]" />
              <p className="text-[12px] text-foreground/75 leading-snug line-clamp-2">{pt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BattleCard({ result }: { result: Record<string, any> }) {
  const content = result.result || result.battle_card || result.response || ""
  const competitor = result.competitor || "Competitor"
  const company = result.company || result.prospect_company || ""
  const sections = parseBattleSections(content)

  // If parsing found no sections, fall back to GTM renderer
  const hasSections = Object.values(sections).some((s) => s.length > 0)
  if (!hasSections) return <GTMActionResult result={result} />

  return (
    <div className="rounded-xl border border-red-500/15 overflow-hidden w-full bg-gradient-to-b from-red-500/[0.03] to-transparent">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-red-500/10">
        <span className="text-[12px] font-semibold text-red-400/90 tracking-tight">{competitor} vs Outmate AI</span>
        <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/[0.12] text-red-500 font-mono tracking-widest">BATTLE CARD</span>
        {company && <span className="ml-auto text-[10px] text-muted-foreground/60 font-medium">{company}</span>}
      </div>
      {/* Sections */}
      {BATTLE_SECTIONS.map((sec) => (
        <BattleSectionPanel
          key={sec.key}
          section={sec}
          points={sections[sec.key] || []}
          defaultOpen={sec.defaultOpen}
        />
      ))}
    </div>
  )
}

// ── GTM Action Result (compliance, virality, regime_shift, talent_radar) ──

function GTMActionResult({ result }: { result: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false)
  const content = result.result || result.battle_card || result.response || ""

  // Preview: first ~400 chars for collapsed view
  const previewEnd = content.indexOf("\n", 350)
  const preview = previewEnd > 0 && previewEnd < 500 ? content.slice(0, previewEnd) : content.slice(0, 400)
  const hasMore = content.length > preview.length

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <LeadMarkdown content={expanded ? content : (hasMore ? preview + "\n\n…" : content)} />
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

// ── Business Intent ───────────────────────────────────────────

function BomboraIntentResult({ result }: { result: Record<string, any> }) {
  const topics = (result.intent_topics || []).slice(0, 3)
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-yellow-500/10 border border-yellow-500/15">
          <Zap className="h-3 w-3 text-yellow-500" />
        </div>
        <p className="text-[13px] font-semibold tracking-tight">Intent Analysis</p>
        <Badge variant="outline" className="text-[9.5px] ml-auto font-semibold border-border/50">{result.level_of_intent} Level</Badge>
      </div>
      <div className="space-y-1.5">
        {topics.map((topic: any, i: number) => (
          <div key={topic.name || i} className="p-2.5 rounded-lg bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium truncate pr-2">{topic.name}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Score: {topic.score}</span>
            </div>
            <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500" style={{ width: `${topic.score}%` }} />
            </div>
          </div>
        ))}
        {result.intent_topics?.length > 3 && (
          <p className="text-[10px] text-muted-foreground ml-1">+{result.intent_topics.length - 3} more topics</p>
        )}
        {topics.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-2">No significant intent topics detected.</p>
        )}
      </div>
    </div>
  )
}

// ── Annotated Email ──────────────────────────────────────────

function AnnotatedEmailResult({ result }: { result: Record<string, any> }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.full_text || "")
    setCopied(true)
    toast({ title: "Copied", description: "Email text copied to clipboard." })
    setTimeout(() => setCopied(false), 2000)
  }, [result.full_text, toast])

  return (
    <TooltipProvider>
      <div className="space-y-2 w-full max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 overflow-hidden w-full">
          <p className="text-[12px] font-semibold break-words whitespace-pre-wrap flex-1 tracking-tight">
            <span className="text-muted-foreground/60 font-medium">Subject:</span> {result.subject_line}
          </p>
          <Button variant="ghost" size="sm" className="h-6 px-2 shrink-0 hover:bg-muted/60" onClick={handleCopy}>
            {copied ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
            <span className="text-[9.5px] ml-1">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
        <div className="space-y-1 w-full max-w-full overflow-hidden break-words text-wrap">
          {(result.segments as AnnotatedEmailSegment[])?.map((seg, i) => (
            <span key={i} className="inline">
              <Tooltip>
                <TooltipTrigger asChild>
                  {seg.source_url ? (
                    <a href={seg.source_url} target="_blank" rel="noopener noreferrer" className="inline">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 mr-1 cursor-pointer ${TAG_COLORS[seg.tag] || ""}`}>
                        {TAG_ICONS[seg.tag]} {seg.tag}
                      </Badge>
                    </a>
                  ) : (
                    <span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 mr-1 ${TAG_COLORS[seg.tag] || ""}`}>
                        {TAG_ICONS[seg.tag]} {seg.tag}
                      </Badge>
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs font-medium">{seg.source || "No source"}</p>
                  {seg.why && <p className="text-xs text-muted-foreground">{seg.why}</p>}
                </TooltipContent>
              </Tooltip>
              <span className="text-sm">{seg.text} </span>
            </span>
          ))}
        </div>
        {result.enrichment_sources_used?.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Sources: {result.enrichment_sources_used.join(", ")}
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}

// ── Research Result ──────────────────────────────────────────

function ResearchResult({ result }: { result: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false)
  const allPoints: string[] = result.talking_points || []
  const shown = expanded ? allPoints : allPoints.slice(0, 3)
  const hiddenCount = allPoints.length - 3

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <LeadMarkdown content={result.executive_summary} />
      {allPoints.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Talking Points</p>
          {shown.map((p: string, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
              <p className="text-xs text-foreground/80 leading-snug">{p}</p>
            </div>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button onClick={() => setExpanded(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors ml-3.5">
              +{hiddenCount} more
            </button>
          )}
          {expanded && (
            <>
              {result.engagement_opportunities?.length > 0 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Engagement Opportunities</p>
                  {result.engagement_opportunities.map((o: any, i: number) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
                      <p className="text-xs text-foreground/80 leading-snug">
                        <span className="font-medium">{o.type}:</span> {o.detail}
                        {o.source_url && (
                          <a href={o.source_url} target="_blank" rel="noopener noreferrer"
                            className="ml-1 text-blue-500 hover:underline">[source]</a>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {result.recommended_approach && (
                <div className="pt-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recommended Approach</p>
                  <div className="mt-0.5"><LeadMarkdown content={result.recommended_approach} /></div>
                </div>
              )}
              <button onClick={() => setExpanded(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors">
                Show less
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Objection Handler Result ─────────────────────────────────

function ObjectionResult({ result }: { result: Record<string, any> }) {
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <div className="text-xs text-muted-foreground italic"><LeadMarkdown content={result.objection_analysis} /></div>
      {result.rebuttals?.map((r: any, i: number) => (
        <div key={i} className={`p-2.5 rounded-lg border text-xs w-full overflow-hidden transition-colors ${i === result.recommended_rebuttal ? "border-primary/30 bg-primary/[0.04]" : "border-border/40 bg-muted/10"}`}>
          <Badge variant="outline" className="text-[9px] mb-1.5 font-semibold border-border/50">{r.approach}</Badge>
          <p className="text-sm break-words whitespace-pre-wrap">{r.response}</p>
          <p className="text-[10px] text-muted-foreground mt-1 break-words whitespace-pre-wrap">{r.reasoning}</p>
        </div>
      ))}
      {result.follow_up_question && (
        <p className="text-xs break-words whitespace-pre-wrap">
          <span className="font-medium">Follow up:</span> {result.follow_up_question}
        </p>
      )}
    </div>
  )
}

// ── Find Similar Result ──────────────────────────────────────

function FindSimilarResult({ result }: { result: Record<string, any> }) {
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <p className="text-[11px] text-muted-foreground/70 font-medium">
        Found {result.total_found} similar companies
      </p>
      {result.similar_companies?.map((c: any, i: number) => (
        <div key={i} className="p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs w-full overflow-hidden hover:bg-muted/20 transition-colors">
          <p className="font-semibold text-[12px] break-words whitespace-pre-wrap">{c.name || c.company_name}</p>
          <p className="text-muted-foreground/70 text-[11px] break-words whitespace-pre-wrap mt-0.5">
            {c.industry} • {c.employee_count_range || c.employee_count_exact || c.employee_count || "N/A"} employees
          </p>
        </div>
      ))}
      {result.error && <p className="text-xs text-destructive break-words whitespace-pre-wrap">{result.error}</p>}
    </div>
  )
}

// ── Meeting Prep Result ──────────────────────────────────────

function MeetingPrepResult({ result }: { result: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false)
  const allQuestions: string[] = result.discovery_questions || []
  const shown = expanded ? allQuestions : allQuestions.slice(0, 3)
  const hiddenCount = allQuestions.length - 3

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {result.company_snapshot && (
        <p className="text-[12.5px] text-foreground/80 leading-snug">
          <span className="font-medium">{result.company_snapshot.name}</span>
          {result.company_snapshot.industry ? ` — ${result.company_snapshot.industry}` : ""}
        </p>
      )}
      {result.talking_points?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Talking Points</p>
          {result.talking_points.slice(0, 3).map((p: string, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
              <p className="text-xs text-foreground/80 leading-snug">{p}</p>
            </div>
          ))}
        </div>
      )}
      {allQuestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Discovery Questions</p>
          {shown.map((q: string, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
              <p className="text-xs text-foreground/80 leading-snug">{q}</p>
            </div>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button onClick={() => setExpanded(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors ml-3.5">
              +{hiddenCount} more
            </button>
          )}
          {expanded && (
            <>
              {result.recommended_approach && (
                <p className="text-xs text-foreground/80 leading-snug pt-1">
                  <span className="font-medium">Approach:</span> {result.recommended_approach}
                </p>
              )}
              <button onClick={() => setExpanded(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors">
                Show less
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Loading Skeleton ─────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-48" />
        <div className="flex gap-1.5 pt-0.5">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
