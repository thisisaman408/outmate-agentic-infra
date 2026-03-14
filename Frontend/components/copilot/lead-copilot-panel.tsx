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
} from "lucide-react"
import { useState } from "react"
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
]

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

// ── Main Component ───────────────────────────────────────────

export function LeadCopilotPanel() {
  const { isPanelOpen, selectedProspect, messages, closePanel } = useCopilotPanelStore()
  const isCompanyEntity = selectedProspect?.entity_type === "company"
  const prospectId = selectedProspect ? getProspectId(selectedProspect) : null
  const { context, isLoading: contextLoading, fetchContext } = useLeadContext(prospectId)
  const { isLoading: actionLoading, executeAction } = useLeadAction()
  const { suggestions, isLoading: suggestionsLoading, fetchSuggestions } = useLeadSuggestions(prospectId)

  // Fetch context + suggestions when panel opens
  useEffect(() => {
    if (isPanelOpen && prospectId && !isCompanyEntity) {
      fetchContext()
      fetchSuggestions()
    }
  }, [isPanelOpen, prospectId, fetchContext, fetchSuggestions, isCompanyEntity])

  const handleQuickAction = useCallback(
    (actionType: LeadActionType) => {
      if (!prospectId) return
      executeAction({
        prospect_id: prospectId,
        action_type: actionType,
        context_overrides: buildContextOverrides(selectedProspect),
      })
    },
    [prospectId, executeAction, selectedProspect]
  )

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

        <ScrollArea className="flex-1 overflow-y-auto">
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

            {/* Conversation Thread */}
            {messages.length > 0 && (
              <>
                <Separator />
                <ConversationThread messages={messages} isLoading={actionLoading} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Command Input */}
        <CopilotCommandInput
          onSubmit={handleCustomCommand}
          isLoading={actionLoading}
        />
      </SheetContent>
    </Sheet>
  )
}

// ── Profile Header ───────────────────────────────────────────

function ProfileHeader({
  name, title, company, email, phone, linkedin, location, seniority,
}: {
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedin?: string
  location?: string
  seniority?: string
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
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline"
          >
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
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />{company.domain}
            </span>
          )}
          {company.headquarters && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />{company.headquarters}
            </span>
          )}
        </div>
        {company.technologies && company.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {company.technologies.slice(0, 8).map((tech) => (
              <Badge key={tech} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tech}
              </Badge>
            ))}
            {company.technologies.length > 8 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{company.technologies.length - 8}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Suggestions Section (Phase 2) ────────────────────────────

function SuggestionsSection({
  suggestions, isLoading, onSuggestionClick,
}: {
  suggestions: LeadSuggestion[]
  isLoading: boolean
  onSuggestionClick: (actionType: LeadActionType) => void
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
        <button
          key={i}
          className="w-full text-left p-2 rounded-md border hover:bg-muted/50 transition-colors"
          onClick={() => s.action_type && onSuggestionClick(s.action_type as LeadActionType)}
        >
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

function ConversationThread({ messages, isLoading }: { messages: CopilotMessage[]; isLoading: boolean }) {
  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden">
      <p className="text-sm font-medium text-muted-foreground">Conversation</p>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role === "user" ? "flex justify-end w-full" : "w-full max-w-full overflow-hidden"}>
          {msg.role === "user" ? (
            <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[85%] break-words">
              <p className="text-sm whitespace-pre-wrap break-words">{msg.prompt}</p>
            </div>
          ) : (
            <div className="bg-muted rounded-lg px-3 py-2 space-y-2 w-full max-w-full overflow-x-hidden break-words">
              {msg.result && <div className="w-full max-w-full overflow-hidden pt-1"><ActionResult actionType={msg.action_type} result={msg.result} /></div>}
              {msg.credits_used != null && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Coins className="h-2.5 w-2.5" />{msg.credits_used} credit(s) used
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Thinking...</span>
        </div>
      )}
    </div>
  )
}

// ── Action Result Renderer ───────────────────────────────────

function ActionResult({ actionType, result }: { actionType?: string; result: Record<string, any> }) {
  if (actionType === "draft_email" && result.segments) {
    return <AnnotatedEmailResult result={result} />
  }

  if (actionType === "research" && result.executive_summary) {
    return <ResearchResult result={result} />
  }

  if (actionType === "objection_handler" && result.rebuttals) {
    return <ObjectionResult result={result} />
  }

  if (actionType === "find_similar" && result.similar_companies) {
    return <FindSimilarResult result={result} />
  }

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

  // Meeting prep or generic result — render as formatted JSON summary
  if (result.company_snapshot || result.talking_points) {
    return <MeetingPrepResult result={result} />
  }

  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
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
                    <a
                      href={seg.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline"
                    >
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 mr-1 cursor-pointer ${TAG_COLORS[seg.tag] || ""}`}
                      >
                        {TAG_ICONS[seg.tag]} {seg.tag}
                      </Badge>
                    </a>
                  ) : (
                    <span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 mr-1 ${TAG_COLORS[seg.tag] || ""}`}
                      >
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
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      <p className="text-sm break-words whitespace-pre-wrap">{result.executive_summary}</p>
      {result.talking_points?.length > 0 && (
        <div className="w-full overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Talking Points</p>
          {result.talking_points.map((p: string, i: number) => (
            <p key={i} className="text-xs break-words whitespace-pre-wrap">• {p}</p>
          ))}
        </div>
      )}
      {result.engagement_opportunities?.length > 0 && (
        <div className="w-full overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Engagement Opportunities</p>
          {result.engagement_opportunities.map((o: any, i: number) => (
            <div key={i} className="text-xs break-words whitespace-pre-wrap">
              <span className="font-medium">{o.type}:</span> {o.detail}
              {o.source_url && (
                <a href={o.source_url} target="_blank" rel="noopener noreferrer"
                  className="ml-1 text-blue-500 hover:underline break-all">[source]</a>
              )}
            </div>
          ))}
        </div>
      )}
      {result.recommended_approach && (
        <div className="w-full overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Recommended Approach</p>
          <p className="text-xs break-words whitespace-pre-wrap">{result.recommended_approach}</p>
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
        <p className="text-xs break-words whitespace-pre-wrap"><span className="font-medium">Follow up:</span> {result.follow_up_question}</p>
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
          <p className="text-muted-foreground break-words whitespace-pre-wrap">{c.industry} • {c.employee_count_range || c.employee_count_exact || c.employee_count || "N/A"} employees</p>
        </div>
      ))}
      {result.error && <p className="text-xs text-destructive break-words whitespace-pre-wrap">{result.error}</p>}
    </div>
  )
}

// ── Meeting Prep Result ──────────────────────────────────────

function MeetingPrepResult({ result }: { result: Record<string, any> }) {
  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {result.company_snapshot && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Company</p>
          <p className="text-sm break-words whitespace-pre-wrap">{result.company_snapshot.name} — {result.company_snapshot.industry}</p>
        </div>
      )}
      {result.talking_points?.length > 0 && (
        <div className="w-full overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Talking Points</p>
          {result.talking_points.map((p: string, i: number) => (
            <p key={i} className="text-xs break-words whitespace-pre-wrap">• {p}</p>
          ))}
        </div>
      )}
      {result.discovery_questions?.length > 0 && (
        <div className="w-full overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground">Discovery Questions</p>
          {result.discovery_questions.map((q: string, i: number) => (
            <p key={i} className="text-xs break-words whitespace-pre-wrap">• {q}</p>
          ))}
        </div>
      )}
      {result.recommended_approach && (
        <p className="text-xs break-words whitespace-pre-wrap"><span className="font-medium">Approach:</span> {result.recommended_approach}</p>
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
