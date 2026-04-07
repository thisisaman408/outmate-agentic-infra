/**
 * CONTEXT INJECTION TESTS
 * Tests buildContextSummary() in ClaudeIntegration — the live session context
 * appended to the system prompt before each API call.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock zustand middleware so the store works in Node
vi.mock('zustand/middleware', () => ({
  devtools: (fn: unknown) => fn,
  immer: (fn: unknown) => fn,
}))

// Mock tool-handlers so ClaudeIntegration can be imported
vi.mock('../tool-handlers', () => ({
  getToolHandlers: () => ({
    handleTool: vi.fn(),
    getExecutionLog: vi.fn(() => []),
  }),
}))

import { useCoPilotAgentStore } from '../agent-store'
import { ClaudeIntegration } from '../claude-integration'

function getStore() {
  return useCoPilotAgentStore.getState()
}

beforeEach(() => {
  useCoPilotAgentStore.getState().reset()
})

// Access private method via type cast for testing
function buildContext(integration: ClaudeIntegration): string {
  return (integration as unknown as { buildContextSummary(): string }).buildContextSummary()
}

describe('buildContextSummary', () => {
  it('includes current route', () => {
    getStore().setCurrentRoute('/leads/prospects')
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('/leads/prospects')
  })

  it('shows "none" when no filters applied', () => {
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('Active filters: none')
  })

  it('lists applied filters per module', () => {
    const store = getStore()
    store.setPendingFilters('prospects', { job_title: 'VP', industry: 'fintech' })
    store.applyFilters('prospects')

    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('prospects:')
    expect(ctx).toContain('job_title')
    expect(ctx).toContain('fintech')
  })

  it('shows "none yet" when no search results', () => {
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('none yet')
  })

  it('includes last search result count', () => {
    getStore().addExecutionResult({
      module: 'prospects',
      status: 'success',
      resultCount: 47,
      timestamp: Date.now(),
    })
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('prospects: 47 results')
  })

  it('shows error result status', () => {
    getStore().addExecutionResult({
      module: 'intents',
      status: 'error',
      error: 'timeout',
      timestamp: Date.now(),
    })
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('intents: search failed')
  })

  it('caps recent results at last 3', () => {
    const store = getStore()
    for (let i = 0; i < 5; i++) {
      store.addExecutionResult({
        module: `module${i}`,
        status: 'success',
        resultCount: i,
        timestamp: Date.now() + i,
      })
    }
    const ctx = buildContext(new ClaudeIntegration())
    // Should only show last 3: module2, module3, module4
    expect(ctx).toContain('module2')
    expect(ctx).toContain('module3')
    expect(ctx).toContain('module4')
    expect(ctx).not.toContain('module0')
    expect(ctx).not.toContain('module1')
  })

  it('includes active workflow plan summary', () => {
    getStore().setWorkflowPlan({
      id: 'wf1',
      name: 'Q2 Outreach',
      steps: [
        { id: 's1', type: 'navigate', description: 'Go to prospects', status: 'running' },
        { id: 's2', type: 'search', description: 'Search', status: 'pending' },
      ],
      currentStepIndex: 0,
      status: 'running',
      createdAt: Date.now(),
    })
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).toContain('Q2 Outreach')
    expect(ctx).toContain('step 1/2')
  })

  it('does not include workflow info when plan is complete', () => {
    getStore().setWorkflowPlan({
      id: 'wf1',
      name: 'Done Plan',
      steps: [{ id: 's1', type: 'navigate', description: 'nav', status: 'success' }],
      currentStepIndex: 0,
      status: 'complete',
      createdAt: Date.now(),
    })
    const ctx = buildContext(new ClaudeIntegration())
    expect(ctx).not.toContain('Done Plan')
  })
})
