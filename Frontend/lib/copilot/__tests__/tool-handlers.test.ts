/**
 * TOOL HANDLER TESTS
 * Tests navigate_to, set_filters, plan_workflow, undo_last_action
 * Uses mocked navigation router and API clients.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  devtools: (fn: unknown) => fn,
  immer: (fn: unknown) => fn,
}))

// Mock the router (navigation-controller uses a module-level ref)
vi.mock('../navigation-controller', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../navigation-controller')>()
  return {
    ...actual,
    NavigationController: class {
      async navigateTo(page: string) {
        // Directly update the store
        const { useCoPilotAgentStore } = await import('../agent-store')
        useCoPilotAgentStore.getState().setCurrentRoute(page)
        return true
      }
    },
    initNavigationRouter: vi.fn(),
    isValidRoute: actual.isValidRoute,
    ROUTE_NAMES: actual.ROUTE_NAMES,
  }
})

// Mock search controller so execute_search doesn't hit real APIs
vi.mock('../search-controller', () => ({
  getSearchController: () => ({
    executeSearch: vi.fn(async (module: string) => ({
      module,
      status: 'success',
      resultCount: 12,
      results: [],
      summary: `Found 12 results in ${module}.`,
      timestamp: Date.now(),
    })),
  }),
}))

// Mock campaigns API
vi.mock('@/lib/api/campaigns', () => ({
  campaignsApi: {
    createCampaign: vi.fn(async ({ name }: { name: string }) => ({
      id: 'campaign-123',
      name,
      status: 'draft',
      leadsCount: 0,
    })),
    getCampaigns: vi.fn(async () => [
      { id: 'c1', name: 'Existing Campaign', status: 'active', leadsCount: 10 },
    ]),
  },
}))

import { useCoPilotAgentStore } from '../agent-store'
import { ToolHandlers } from '../tool-handlers'

let handlers: ToolHandlers

beforeEach(() => {
  useCoPilotAgentStore.getState().reset()
  handlers = new ToolHandlers()
})

// ── navigate_to ────────────────────────────────────────────────────────

describe('navigate_to', () => {
  it('navigates to a valid route', async () => {
    const result = await handlers.handleTool('navigate_to', { page: '/leads/prospects' })
    expect(result.status).toBe('success')
    expect(useCoPilotAgentStore.getState().currentRoute).toBe('/leads/prospects')
  })

  it('returns error for invalid route', async () => {
    const result = await handlers.handleTool('navigate_to', { page: '/invalid/route' })
    expect(result.status).toBe('error')
    expect(result.message).toContain('Invalid page')
  })

  it('returns error when page param is missing', async () => {
    const result = await handlers.handleTool('navigate_to', {})
    expect(result.status).toBe('error')
  })
})

// ── set_filters ────────────────────────────────────────────────────────

describe('set_filters', () => {
  it('applies valid filters to a module', async () => {
    const result = await handlers.handleTool('set_filters', {
      module: 'prospects',
      // company_size is required by ProspectsSchema
      filters: { job_title: 'VP of Sales', industry: 'fintech', company_size: '50-500' },
    })
    expect(result.status).toBe('success')
    const applied = useCoPilotAgentStore.getState().appliedFilters['prospects']
    expect(applied).toMatchObject({ job_title: 'VP of Sales' })
  })

  it('returns error for unknown module', async () => {
    const result = await handlers.handleTool('set_filters', {
      module: 'unknown_module',
      filters: { x: 1 },
    })
    expect(result.status).toBe('error')
  })

  it('returns error when filters object is empty', async () => {
    const result = await handlers.handleTool('set_filters', {
      module: 'prospects',
      filters: {},
    })
    expect(result.status).toBe('error')
    expect(result.message).toContain('At least one filter')
  })
})

// ── execute_search ─────────────────────────────────────────────────────

describe('execute_search', () => {
  it('executes search for prospects', async () => {
    // Must include company_size (required by ProspectsSchema)
    await handlers.handleTool('set_filters', {
      module: 'prospects',
      filters: { job_title: 'CEO', company_size: '50-500' },
    })
    const result = await handlers.handleTool('execute_search', { module: 'prospects' })
    expect(result.status).toBe('success')
    expect(result.data).toMatchObject({ module: 'prospects', resultCount: 12 })
  })

  it('returns error for unknown module', async () => {
    const result = await handlers.handleTool('execute_search', { module: 'bogus' })
    expect(result.status).toBe('error')
  })
})

// ── plan_workflow ──────────────────────────────────────────────────────

describe('plan_workflow', () => {
  it('creates a workflow plan in the store', async () => {
    const result = await handlers.handleTool('plan_workflow', {
      name: 'Q2 Outreach',
      steps: [
        { type: 'navigate', description: 'Go to Prospects' },
        { type: 'search', description: 'Find VPs' },
        { type: 'create_campaign', description: 'Create campaign' },
      ],
    })

    expect(result.status).toBe('success')
    const plan = useCoPilotAgentStore.getState().workflowPlan
    expect(plan?.name).toBe('Q2 Outreach')
    expect(plan?.steps).toHaveLength(3)
    expect(plan?.steps[0].status).toBe('running')
    expect(plan?.steps[1].status).toBe('pending')
  })

  it('returns error if name is missing', async () => {
    const result = await handlers.handleTool('plan_workflow', { steps: [] })
    expect(result.status).toBe('error')
  })

  it('returns error if steps is empty', async () => {
    const result = await handlers.handleTool('plan_workflow', { name: 'Empty', steps: [] })
    expect(result.status).toBe('error')
  })
})

// ── undo_last_action ───────────────────────────────────────────────────

describe('undo_last_action', () => {
  it('undoes last filter change for the module', async () => {
    // Must include company_size (required by ProspectsSchema)
    await handlers.handleTool('set_filters', {
      module: 'prospects',
      filters: { job_title: 'CEO', company_size: '10-50' },
    })
    await handlers.handleTool('set_filters', {
      module: 'prospects',
      filters: { job_title: 'VP', company_size: '50-500' },
    })

    const result = await handlers.handleTool('undo_last_action', { module: 'prospects' })
    expect(result.status).toBe('success')
    // Restored to CEO + 10-50 state
    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toMatchObject({
      job_title: 'CEO',
      company_size: '10-50',
    })
  })

  it('returns error when no history for module', async () => {
    const result = await handlers.handleTool('undo_last_action', { module: 'intents' })
    expect(result.status).toBe('error')
    expect(result.message).toContain('nothing to undo')
  })

  it('returns error when module param is missing', async () => {
    const result = await handlers.handleTool('undo_last_action', {})
    expect(result.status).toBe('error')
  })
})

// ── workflow plan auto-advance ─────────────────────────────────────────

describe('workflow plan auto-advance', () => {
  it('advances workflow step after successful navigate_to', async () => {
    // Set up plan with navigate as first step
    await handlers.handleTool('plan_workflow', {
      name: 'Test',
      steps: [
        { type: 'navigate', description: 'Navigate' },
        { type: 'search', description: 'Search' },
      ],
    })

    expect(useCoPilotAgentStore.getState().workflowPlan?.currentStepIndex).toBe(0)

    await handlers.handleTool('navigate_to', { page: '/leads/prospects' })

    expect(useCoPilotAgentStore.getState().workflowPlan?.currentStepIndex).toBe(1)
    expect(useCoPilotAgentStore.getState().workflowPlan?.steps[0].status).toBe('success')
  })

  it('marks plan complete after last step succeeds', async () => {
    await handlers.handleTool('plan_workflow', {
      name: 'Single Step',
      steps: [{ type: 'navigate', description: 'Nav' }],
    })

    await handlers.handleTool('navigate_to', { page: '/campaigns' })

    expect(useCoPilotAgentStore.getState().workflowPlan?.status).toBe('complete')
  })
})

// ── list_campaigns ─────────────────────────────────────────────────────

describe('list_campaigns', () => {
  it('returns campaigns list', async () => {
    const result = await handlers.handleTool('list_campaigns', {})
    expect(result.status).toBe('success')
    expect((result.data as { campaigns: unknown[] }).campaigns).toHaveLength(1)
  })
})

// ── create_campaign ────────────────────────────────────────────────────

describe('create_campaign', () => {
  it('creates a campaign successfully', async () => {
    const result = await handlers.handleTool('create_campaign', {
      name: 'My Campaign',
      segment_ids: ['lead-1', 'lead-2'],
    })
    expect(result.status).toBe('success')
    expect(result.message).toContain('My Campaign')
  })

  it('returns error when name is missing', async () => {
    const result = await handlers.handleTool('create_campaign', { segment_ids: [] })
    expect(result.status).toBe('error')
  })
})

// ── unknown tool ───────────────────────────────────────────────────────

describe('unknown tool', () => {
  it('returns error for unrecognised tool name', async () => {
    const result = await handlers.handleTool('does_not_exist', {})
    expect(result.status).toBe('error')
    expect(result.message).toContain('Unknown tool')
  })
})
