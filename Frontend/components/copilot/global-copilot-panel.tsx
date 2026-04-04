"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Sparkles, Send, X, RotateCcw, MessageSquare, ArrowRight,
  LayoutDashboard, Zap, AlertTriangle, CreditCard, Bot,
  Signal, Users, Mail, BarChart3, Eye, Workflow, Target,
  Search, Settings, BrainCircuit, ChevronRight, History,
  Plus, Trash2, ChevronLeft, Clock, Layers, Play, ExternalLink,
  Building2, User,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useChatbot, ChatSession, OrchestrateIntentData } from "@/hooks/use-chatbot"
import { copilotApi, OrchestratorEvent } from "@/lib/api/copilot"
import { usePathname, useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"

// ── Route-based contextual suggestions (G4/4.3) ─────────────────────
const ROUTE_SUGGESTIONS: Record<string, { icon: React.ElementType; questions: string[] }> = {
  "/signals": {
    icon: Signal,
    questions: [
      "What are signals and how do I use them?",
      "How do I create a new signal?",
      "What types of events can signals track?",
    ],
  },
  "/campaigns": {
    icon: Mail,
    questions: [
      "How do I create an email campaign?",
      "How does the Campaign Optimizer improve my emails?",
      "What are the best practices for outreach sequences?",
    ],
  },
  "/leads": {
    icon: Users,
    questions: [
      "How do I search for new leads?",
      "What is Lead Scoring and how does it work?",
      "How do I enrich a lead's profile?",
    ],
  },
  "/copilot/daily-brief": {
    icon: LayoutDashboard,
    questions: [
      "What is the Daily Brief?",
      "How do I configure Daily Brief notifications?",
      "What data does the Daily Brief summarize?",
    ],
  },
  "/copilot/meeting-prep": {
    icon: BrainCircuit,
    questions: [
      "How does Meeting Prep work?",
      "What research does Meeting Prep generate?",
      "How do I prepare for an upcoming call?",
    ],
  },
  "/copilot/campaign-optimizer": {
    icon: Target,
    questions: [
      "How does the Campaign Optimizer score my emails?",
      "What is the Email Optimizer?",
      "How do I improve my open rates?",
    ],
  },
  "/copilot/pipeline-alerts": {
    icon: AlertTriangle,
    questions: [
      "How do pipeline alerts work?",
      "What risk factors does the pipeline scanner detect?",
      "How do I configure alert severity levels?",
    ],
  },
  "/copilot": {
    icon: Sparkles,
    questions: [
      "What can the AI Copilot do?",
      "What's the difference between Daily Brief and Pipeline Alerts?",
      "How do credits work?",
    ],
  },
  "/ai-agents": {
    icon: Bot,
    questions: [
      "What AI agents are available?",
      "How do I deploy an AI agent?",
      "What is the GTM agent?",
    ],
  },
  "/analytics": {
    icon: BarChart3,
    questions: [
      "What analytics are available?",
      "How do I track sales performance?",
      "What insights does the analytics dashboard show?",
    ],
  },
  "/visitors": {
    icon: Eye,
    questions: [
      "What is Visitor Tracker?",
      "How do I identify anonymous website visitors?",
      "How does visitor intelligence work?",
    ],
  },
  "/dashboard": {
    icon: LayoutDashboard,
    questions: [
      "What can I do with Outmate?",
      "How do I get started with the platform?",
      "What are the main features?",
    ],
  },
  "/settings": {
    icon: Settings,
    questions: [
      "How do I configure my account?",
      "How do I manage integrations?",
      "Where do I manage my Copilot preferences?",
    ],
  },
  "/workflows": {
    icon: Workflow,
    questions: [
      "What are Workflows in Outmate?",
      "How do I automate my sales motions?",
      "How do I create a custom playbook?",
    ],
  },
  "/ai-powered-search": {
    icon: Search,
    questions: [
      "How does AI Powered Search work?",
      "How do I search for companies using AI?",
      "What filters are available in AI search?",
    ],
  },
}

const DEFAULT_SUGGESTIONS = [
  "What can I do with Outmate?",
  "How do signals work?",
  "How do pipeline alerts work?",
]

function getRouteSuggestions(pathname: string) {
  if (ROUTE_SUGGESTIONS[pathname]) return ROUTE_SUGGESTIONS[pathname]
  const sortedKeys = Object.keys(ROUTE_SUGGESTIONS).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (pathname.startsWith(key)) return ROUTE_SUGGESTIONS[key]
  }
  return null
}


// ── Markdown message component ───────────────────────────────────────
function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="copilot-markdown text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
          h1: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-bold first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-bold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}


// ── Typing indicator — animated wave bars ────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <motion.div
          className="absolute inset-0 rounded-lg border border-primary/30"
          animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        />
      </div>
      <div className="flex items-end gap-[3px] h-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-primary/50"
            animate={{ height: ["6px", "18px", "6px"] }}
            transition={{ repeat: Infinity, duration: 1, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          Generating response...
        </motion.span>
      </span>
    </div>
  )
}


// ── Chat history sidebar view ────────────────────────────────────────
function ChatHistoryView({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewChat,
  onBack,
}: {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold flex-1">Chat History</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs rounded-lg"
          onClick={() => { onNewChat(); onBack(); }}
        >
          <Plus className="h-3 w-3" />
          New Chat
        </Button>
      </div>

      {/* Sessions list */}
      <ScrollArea className="flex-1 px-3 py-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center">
              <History className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/60">
              Start chatting and your conversations will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="group"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { onSelect(session.id); onBack(); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { onSelect(session.id); onBack(); } }}
                  className={`w-full text-left rounded-xl px-4 py-3 transition-all duration-150 flex items-start gap-3 cursor-pointer ${
                    session.id === activeSessionId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {session.updated_at ? new Date(session.updated_at).toLocaleDateString() : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.message_count} messages
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}


// ── Orchestrate card (shown inline when chatbot detects a workflow intent) ──
type InlineStatus = "idle" | "running" | "done" | "error"

function OrchestrateCard({
  data,
  onNavigate,
}: {
  data: OrchestrateIntentData
  onNavigate: (url: string) => void
}) {
  const [inlineStatus, setInlineStatus] = useState<InlineStatus>("idle")
  const [inlineError, setInlineError] = useState("")
  const [stepCount, setStepCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const handleRunInline = async () => {
    if (!data.prospect_id || data.source === "not_found") return
    setInlineStatus("running")
    setStepCount(0)
    setInlineError("")
    abortRef.current = new AbortController()
    try {
      await copilotApi.orchestrate(
        data.prospect_id,
        data.task,
        (event: OrchestratorEvent) => {
          if (event.type === "step_complete") setStepCount((n) => n + 1)
          if (event.type === "complete") setInlineStatus("done")
          if (event.type === "error") {
            setInlineError(event.data.message || "Orchestration failed")
            setInlineStatus("error")
          }
        },
        abortRef.current.signal
      )
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setInlineError(err instanceof Error ? err.message : "Unknown error")
        setInlineStatus("error")
      }
    }
  }

  const handleOpenFull = () => {
    const params = new URLSearchParams({ task: data.task })
    if (data.prospect_id && data.source !== "not_found") {
      params.set("prospect_id", data.prospect_id)
    }
    onNavigate(`/copilot/orchestrate?${params.toString()}`)
  }

  const notFound = data.source === "not_found"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-2 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-2.5"
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 shrink-0">
          <Layers className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          Co-Pilot Orchestrate
        </span>
        {!notFound && (
          <span className="ml-auto text-[10px] text-muted-foreground">~{data.estimated_credits} credits</span>
        )}
      </div>

      {/* Prospect info */}
      <div className="flex flex-col gap-1 text-xs text-foreground/80">
        {data.prospect_name && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-medium">{data.prospect_name}</span>
            {data.prospect_title && <span className="text-muted-foreground">· {data.prospect_title}</span>}
          </div>
        )}
        {data.prospect_company && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{data.prospect_company}</span>
          </div>
        )}
      </div>

      {/* Task */}
      <p className="text-[11px] text-muted-foreground leading-relaxed italic">"{data.task}"</p>

      {/* Status / Actions */}
      {inlineStatus === "idle" && (
        <div className="flex items-center gap-2">
          {!notFound && (
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3"
              onClick={handleRunInline}
            >
              <Play className="h-3 w-3" />
              Run inline
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1.5 rounded-lg px-3 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
            onClick={handleOpenFull}
          >
            <ExternalLink className="h-3 w-3" />
            Open full view
          </Button>
        </div>
      )}

      {inlineStatus === "running" && (
        <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Layers className="h-3.5 w-3.5" />
          </motion.div>
          <span>Running… {stepCount > 0 ? `${stepCount} step${stepCount > 1 ? "s" : ""} complete` : "starting"}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] ml-auto text-muted-foreground"
            onClick={() => { abortRef.current?.abort(); setInlineStatus("idle") }}
          >
            Cancel
          </Button>
        </div>
      )}

      {inlineStatus === "done" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Done — {stepCount} steps completed</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] ml-auto gap-1 rounded-lg border-violet-200 dark:border-violet-800"
            onClick={handleOpenFull}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View results
          </Button>
        </div>
      )}

      {inlineStatus === "error" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-red-500">{inlineError || "Error occurred"}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] ml-auto"
            onClick={() => setInlineStatus("idle")}
          >
            Retry
          </Button>
        </div>
      )}
    </motion.div>
  )
}


// ── Main panel ───────────────────────────────────────────────────────
export function GlobalCopilotPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const setOpen = onOpenChange
  const [input, setInput] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const {
    messages, isLoading, sendMessage, sessions, sessionsLoaded,
    activeSessionId, loadSession, deleteSession, startNewChat, refreshSessions,
  } = useChatbot()
  const pathname = usePathname()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_INPUT = 1000
  const WARN_THRESHOLD = 800

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (open && !showHistory) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, showHistory])

  // Refresh sessions when panel opens
  useEffect(() => {
    if (open) refreshSessions()
  }, [open, refreshSessions])

  const routeSuggestions = useMemo(() => getRouteSuggestions(pathname), [pathname])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || input.length > MAX_INPUT) return
    const currentInput = input
    setInput("")
    await sendMessage(currentInput, pathname)
  }

  const handleSuggestionClick = async (question: string) => {
    if (isLoading) return
    setInput("")
    await sendMessage(question, pathname)
  }

  const handleLinkClick = (url: string) => {
    router.push(url)
    setOpen(false)
  }

  const suggestions = routeSuggestions?.questions || DEFAULT_SUGGESTIONS
  const SuggestionIcon = routeSuggestions?.icon || Sparkles

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* ── Panel ───────────────────────────────────────── */}
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[460px] p-0 flex flex-col border-l shadow-2xl bg-background"
      >
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              <ChatHistoryView
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelect={loadSession}
                onDelete={deleteSession}
                onNewChat={startNewChat}
                onBack={() => setShowHistory(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    Outmate Copilot
                  </SheetTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => setShowHistory(true)}
                      title="Chat history"
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={startNewChat}
                      title="New conversation"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 pl-[42px]">
                  Ask about any feature or how to use Outmate
                </p>
              </SheetHeader>

              {/* Messages area */}
              <ScrollArea className="flex-1 px-5 py-4" viewportRef={scrollRef}>
                <div className="space-y-5">
                  {/* ── Welcome state ──────────────────────────── */}
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="flex flex-col gap-6 pt-8 pb-4"
                    >
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                            <MessageSquare className="h-7 w-7 text-primary" />
                          </div>
                          <motion.div
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                          >
                            <Zap className="h-2.5 w-2.5 text-primary" />
                          </motion.div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Welcome to Outmate Copilot</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
                            I can help you navigate features, explain how things work, and guide you through the platform.
                          </p>
                        </div>
                      </div>

                      {/* Quick actions row */}
                      <div className="flex items-center gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 h-9 px-4 rounded-lg border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 transition-all"
                          onClick={() => handleLinkClick("/copilot/daily-brief")}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Daily Brief
                          <ChevronRight className="h-3 w-3 opacity-50" />
                        </Button>
                        {sessions.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 h-9 px-4 rounded-lg border-border/60 hover:bg-muted/60 transition-all"
                            onClick={() => setShowHistory(true)}
                          >
                            <History className="h-3.5 w-3.5" />
                            History ({sessions.length})
                          </Button>
                        )}
                      </div>

                      {/* Contextual suggestions */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 px-1">
                          <SuggestionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            {routeSuggestions ? "Suggestions for this page" : "Try asking"}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {suggestions.map((q, i) => (
                            <motion.button
                              key={q}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
                              onClick={() => handleSuggestionClick(q)}
                              className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-left text-sm text-foreground/80 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.03] hover:text-foreground hover:shadow-sm"
                            >
                              <span className="flex-1 leading-snug">{q}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Messages ──────────────────────────────── */}
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : msg.isCreditError
                              ? "bg-amber-500/10 border border-amber-500/20 text-foreground rounded-bl-md"
                              : msg.isError
                              ? "bg-destructive/10 border border-destructive/20 text-foreground rounded-bl-md"
                              : "bg-muted/60 text-foreground rounded-bl-md border border-border/40"
                          }`}
                        >
                          {msg.isCreditError && (
                            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Credits Exhausted</span>
                            </div>
                          )}
                          {msg.isError && !msg.isCreditError && (
                            <div className="flex items-center gap-2 mb-2 text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Connection Error</span>
                            </div>
                          )}

                          {msg.role === "assistant" ? (
                            msg.content ? (
                              <AssistantMessage content={msg.content} />
                            ) : (
                              <TypingIndicator />
                            )
                          ) : (
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          )}

                          {msg.links && msg.links.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ delay: 0.15, duration: 0.25 }}
                              className="mt-3 flex flex-wrap gap-1.5 pt-3 border-t border-border/30"
                            >
                              {msg.links.map((link, idx) => (
                                <Button
                                  key={idx}
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 text-[11px] gap-1 font-medium rounded-lg hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                                  onClick={() => handleLinkClick(link.url)}
                                >
                                  {link.label}
                                  <ArrowRight className="h-2.5 w-2.5" />
                                </Button>
                              ))}
                            </motion.div>
                          )}
                        </div>

                        {/* Orchestrate card — shown below assistant bubble when intent detected */}
                        {msg.role === "assistant" && msg.orchestrateData && (
                          <OrchestrateCard
                            data={msg.orchestrateData}
                            onNavigate={(url) => { handleLinkClick(url) }}
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isLoading && messages.length > 0 && !messages[messages.length - 1]?.content && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3 border border-border/40 shadow-sm">
                        <TypingIndicator />
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* ── Input area ────────────────────────────────── */}
              <div className="px-5 py-4 border-t border-border/60 bg-card/30 backdrop-blur-sm">
                <form onSubmit={handleSend} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask anything about Outmate..."
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                    disabled={isLoading}
                    maxLength={MAX_INPUT}
                    className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 pr-12 text-sm shadow-inner placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim() || input.length > MAX_INPUT}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-all duration-200 ${
                      input.trim()
                        ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-[10px] text-muted-foreground">
                    AI-powered product assistant
                  </p>
                  {input.length > WARN_THRESHOLD && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`text-[10px] font-medium tabular-nums ${
                        input.length >= MAX_INPUT ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {input.length}/{MAX_INPUT}
                    </motion.span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
