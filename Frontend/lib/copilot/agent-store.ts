import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'

/**
 * AGENT STORE - Type Definitions
 * Shared state management for Co-Pilot Automation Agent
 */

// ── Message Types ──
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'success' | 'error'
  result?: ToolResult
}

export interface ToolResult {
  status: 'success' | 'error'
  message: string
  data?: unknown
}

// ── Navigation Types ──
export type RouteType =
  | '/leads/prospects'
  | '/leads/companies'
  | '/leads/companies/search'
  | '/leads/companies/identification'
  | '/leads/companies/enrichment'
  | '/leads/companies/linkedin-posts'
  | '/leads/companies/keyword-search'
  | '/signals/intents'
  | '/signals/events'
  | '/signals/trackers'
  | '/signals/websights'
  | '/signals/form-complete'
  | '/campaigns'
  | '/workflows'
  | '/ai-agents'
  | '/ai-powered-search'
  | '/leads/watcher'
  | '/copilot/meeting-prep'
  | '/copilot/pipeline-alerts'
  | '/copilot/campaign-optimizer'
  | '/campaigns/new'

// ── Filter Types ──
export interface FilterSnapshot {
  module: string
  filters: Record<string, unknown>
  timestamp: number
}

// ── Workflow Types ──
export type WorkflowStepType =
  | 'navigate'
  | 'filter'
  | 'search'
  | 'create_campaign'
  | 'create_workflow'
  | 'create_watcher'
  | 'run_agent'
  | 'other'

export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  description: string
  status: 'pending' | 'running' | 'success' | 'error'
  toolName?: string
  result?: string
}

export interface WorkflowPlan {
  id: string
  name: string
  steps: WorkflowStep[]
  currentStepIndex: number
  status: 'planning' | 'running' | 'complete' | 'error'
  createdAt: number
}

// ── Execution Types ──
export interface ExecutionStep {
  id: string
  type: 'navigate' | 'filter' | 'search' | 'create'
  module: string
  status: 'pending' | 'success' | 'error'
  message?: string
  timestamp: number
}

export interface ExecutionResult {
  module: string
  status: 'success' | 'error'
  resultCount?: number
  results?: unknown[]
  error?: string
  timestamp: number
}

// ── Main Store State Type ──
export interface CoPilotAgentState {
  // ── Conversation State ──
  messages: Message[]
  isLoading: boolean
  activeSessionId: string | null

  // ── Navigation State ──
  currentRoute: string
  targetRoute: RouteType | null
  navigationInProgress: boolean

  // ── Filter Injection State ──
  pendingFilters: Record<string, Record<string, unknown>>
  appliedFilters: Record<string, Record<string, unknown>>
  filterHistoryStack: FilterSnapshot[]

  // ── Execution State ──
  executionQueue: ExecutionStep[]
  currentExecutionStep: ExecutionStep | null
  executionResults: ExecutionResult[]
  highlightedElement: string | null

  // ── Workflow Plan State ──
  workflowPlan: WorkflowPlan | null

  // ── Copilot Form Injection State ──
  // Agent writes form values here; pages subscribe and auto-fill + submit
  copilotForms: Record<string, { fields: Record<string, unknown>; submitSignal: number }>

  // ── Redo Stack ──
  redoStack: FilterSnapshot[]

  // ── Actions ──
  // Message actions
  addMessage(message: Message): void
  clearMessages(): void
  updateMessage(id: string, updates: Partial<Message>): void

  // Navigation actions
  setCurrentRoute(route: string): void
  setTargetRoute(route: RouteType | null): void
  setNavigationInProgress(inProgress: boolean): void

  // Filter actions
  setPendingFilters(module: string, filters: Record<string, unknown>): void
  applyFilters(module: string): void
  clearFilters(module: string): void
  clearAllFilters(): void
  undoFilters(module: string): boolean

  // Execution actions
  addExecutionStep(step: ExecutionStep): void
  updateExecutionStep(stepId: string, updates: Partial<ExecutionStep>): void
  addExecutionResult(result: ExecutionResult): void
  clearExecutionHistory(): void

  // Highlight actions
  setHighlight(elementId: string | null): void

  // Workflow plan actions
  setWorkflowPlan(plan: WorkflowPlan): void
  advanceWorkflowStep(): void
  failWorkflowStep(error: string): void
  clearWorkflowPlan(): void

  // Copilot form actions
  setCopilotForm(module: string, fields: Record<string, unknown>, autoSubmit?: boolean): void
  clearCopilotForm(module: string): void

  // Redo actions
  pushRedo(snapshot: FilterSnapshot): void
  redoFilters(module: string): boolean

  // Session actions
  startSession(sessionId: string): void
  endSession(): void

  // Utility actions
  reset(): void
}

// ── Initial State ──
// Non-function slice of initial state — TypeScript infers the type from the literal
const initialState = {
  messages: [],
  isLoading: false,
  activeSessionId: null,
  currentRoute: '/',
  targetRoute: null,
  navigationInProgress: false,
  pendingFilters: {},
  appliedFilters: {},
  filterHistoryStack: [],
  executionQueue: [],
  currentExecutionStep: null,
  executionResults: [],
  highlightedElement: null,
  workflowPlan: null,
  copilotForms: {} as Record<string, { fields: Record<string, unknown>; submitSignal: number }>,
  redoStack: [],
}

/**
 * ZUSTAND STORE CREATION
 * With Immer middleware for immutable updates
 * With DevTools for debugging
 */
export const useCoPilotAgentStore = create<CoPilotAgentState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // ── Message Actions ──
      addMessage: (message: Message) =>
        set((state) => {
          state.messages.push(message)
        }),

      clearMessages: () =>
        set((state) => {
          state.messages = []
        }),

      updateMessage: (id: string, updates: Partial<Message>) =>
        set((state) => {
          const message = state.messages.find((m) => m.id === id)
          if (message) {
            Object.assign(message, updates)
          }
        }),

      // ── Navigation Actions ──
      setCurrentRoute: (route: string) =>
        set((state) => {
          state.currentRoute = route
          state.targetRoute = null
          state.navigationInProgress = false
        }),

      setTargetRoute: (route: RouteType | null) =>
        set((state) => {
          state.targetRoute = route
          if (route) {
            state.navigationInProgress = true
          }
        }),

      setNavigationInProgress: (inProgress: boolean) =>
        set((state) => {
          state.navigationInProgress = inProgress
        }),

      // ── Filter Actions ──
      setPendingFilters: (module: string, filters: Record<string, unknown>) =>
        set((state) => {
          state.pendingFilters[module] = filters
        }),

      applyFilters: (module: string) =>
        set((state) => {
          const pending = state.pendingFilters[module]
          if (pending) {
            const current = state.appliedFilters[module] || {}

            // Save to history before applying
            state.filterHistoryStack.push({
              module,
              filters: current,
              timestamp: Date.now(),
            })

            // Apply new filters
            state.appliedFilters[module] = { ...current, ...pending }
            delete state.pendingFilters[module]
          }
        }),

      clearFilters: (module: string) =>
        set((state) => {
          const current = state.appliedFilters[module] || {}

          // Save to history
          if (Object.keys(current).length > 0) {
            state.filterHistoryStack.push({
              module,
              filters: current,
              timestamp: Date.now(),
            })
          }

          // Clear
          state.appliedFilters[module] = {}
          delete state.pendingFilters[module]
        }),

      clearAllFilters: () =>
        set((state) => {
          state.appliedFilters = {}
          state.pendingFilters = {}
        }),

      undoFilters: (module: string): boolean => {
        const state = get()
        const history = state.filterHistoryStack

        // Find last entry for this module (search from end)
        let lastIndex = -1
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].module === module) { lastIndex = i; break }
        }
        if (lastIndex === -1) return false

        const { filters } = history[lastIndex]

        set((s) => {
          // Push current state to redo stack before undoing
          const current = s.appliedFilters[module] || {}
          s.redoStack.push({ module, filters: current, timestamp: Date.now() })
          s.appliedFilters[module] = filters
          delete s.pendingFilters[module]
          s.filterHistoryStack.splice(lastIndex, 1)
        })

        return true
      },

      // ── Execution Actions ──
      addExecutionStep: (step: ExecutionStep) =>
        set((state) => {
          state.executionQueue.push(step)
          if (!state.currentExecutionStep) {
            state.currentExecutionStep = step
          }
        }),

      updateExecutionStep: (stepId: string, updates: Partial<ExecutionStep>) =>
        set((state) => {
          const step = state.executionQueue.find((s) => s.id === stepId)
          if (step) {
            Object.assign(step, updates)
          }
          if (state.currentExecutionStep?.id === stepId) {
            Object.assign(state.currentExecutionStep, updates)
          }
        }),

      addExecutionResult: (result: ExecutionResult) =>
        set((state) => {
          state.executionResults.push(result)
        }),

      clearExecutionHistory: () =>
        set((state) => {
          state.executionQueue = []
          state.currentExecutionStep = null
          state.executionResults = []
        }),

      // ── Highlight Actions ──
      setHighlight: (elementId: string | null) =>
        set((state) => {
          state.highlightedElement = elementId
        }),

      // ── Workflow Plan Actions ──
      setWorkflowPlan: (plan: WorkflowPlan) =>
        set((state) => {
          state.workflowPlan = plan
        }),

      advanceWorkflowStep: () =>
        set((state) => {
          if (!state.workflowPlan) return
          const { steps, currentStepIndex } = state.workflowPlan
          // Mark current step success
          if (steps[currentStepIndex]) {
            steps[currentStepIndex].status = 'success'
          }
          const nextIndex = currentStepIndex + 1
          if (nextIndex >= steps.length) {
            state.workflowPlan.status = 'complete'
          } else {
            state.workflowPlan.currentStepIndex = nextIndex
            steps[nextIndex].status = 'running'
            state.workflowPlan.status = 'running'
          }
        }),

      failWorkflowStep: (error: string) =>
        set((state) => {
          if (!state.workflowPlan) return
          const step = state.workflowPlan.steps[state.workflowPlan.currentStepIndex]
          if (step) {
            step.status = 'error'
            step.result = error
          }
          state.workflowPlan.status = 'error'
        }),

      clearWorkflowPlan: () =>
        set((state) => {
          state.workflowPlan = null
        }),

      // ── Copilot Form Actions ──
      setCopilotForm: (module: string, fields: Record<string, unknown>, autoSubmit = true) =>
        set((state) => {
          const prev = state.copilotForms[module]
          state.copilotForms[module] = {
            fields,
            // Increment submitSignal each time agent wants a submit — page watches this value
            submitSignal: autoSubmit ? ((prev?.submitSignal ?? 0) + 1) : (prev?.submitSignal ?? 0),
          }
        }),

      clearCopilotForm: (module: string) =>
        set((state) => {
          delete state.copilotForms[module]
        }),

      // ── Redo Actions ──
      pushRedo: (snapshot: FilterSnapshot) =>
        set((state) => {
          state.redoStack.push(snapshot)
          // Cap redo stack at 20 entries
          if (state.redoStack.length > 20) {
            state.redoStack.shift()
          }
        }),

      redoFilters: (module: string): boolean => {
        const state = get()
        const lastIndex = [...state.redoStack].reverse().findIndex((h) => h.module === module)
        if (lastIndex === -1) return false
        const actualIndex = state.redoStack.length - 1 - lastIndex
        const { filters } = state.redoStack[actualIndex]

        set((s) => {
          // Save current to undo history before redo
          const current = s.appliedFilters[module] || {}
          s.filterHistoryStack.push({ module, filters: current, timestamp: Date.now() })
          s.appliedFilters[module] = filters
          s.redoStack.splice(actualIndex, 1)
        })
        return true
      },

      // ── Session Actions ──
      startSession: (sessionId: string) =>
        set((state) => {
          state.activeSessionId = sessionId
          state.messages = []
          state.executionResults = []
        }),

      endSession: () =>
        set((state) => {
          state.activeSessionId = null
        }),

      // ── Reset ──
      reset: () => set(initialState),
    })),
    {
      name: 'CoPilotAgentStore',
      enabled: true,
    }
  )
)

/**
 * HOOK EXPORTS
 * Convenience hooks for common store selectors
 */
export const useCoPilotMessages = () =>
  useCoPilotAgentStore((state) => ({
    messages: state.messages,
    isLoading: state.isLoading,
    addMessage: state.addMessage,
  }))

export const useCoPilotNavigation = () =>
  useCoPilotAgentStore((state) => ({
    currentRoute: state.currentRoute,
    targetRoute: state.targetRoute,
    navigationInProgress: state.navigationInProgress,
    setCurrentRoute: state.setCurrentRoute,
    setTargetRoute: state.setTargetRoute,
  }))

export const useCoPilotFilters = () =>
  useCoPilotAgentStore((state) => ({
    appliedFilters: state.appliedFilters,
    pendingFilters: state.pendingFilters,
    applyFilters: state.applyFilters,
    clearFilters: state.clearFilters,
    undoFilters: state.undoFilters,
  }))

export const useCoPilotExecution = () =>
  useCoPilotAgentStore((state) => ({
    executionQueue: state.executionQueue,
    executionResults: state.executionResults,
    isLoading: state.isLoading,
    addExecutionResult: state.addExecutionResult,
  }))
