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
  { type: "bombora_intent", label: "Bombora Intent", icon: Zap, cost: 2 },
  { type: "talent_radar", label: "Talent Radar", icon: UserX, cost: 2 },
  { type: "virality", label: "Virality Engine", icon: TrendingUp, cost: 1 },
  { type: "regime_shift", label: "Regime Shifter", icon: ArrowRightLeft, cost: 2 },
  { type: "website_traffic", label: "Website Traffic", icon: BarChart3, cost: 1 },
  { type: "business_events", label: "Business Events", icon: Calendar, cost: 1 },
  { type: "linkedin_posts", label: "LinkedIn Post Analysis", icon: Linkedin, cost: 1 },
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
  bombora_intent:   { emoji: "🎯",  label: "Bombora Intent" },
  talent_radar:     { emoji: "📡",  label: "Talent Radar" },
  virality:         { emoji: "🚀",  label: "Virality Engine" },
  regime_shift:     { emoji: "🌐",  label: "Regime Shift" },
  website_traffic:  { emoji: "📈",  label: "Website Traffic" },
  business_events:  { emoji: "💰",  label: "Business Events" },
  linkedin_posts:   { emoji: "💼",  label: "LinkedIn Posts" },
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
    return { prospect: contextProspect, company }
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
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the ScrollArea viewport to bottom when messages change
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages.length, actionLoading])

  useEffect(() => {
    if (isPanelOpen && prospectId && !isCompanyEntity) {
      fetchContext()
      fetchSuggestions()
    }
  }, [isPanelOpen, prospectId, fetchContext, fetchSuggestions, isCompanyEntity])

  const handleQuickAction = useCallback(
    (actionType: LeadActionType) => {
      if (!prospectId) return
      if (ACTIONS_REQUIRING_INPUT[actionType]) {
        setAwaitingInput(actionType)
        setInputValue("")
        setTimeout(() => inputRef.current?.focus(), 50)
        return
      }
      executeAction({
        prospect_id: prospectId,
        action_type: actionType,
        context_overrides: buildContextOverrides(selectedProspect),
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
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <SheetTitle className="text-lg">Lead Copilot</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Profile Header */}
            {contextLoading ? (
              <ProfileSkeleton />
            ) : (
              <ProfileHeader
                name={context?.prospect?.name || name}
                title={context?.prospect?.title || title}
                company={context?.company?.name || company}
                email={context?.prospect?.email}
                phone={context?.prospect?.phone}
                linkedin={context?.prospect?.linkedin_url || selectedProspect?.linkedin_profile_url}
                location={context?.prospect?.location || location}
                seniority={context?.prospect?.seniority}
              />
            )}

            {/* Company Card */}
            {companyContext && <CompanyCard company={companyContext} />}

            {/* AI Suggestions (Phase 2) */}
            {(suggestionsLoading || (suggestions?.suggestions?.length ?? 0) > 0) && (
              <>
                <Separator />
                <SuggestionsSection
                  suggestions={suggestions?.suggestions || []}
                  isLoading={suggestionsLoading}
                  onSuggestionClick={handleQuickAction}
                />
              </>
            )}

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.type}
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 h-9"
                    disabled={actionLoading}
                    onClick={() => handleQuickAction(action.type)}
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{action.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0">
                      <Coins className="h-2.5 w-2.5 mr-0.5" />
                      {action.cost}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {/* Competitor Input Prompt */}
            {awaitingInput && ACTIONS_REQUIRING_INPUT[awaitingInput] && (
              <>
                <Separator />
                <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
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
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-base font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">
          {title}{company ? ` @ ${company}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {seniority && <Badge variant="secondary" className="text-[10px]">{seniority}</Badge>}
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />{location}
          </span>
        )}
        {email && (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />{email}
          </span>
        )}
        {phone && <span>{phone}</span>}
        {linkedin && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline">
            <Linkedin className="h-3 w-3" />LinkedIn
          </a>
        )}
      </div>
    </div>
  )
}

// ── Company Card ─────────────────────────────────────────────

function CompanyCard({ company }: { company: NonNullable<import("@/lib/api/copilot").LeadContextData["company"]> }) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{company.name}</span>
          {company.industry && (
            <Badge variant="outline" className="text-[10px]">{company.industry}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {company.employee_count && <span>👥 {company.employee_count.toLocaleString()} employees</span>}
          {company.revenue_range && <span>💰 {company.revenue_range}</span>}
          {company.funding_stage && <span>🏦 {company.funding_stage}</span>}
          {company.employee_growth_6m_percent != null && (
            <span>{company.employee_growth_6m_percent > 0 ? "📈" : "📉"} {company.employee_growth_6m_percent}% growth (6mo)</span>
          )}
          {company.domain && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{company.domain}</span>
          )}
          {company.headquarters && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.headquarters}</span>
          )}
        </div>
        {company.technologies && company.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {company.technologies.slice(0, 8).map((tech) => (
              <Badge key={tech} variant="secondary" className="text-[10px] px-1.5 py-0">{tech}</Badge>
            ))}
            {company.technologies.length > 8 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{company.technologies.length - 8}</Badge>
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
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> AI Suggestions
        </p>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5" /> AI Suggestions
      </p>
      {suggestions.map((s, i) => (
        <button key={i} className="w-full text-left p-2 rounded-md border hover:bg-muted/50 transition-colors"
          onClick={() => s.action_type && onSuggestionClick(s.action_type as LeadActionType)}>
          <div className="flex items-start gap-2">
            <span className="text-base">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
            </div>
            {s.priority === "high" && (
              <Badge variant="destructive" className="text-[10px] shrink-0">High</Badge>
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
      <p className="text-sm font-medium text-muted-foreground">Conversation</p>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === "user" ? "flex justify-end w-full" : "w-full max-w-full overflow-hidden"}>
          {msg.role === "user" ? (
            <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] break-words">
              <p className="text-sm whitespace-pre-wrap break-words">{msg.prompt}</p>
            </div>
          ) : (
            <AssistantMessage msg={msg} onFollowUpAction={onFollowUpAction} isLoading={isLoading} />
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
      {isLoading && (
        <div className="bg-muted rounded-lg px-3 py-2 space-y-2">
          {stageDisplay ? (
            <div className="flex items-center gap-2">
              <stageDisplay.icon className={`h-4 w-4 animate-pulse ${stageDisplay.color}`} />
              <span className="text-sm text-muted-foreground">{stageDisplay.text}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          )}
          {streamingStage === "enriching" && (
            <div className="flex gap-1 ml-6">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted border border-border text-muted-foreground">
          {display.emoji} {display.label}
        </span>
        {relativeTime && <span className="text-[10px] text-muted-foreground ml-auto">{relativeTime}</span>}
      </div>

      {/* Result card */}
      <div className="bg-muted rounded-lg px-2.5 py-2 space-y-2 w-full max-w-full overflow-x-hidden break-words">
        {msg.result && (
          <div className="w-full max-w-full overflow-hidden pt-1">
            <ActionResult actionType={msg.action_type} result={msg.result} />
          </div>
        )}
      </div>

      {/* Footer: credits + copy all */}
      <div className="flex items-center justify-between px-0.5">
        {msg.credits_used != null && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
            <Coins className="h-2.5 w-2.5" />{msg.credits_used} credit{msg.credits_used !== 1 ? "s" : ""} used
          </span>
        )}
        {fullText && (
          <button
            onClick={() => copy(fullText, `msg-${msg.id}`)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors ml-auto"
          >
            {copiedKey === `msg-${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedKey === `msg-${msg.id}` ? "Copied" : "Copy All"}
          </button>
        )}
      </div>

      {/* Smart follow-up suggestions */}
      {followUps.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-muted-foreground">Next:</span>
          {followUps.map((f) => (
            <button
              key={f.type}
              disabled={isLoading}
              onClick={() => onFollowUpAction(f.type)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border bg-muted hover:bg-muted/80 active:scale-95 transition-all text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      )}
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
        <p className="text-sm whitespace-pre-wrap break-words">{result.response}</p>
        {result.action_items?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Action Items</p>
            {result.action_items.map((item: string, i: number) => (
              <p key={i} className="text-xs break-words whitespace-pre-wrap">• {item}</p>
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
  // Fallback: show raw_text if present (truncated JSON from LLM), else raw JSON
  if (result.raw_text) return <p className="text-xs whitespace-pre-wrap break-words text-foreground/80">{result.raw_text}</p>
  return <pre className="text-xs whitespace-pre-wrap text-foreground/70">{JSON.stringify(result, null, 2)}</pre>
}

// ── Signal Cards ─────────────────────────────────────────────

const URGENCY_STYLES: Record<string, { border: string; badge: string; badgeText: string }> = {
  high:   { border: "border-l-red-500",   badge: "bg-red-500/[0.15] border border-red-500/25 text-red-400",   badgeText: "HIGH" },
  medium: { border: "border-l-amber-500", badge: "bg-amber-500/[0.12] border border-amber-500/25 text-amber-400", badgeText: "MEDIUM" },
  low:    { border: "border-l-teal-500",  badge: "bg-teal-500/[0.12] border border-teal-500/25 text-teal-400",  badgeText: "LOW" },
}

function SignalCard({ signal, index }: { signal: any; index: number }) {
  const { copiedKey, copy } = useCopyText()
  const urgency = (signal.urgency || "low").toLowerCase()
  const styles = URGENCY_STYLES[urgency] || URGENCY_STYLES.low
  const copyText = `${signal.type?.replace(/_/g, " ").toUpperCase()} [${urgency.toUpperCase()}]\n${signal.description}${signal.suggested_action ? `\n→ ${signal.suggested_action}` : ""}`

  return (
    <div
      className={`relative rounded-xl border border-border border-l-4 ${styles.border} bg-muted/30 p-3 space-y-2 transition-transform hover:translate-x-0.5`}
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
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{section.icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{section.label}</span>
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
    <div className="rounded-xl border border-border overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/[0.05] border-b border-border">
        <span className="text-[12px] font-semibold text-red-300">{competitor} vs Outmate AI</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/[0.15] text-red-500 font-mono tracking-wide">BATTLE CARD</span>
        {company && <span className="ml-auto text-[10.5px] text-muted-foreground">{company}</span>}
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
  const [showBlock, setShowBlock] = useState<number | null>(null)
  const content = result.result || result.battle_card || result.response || ""

  // Parse into typed blocks
  type KVBlock  = { kind: "kv";   key: string; value: string }
  type ListBlock = { kind: "list"; heading: string; items: string[] }
  type TextBlock = { kind: "text"; heading: string; body: string }
  type Block = KVBlock | ListBlock | TextBlock

  const blocks: Block[] = []
  let currentList: ListBlock | null = null
  let currentText: TextBlock | null = null

  const flushCurrent = () => {
    if (currentList) { blocks.push(currentList); currentList = null }
    if (currentText) { blocks.push(currentText); currentText = null }
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Markdown heading → new list block
    if (/^#{1,3}\s/.test(trimmed)) {
      flushCurrent()
      currentList = { kind: "list", heading: trimmed.replace(/^#+\s*/, ""), items: [] }
      continue
    }

    // Bullet line
    if (/^[-•*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "")
      if (currentList) { currentList.items.push(cleaned); continue }
      if (!currentList) { currentList = { kind: "list", heading: "", items: [] } }
      currentList.items.push(cleaned)
      continue
    }

    // "Key: Value" line (short value on same line, not a section intro)
    const kvMatch = trimmed.match(/^([A-Z][^:]{2,30}):\s+(.+)$/)
    if (kvMatch && kvMatch[2].length < 60 && !currentList && !currentText) {
      blocks.push({ kind: "kv", key: kvMatch[1], value: kvMatch[2] })
      continue
    }

    // "Section Heading:" with no value → start a list section
    const sectionMatch = trimmed.match(/^([A-Z][^:]{2,40}):$/)
    if (sectionMatch) {
      flushCurrent()
      currentList = { kind: "list", heading: sectionMatch[1], items: [] }
      continue
    }

    // Plain text line — goes into a text block (e.g. email body)
    if (currentList && currentList.items.length === 0) {
      // Convert empty list block to text block
      currentText = { kind: "text", heading: currentList.heading, body: trimmed }
      currentList = null
    } else if (currentText) {
      currentText.body += " " + trimmed
    } else {
      flushCurrent()
      currentText = { kind: "text", heading: "", body: trimmed }
    }
  }
  flushCurrent()

  // Separate KV blocks from the rest
  const kvBlocks = blocks.filter((b): b is KVBlock => b.kind === "kv")
  const contentBlocks = blocks.filter((b): b is ListBlock | TextBlock => b.kind !== "kv")
  const LIMIT = 3

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {/* KV badges row — always shown */}
      {kvBlocks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kvBlocks.map((kv, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10.5px] bg-muted border border-border rounded-md px-2 py-0.5">
              <span className="text-muted-foreground">{kv.key}:</span>
              <span className="text-foreground/80 font-medium">{kv.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Content blocks */}
      {contentBlocks.map((block, bi) => {
        if (block.kind === "list") {
          const shown = expanded ? block.items : block.items.slice(0, LIMIT)
          const hidden = block.items.length - LIMIT
          return (
            <div key={bi} className="space-y-1">
              {block.heading && (
                <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">{block.heading}</p>
              )}
              {shown.map((item, ii) => (
                <div key={ii} className="flex gap-2 items-start">
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 mt-[7px]" />
                  <p className="text-[12px] text-foreground/75 leading-snug line-clamp-2">{item}</p>
                </div>
              ))}
              {!expanded && hidden > 0 && (
                <button onClick={() => setExpanded(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors ml-3">
                  +{hidden} more
                </button>
              )}
            </div>
          )
        }
        // Text block (email body etc.) — collapsed behind toggle
        if (block.kind === "text") {
          const isOpen = showBlock === bi
          return (
            <div key={bi} className="space-y-1">
              <button onClick={() => setShowBlock(isOpen ? null : bi)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {block.heading && <span className="font-medium">{block.heading}</span>}
                {!block.heading && <span>Rewrite</span>}
                {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {isOpen && (
                <p className="text-[12px] text-foreground/70 leading-snug bg-muted/40 rounded p-2 border border-border/50">
                  {block.body}
                </p>
              )}
            </div>
          )
        }
        return null
      })}

      {expanded && (
        <button onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors">
          Show less
        </button>
      )}
    </div>
  )
}

// ── Bombora Intent ───────────────────────────────────────────

function BomboraIntentResult({ result }: { result: Record<string, any> }) {
  const topics = (result.intent_topics || []).slice(0, 3)
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-yellow-500" />
        <p className="text-sm font-semibold">Intent Analysis</p>
        <Badge variant="outline" className="text-[10px] ml-auto">{result.level_of_intent} Level</Badge>
      </div>
      <div className="space-y-1.5">
        {topics.map((topic: any, i: number) => (
          <div key={topic.name || i} className="p-2 rounded bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium truncate pr-2">{topic.name}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Score: {topic.score}</span>
            </div>
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${topic.score}%` }} />
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
          <p className="text-xs font-medium break-words whitespace-pre-wrap flex-1">Subject: {result.subject_line}</p>
          <Button variant="ghost" size="sm" className="h-6 px-2 shrink-0" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="text-[10px] ml-1">{copied ? "Copied" : "Copy"}</span>
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
      <p className="text-[12.5px] leading-snug text-foreground/80 break-words">{result.executive_summary}</p>
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
                  <p className="text-xs text-foreground/80 leading-snug mt-0.5">{result.recommended_approach}</p>
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
      <p className="text-xs text-muted-foreground italic break-words whitespace-pre-wrap">{result.objection_analysis}</p>
      {result.rebuttals?.map((r: any, i: number) => (
        <div key={i} className={`p-2 rounded border text-xs w-full overflow-hidden ${i === result.recommended_rebuttal ? "border-primary bg-primary/5" : ""}`}>
          <Badge variant="outline" className="text-[9px] mb-1">{r.approach}</Badge>
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
      <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
        Found {result.total_found} similar companies
      </p>
      {result.similar_companies?.map((c: any, i: number) => (
        <div key={i} className="p-2 rounded border text-xs w-full overflow-hidden">
          <p className="font-medium break-words whitespace-pre-wrap">{c.name || c.company_name}</p>
          <p className="text-muted-foreground break-words whitespace-pre-wrap">
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
    <div className="space-y-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
