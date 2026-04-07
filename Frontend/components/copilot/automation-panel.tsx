'use client'

/**
 * AUTOMATION PANEL
 * Full-featured chat UI for the Co-Pilot Automation Agent.
 * Phase 3: workflow plan tracker, undo/redo button, mobile-responsive layout.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, RotateCcw, Navigation, Filter, Search,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
  ArrowRight, Bot, User, Zap, Undo2, ListChecks,
  Circle, Square, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useCoPilotAgent } from '@/hooks/use-copilot-agent'
import { useCoPilotAgentStore, Message, ToolCall, WorkflowPlan } from '@/lib/copilot/agent-store'
import { ROUTE_NAMES } from '@/lib/copilot/navigation-controller'
import ReactMarkdown from 'react-markdown'

// ── Suggested prompts ──────────────────────────────────────────────────

const SUGGESTIONS = [
  'Find VPs of Sales at Series B fintech companies',
  'Run Crossfire on apollo.io for the EU market',
  'Research Anthropic — deep company intelligence',
  'Score Acme Corp for conversion likelihood',
  'Build a virality plan around Figma and Notion',
  'Check my cold email for GDPR compliance',
]

// ── Workflow step icon ─────────────────────────────────────────────────

function stepIcon(type: string, status: string) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
  if (status === 'error') return <XCircle className="w-3.5 h-3.5 text-red-500" />

  const icons: Record<string, React.ElementType> = {
    navigate: Navigation,
    filter: Filter,
    search: Search,
    create_campaign: Sparkles,
    create_workflow: Zap,
    run_agent: Zap,
    other: Circle,
  }
  const Icon = icons[type] ?? Circle
  return <Icon className="w-3.5 h-3.5 text-muted-foreground" />
}

// ── Workflow Plan View ─────────────────────────────────────────────────

function WorkflowPlanView({ plan }: { plan: WorkflowPlan }) {
  const [collapsed, setCollapsed] = useState(false)

  const statusColor =
    plan.status === 'complete'
      ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800/50'
      : plan.status === 'error'
        ? 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800/50'
        : 'border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800/50'

  const headerColor =
    plan.status === 'complete'
      ? 'text-emerald-700 dark:text-emerald-400'
      : plan.status === 'error'
        ? 'text-red-600 dark:text-red-400'
        : 'text-violet-700 dark:text-violet-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border text-xs overflow-hidden ${statusColor}`}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <ListChecks className={`w-3.5 h-3.5 shrink-0 ${headerColor}`} />
        <span className={`flex-1 font-semibold truncate ${headerColor}`}>{plan.name}</span>
        <Badge
          variant="outline"
          className={`text-[10px] h-4 px-1.5 border-current ${headerColor}`}
        >
          {plan.status === 'complete'
            ? 'Done'
            : plan.status === 'error'
              ? 'Failed'
              : `${plan.currentStepIndex + 1}/${plan.steps.length}`}
        </Badge>
        {collapsed
          ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
          : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 border-t border-inherit">
              {plan.steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div className="shrink-0">{stepIcon(step.type, step.status)}</div>
                  <span
                    className={`text-[11px] leading-snug ${
                      step.status === 'pending'
                        ? 'text-muted-foreground'
                        : step.status === 'success'
                          ? 'line-through text-muted-foreground'
                          : step.status === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-foreground font-medium'
                    }`}
                  >
                    {i + 1}. {step.description}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Tool call pill ─────────────────────────────────────────────────────

function ToolCallPill({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)

  const icons: Record<string, React.ElementType> = {
    navigate_to: Navigation,
    set_filters: Filter,
    execute_search: Search,
    get_module_parameters: Zap,
    create_campaign: Sparkles,
    create_workflow: Zap,
    summarize_results: CheckCircle2,
    plan_workflow: ListChecks,
    undo_last_action: Undo2,
    add_to_campaign: Sparkles,
    list_campaigns: Search,
    fill_copilot_form: Sparkles,
    fill_ai_agent_form: Zap,
  }

  const Icon = icons[call.name] ?? Zap
  const isSuccess = call.status === 'success'
  const isError = call.status === 'error'
  const isPending = call.status === 'pending'

  const statusColor = isSuccess
    ? 'text-emerald-600 dark:text-emerald-400'
    : isError
      ? 'text-red-500'
      : 'text-blue-500'

  const pillBg = isSuccess
    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50'
    : isError
      ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50'
      : 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50'

  const label = (() => {
    switch (call.name) {
      case 'navigate_to':
        return `Navigate → ${ROUTE_NAMES[call.input.page as keyof typeof ROUTE_NAMES] ?? call.input.page}`
      case 'set_filters':
        return `Set filters on ${call.input.module}`
      case 'execute_search':
        return `Search ${call.input.module}`
      case 'get_module_parameters':
        return `Get params: ${call.input.module}`
      case 'create_campaign':
        return `Create campaign: ${call.input.name}`
      case 'create_workflow':
        return `Create workflow: ${call.input.name}`
      case 'summarize_results':
        return 'Summarize results'
      case 'plan_workflow':
        return `Plan: ${call.input.name}`
      case 'undo_last_action':
        return `Undo filters on ${call.input.module}`
      case 'add_to_campaign':
        return `Add to campaign: ${call.input.campaign_name}`
      case 'list_campaigns':
        return 'List campaigns'
      case 'fill_copilot_form':
        return `Fill ${call.input.module} form`
      case 'fill_ai_agent_form': {
        const agentLabels: Record<string, string> = {
          agentic_search: 'Agentic Search',
          lookalike: 'Lookalike Agent',
          research: 'Research Agent',
          predictive: 'Predictive Agent',
          crossfire: 'Crossfire Agent',
          compliance_oracle: 'Compliance Oracle',
          virality_engine: 'Virality Engine',
          talent_radar: 'Talent Radar',
          regime_shifter: 'Regime Shifter',
        }
        const agentName = agentLabels[call.input.agent as string] ?? String(call.input.agent)
        return `Deploy ${agentName}`
      }
      default:
        return call.name
    }
  })()

  return (
    <div className={`rounded-lg border text-xs ${pillBg} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {isPending ? (
          <Loader2 className={`w-3.5 h-3.5 shrink-0 animate-spin ${statusColor}`} />
        ) : isSuccess ? (
          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${statusColor}`} />
        ) : (
          <XCircle className={`w-3.5 h-3.5 shrink-0 ${statusColor}`} />
        )}
        <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 font-medium truncate text-foreground">{label}</span>
        {call.result && (
          open
            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && call.result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap border-t border-inherit">
              {call.result.message}
              {call.result.data != null && (
                <div className="mt-1 opacity-70">
                  {JSON.stringify(call.result.data as Record<string, unknown>, null, 2)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Parse inline suggestions from Claude's response ───────────────────

function parseSuggestions(content: string): { clean: string; suggestions: string[] } {
  const match = content.match(/```suggestions\n([\s\S]*?)```/)
  if (!match) return { clean: content, suggestions: [] }
  const suggestions = match[1]
    .trim()
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('<'))
  const clean = content.replace(/```suggestions\n[\s\S]*?```/, '').trim()
  return { clean, suggestions }
}

// ── Suggestion chip (clickable + copyable) ─────────────────────────────

function SuggestionChip({
  text,
  onSend,
}: {
  text: string
  onSend: (t: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="group flex items-stretch rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50/80 dark:bg-violet-950/20 overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 transition-colors">
      <button
        onClick={() => onSend(text)}
        className="flex-1 flex items-center gap-1.5 px-2.5 py-2 text-left min-h-[34px]"
      >
        <ArrowRight className="w-3 h-3 shrink-0 text-violet-500 dark:text-violet-400" />
        <span className="text-[11px] text-violet-700 dark:text-violet-300 font-medium leading-snug">
          {text}
        </span>
      </button>
      <button
        onClick={handleCopy}
        title="Copy prompt"
        className="px-2.5 flex items-center border-l border-violet-200 dark:border-violet-800/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        {copied ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────

function MessageBubble({
  message,
  onSuggest,
}: {
  message: Message
  onSuggest?: (text: string) => void
}) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>

      <div className={`flex flex-col gap-2 max-w-[88%] sm:max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Content bubble */}
        {(() => {
          const { clean, suggestions } = isUser
            ? { clean: message.content, suggestions: [] as string[] }
            : parseSuggestions(message.content)
          return (
            <>
              <div
                className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted/60 text-foreground rounded-tl-sm'
                }`}
              >
                {isUser ? (
                  clean
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ children }) => (
                        <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {clean}
                  </ReactMarkdown>
                )}
              </div>

              {/* Inline suggestion chips */}
              {!isUser && suggestions.length > 0 && onSuggest && (
                <div className="flex flex-col gap-1 w-full">
                  {suggestions.map((s, i) => (
                    <SuggestionChip key={i} text={s} onSend={onSuggest} />
                  ))}
                </div>
              )}
            </>
          )
        })()}

        {/* Tool call pills */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.toolCalls.map((tc) => (
              <ToolCallPill key={tc.id} call={tc} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}

// ── Typing indicator ───────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex gap-2 sm:gap-3 items-end"
    >
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
        <Bot className="w-3.5 h-3.5" />
      </div>
      <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-4 text-center">
      <div className="p-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30">
        <Sparkles className="w-8 h-8 text-violet-600 dark:text-violet-400" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">Automation Agent</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Tell me what you need. I'll navigate, filter, search — and even chain multi-step workflows.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="flex items-center gap-2 text-left text-sm px-4 py-3 min-h-[44px] rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────

export function AutomationPanel() {
  const { messages, isLoading, sendMessage, interrupt, clearHistory, navigationInProgress, appliedFilters } =
    useCoPilotAgent()
  const workflowPlan = useCoPilotAgentStore((s) => s.workflowPlan)
  const undoFilters = useCoPilotAgentStore((s) => s.undoFilters)
  const filterHistoryStack = useCoPilotAgentStore((s) => s.filterHistoryStack)

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await sendMessage(text)
    inputRef.current?.focus()
  }, [input, isLoading, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggest = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  // Most recently filtered module (for undo button label)
  const lastFilteredModule = filterHistoryStack.length > 0
    ? filterHistoryStack[filterHistoryStack.length - 1].module
    : null

  const canUndo = filterHistoryStack.length > 0

  const handleUndo = () => {
    if (lastFilteredModule) {
      sendMessage(`undo the last filter change on ${lastFilteredModule}`)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border/60 bg-card/40 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Automation Agent</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {navigationInProgress ? 'Navigating…' : 'Ready'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo button — visible when there's filter history */}
          <AnimatePresence>
            {canUndo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={isLoading}
                  title={`Undo last filter change${lastFilteredModule ? ` on ${lastFilteredModule}` : ''}`}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <Undo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Undo</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation progress bar */}
      <AnimatePresence>
        {navigationInProgress && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="h-0.5 bg-gradient-to-r from-violet-500 to-primary origin-left"
            style={{ transformOrigin: 'left' }}
          />
        )}
      </AnimatePresence>

      {/* Active workflow plan tracker */}
      <AnimatePresence>
        {workflowPlan && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/40 px-4 py-2"
          >
            <WorkflowPlanView plan={workflowPlan} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState onSuggest={handleSuggest} />
        ) : (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5"
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSuggest={sendMessage} />
            ))}
            <AnimatePresence>
              {isLoading && <TypingIndicator />}
            </AnimatePresence>
            <div />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/60 p-3 sm:p-4 bg-card/30 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find prospects, analyze signals, create campaigns…"
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 sm:px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 min-h-[44px] max-h-[120px] leading-relaxed"
              style={{ overflow: 'hidden' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
          </div>
          {isLoading ? (
            <Button
              onClick={interrupt}
              size="sm"
              variant="destructive"
              className="h-11 w-11 p-0 rounded-xl shrink-0 touch-manipulation"
              title="Stop"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="sm"
              className="h-11 w-11 p-0 rounded-xl shrink-0 bg-primary hover:bg-primary/90 touch-manipulation"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1 hidden sm:block">
          Enter to send · Shift+Enter for new line · <span className="font-medium">Tip:</span> Try "find VPs then create a campaign"
        </p>
      </div>
    </div>
  )
}
