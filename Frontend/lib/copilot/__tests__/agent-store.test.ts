/**
 * AGENT STORE TESTS
 * Tests all state mutations in useCoPilotAgentStore:
 * messages, navigation, filters, undo/redo, workflow plan, execution
 */

import { describe, it, expect, beforeEach } from 'vitest'

// We need to mock Zustand's devtools/immer in a Node environment
vi.mock('zustand/middleware', () => ({
  devtools: (fn: unknown) => fn,
  immer: (fn: unknown) => fn,
}))

import { useCoPilotAgentStore, WorkflowPlan, WorkflowStep } from '../agent-store'

function getStore() {
  return useCoPilotAgentStore.getState()
}

beforeEach(() => {
  useCoPilotAgentStore.getState().reset()
})

// ── Messages ───────────────────────────────────────────────────────────

describe('messages', () => {
  it('adds a message', () => {
    const store = getStore()
    store.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: 0 })
    expect(useCoPilotAgentStore.getState().messages).toHaveLength(1)
    expect(useCoPilotAgentStore.getState().messages[0].content).toBe('hello')
  })

  it('clears messages', () => {
    const store = getStore()
    store.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: 0 })
    store.clearMessages()
    expect(useCoPilotAgentStore.getState().messages).toHaveLength(0)
  })

  it('updates a message by id', () => {
    const store = getStore()
    store.addMessage({ id: 'abc', role: 'assistant', content: '', timestamp: 0 })
    store.updateMessage('abc', { content: 'updated text' })
    expect(useCoPilotAgentStore.getState().messages[0].content).toBe('updated text')
  })

  it('no-ops updateMessage when id not found', () => {
    const store = getStore()
    store.addMessage({ id: 'xyz', role: 'user', content: 'hi', timestamp: 0 })
    store.updateMessage('nonexistent', { content: 'oops' })
    expect(useCoPilotAgentStore.getState().messages[0].content).toBe('hi')
  })
})

// ── Navigation ─────────────────────────────────────────────────────────

describe('navigation', () => {
  it('sets current route', () => {
    getStore().setCurrentRoute('/leads/prospects')
    expect(useCoPilotAgentStore.getState().currentRoute).toBe('/leads/prospects')
  })

  it('sets target route and marks navigation in progress', () => {
    getStore().setTargetRoute('/campaigns')
    const state = useCoPilotAgentStore.getState()
    expect(state.targetRoute).toBe('/campaigns')
    expect(state.navigationInProgress).toBe(true)
  })

  it('setCurrentRoute clears targetRoute and navigationInProgress', () => {
    const store = getStore()
    store.setTargetRoute('/campaigns')
    store.setCurrentRoute('/campaigns')
    const state = useCoPilotAgentStore.getState()
    expect(state.targetRoute).toBeNull()
    expect(state.navigationInProgress).toBe(false)
  })
})

// ── Filters ────────────────────────────────────────────────────────────

describe('filters', () => {
  it('setPendingFilters stores pending state', () => {
    getStore().setPendingFilters('prospects', { job_title: 'VP' })
    expect(useCoPilotAgentStore.getState().pendingFilters['prospects']).toEqual({ job_title: 'VP' })
  })

  it('applyFilters merges pending into applied and pushes history', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')

    const state = useCoPilotAgentStore.getState()
    expect(state.appliedFilters['prospects']).toEqual({ job_title: 'VP' })
    expect(state.pendingFilters['prospects']).toBeUndefined()
    expect(state.filterHistoryStack).toHaveLength(1)
  })

  it('clearFilters removes applied filters and saves history', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')
    store.clearFilters('prospects')

    const state = useCoPilotAgentStore.getState()
    expect(state.appliedFilters['prospects']).toEqual({})
    expect(state.filterHistoryStack).toHaveLength(2)
  })

  it('clearAllFilters wipes everything', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')
    store.setPendingFilters('companies', { industry: 'fintech' })
    store.applyFilters('companies')
    store.clearAllFilters()

    const state = useCoPilotAgentStore.getState()
    expect(state.appliedFilters).toEqual({})
    expect(state.pendingFilters).toEqual({})
  })
})

// ── Undo / Redo ────────────────────────────────────────────────────────

describe('undo / redo', () => {
  it('undoFilters restores previous filter state', () => {
    const store = getStore()
    // Apply initial filters
    store.setPendingFilters('prospects', { job_title: 'CEO' })
    store.applyFilters('prospects')
    // Apply second set
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')

    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toEqual({ job_title: 'VP' })

    store.undoFilters('prospects')

    // Should restore to after first apply (merged: CEO)
    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toEqual({ job_title: 'CEO' })
  })

  it('undoFilters returns false when no history for module', () => {
    const result = getStore().undoFilters('companies')
    expect(result).toBe(false)
  })

  it('undoFilters pushes to redoStack', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')
    store.undoFilters('prospects')

    expect(useCoPilotAgentStore.getState().redoStack).toHaveLength(1)
    expect(useCoPilotAgentStore.getState().redoStack[0].module).toBe('prospects')
  })

  it('redoFilters restores the undone state', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.applyFilters('prospects')
    store.undoFilters('prospects')
    store.redoFilters('prospects')

    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toEqual({ job_title: 'VP' })
  })

  it('redoFilters returns false when redo stack is empty for module', () => {
    const result = getStore().redoFilters('prospects')
    expect(result).toBe(false)
  })
})

// ── Workflow Plan ──────────────────────────────────────────────────────

function makePlan(): WorkflowPlan {
  return {
    id: 'wf-1',
    name: 'Test Plan',
    steps: [
      { id: 's1', type: 'navigate', description: 'Go to prospects', status: 'running' },
      { id: 's2', type: 'search', description: 'Search prospects', status: 'pending' },
    ],
    currentStepIndex: 0,
    status: 'running',
    createdAt: Date.now(),
  }
}

describe('workflow plan', () => {
  it('sets a workflow plan', () => {
    getStore().setWorkflowPlan(makePlan())
    expect(useCoPilotAgentStore.getState().workflowPlan?.name).toBe('Test Plan')
  })

  it('advanceWorkflowStep marks current step success and moves to next', () => {
    const store = getStore()
    store.setWorkflowPlan(makePlan())
    store.advanceWorkflowStep()

    const state = useCoPilotAgentStore.getState()
    expect(state.workflowPlan?.steps[0].status).toBe('success')
    expect(state.workflowPlan?.currentStepIndex).toBe(1)
    expect(state.workflowPlan?.steps[1].status).toBe('running')
  })

  it('advanceWorkflowStep marks plan complete after last step', () => {
    const store = getStore()
    store.setWorkflowPlan(makePlan())
    store.advanceWorkflowStep() // finish step 0 → step 1
    store.advanceWorkflowStep() // finish step 1 → complete

    const state = useCoPilotAgentStore.getState()
    expect(state.workflowPlan?.status).toBe('complete')
    expect(state.workflowPlan?.steps[1].status).toBe('success')
  })

  it('failWorkflowStep marks plan and current step as error', () => {
    const store = getStore()
    store.setWorkflowPlan(makePlan())
    store.failWorkflowStep('API timeout')

    const state = useCoPilotAgentStore.getState()
    expect(state.workflowPlan?.status).toBe('error')
    expect(state.workflowPlan?.steps[0].status).toBe('error')
    expect(state.workflowPlan?.steps[0].result).toBe('API timeout')
  })

  it('clearWorkflowPlan removes the plan', () => {
    const store = getStore()
    store.setWorkflowPlan(makePlan())
    store.clearWorkflowPlan()
    expect(useCoPilotAgentStore.getState().workflowPlan).toBeNull()
  })
})

// ── Execution ──────────────────────────────────────────────────────────

describe('execution', () => {
  it('adds an execution result', () => {
    getStore().addExecutionResult({
      module: 'prospects',
      status: 'success',
      resultCount: 47,
      timestamp: Date.now(),
    })
    expect(useCoPilotAgentStore.getState().executionResults).toHaveLength(1)
    expect(useCoPilotAgentStore.getState().executionResults[0].resultCount).toBe(47)
  })

  it('clearExecutionHistory wipes results and queue', () => {
    const store = getStore()
    store.addExecutionResult({ module: 'prospects', status: 'success', timestamp: Date.now() })
    store.clearExecutionHistory()
    expect(useCoPilotAgentStore.getState().executionResults).toHaveLength(0)
    expect(useCoPilotAgentStore.getState().executionQueue).toHaveLength(0)
    expect(useCoPilotAgentStore.getState().currentExecutionStep).toBeNull()
  })
})

// ── Highlight ──────────────────────────────────────────────────────────

describe('highlight', () => {
  it('sets highlighted element', () => {
    getStore().setHighlight('prospects-filters-panel')
    expect(useCoPilotAgentStore.getState().highlightedElement).toBe('prospects-filters-panel')
  })

  it('clears highlight', () => {
    const store = getStore()
    store.setHighlight('foo')
    store.setHighlight(null)
    expect(useCoPilotAgentStore.getState().highlightedElement).toBeNull()
  })
})

// ── Reset ──────────────────────────────────────────────────────────────

describe('reset', () => {
  it('resets all state to initial values', () => {
    const store = getStore()
    store.addMessage({ id: '1', role: 'user', content: 'hi', timestamp: 0 })
    store.setCurrentRoute('/campaigns')
    store.setPendingFilters('prospects', { job_title: 'VP' })
    store.setWorkflowPlan(makePlan())
    store.reset()

    const state = useCoPilotAgentStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.currentRoute).toBe('/')
    expect(state.pendingFilters).toEqual({})
    expect(state.workflowPlan).toBeNull()
  })
})
