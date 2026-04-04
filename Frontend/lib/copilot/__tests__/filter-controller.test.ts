/**
 * FILTER CONTROLLER TESTS
 * Tests inject, undo, clear, validate across modules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', () => ({
  devtools: (fn: unknown) => fn,
  immer: (fn: unknown) => fn,
}))

import { useCoPilotAgentStore } from '../agent-store'
import { FilterController } from '../filter-controller'

let controller: FilterController

beforeEach(() => {
  useCoPilotAgentStore.getState().reset()
  controller = new FilterController()
})

describe('injectFilters', () => {
  it('applies filters for a known module', async () => {
    // company_size is required by ProspectsSchema
    const result = await controller.injectFilters('prospects', { job_title: 'CTO', company_size: '50-500' })
    expect(result.success).toBe(true)
    expect(result.appliedCount).toBeGreaterThan(0)
    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toMatchObject({ job_title: 'CTO' })
  })

  it('returns error for unknown module', async () => {
    const result = await controller.injectFilters('nonexistent_module', { foo: 'bar' })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Unknown module')
  })

  it('saves current state to history before applying', async () => {
    await controller.injectFilters('prospects', { job_title: 'CEO', company_size: '10-50' })
    await controller.injectFilters('prospects', { job_title: 'VP', company_size: '50-500' })
    expect(useCoPilotAgentStore.getState().filterHistoryStack.length).toBeGreaterThanOrEqual(1)
  })
})

describe('clearFilters', () => {
  it('clears applied filters for a module', async () => {
    await controller.injectFilters('prospects', { job_title: 'VP' })
    const result = controller.clearFilters('prospects')
    expect(result.success).toBe(true)
    expect(useCoPilotAgentStore.getState().appliedFilters['prospects']).toEqual({})
  })

  it('saves to history only when there was something to clear', async () => {
    // No filters applied → clear should not add to history
    const before = useCoPilotAgentStore.getState().filterHistoryStack.length
    controller.clearFilters('prospects')
    const after = useCoPilotAgentStore.getState().filterHistoryStack.length
    expect(after).toBe(before)
  })
})

describe('undo', () => {
  it('restores previous filter state', async () => {
    await controller.injectFilters('prospects', { job_title: 'CEO', company_size: '10-50' })
    await controller.injectFilters('prospects', { job_title: 'VP', company_size: '50-500' })
    const result = controller.undo('prospects')
    expect(result.success).toBe(true)
    // restored to after first inject
    expect(controller.getFilters('prospects')).toMatchObject({ job_title: 'CEO', company_size: '10-50' })
  })

  it('returns failure when no history', () => {
    const result = controller.undo('companies')
    expect(result.success).toBe(false)
    expect(result.message).toContain('No filter history')
  })
})

describe('getFilters', () => {
  it('returns empty object when no filters applied', () => {
    expect(controller.getFilters('intents')).toEqual({})
  })

  it('returns applied filters for module', async () => {
    // intents requires topic
    await controller.injectFilters('intents', { topic: 'AI software' })
    expect(controller.getFilters('intents')).toMatchObject({ topic: 'AI software' })
  })
})

describe('validateOnly', () => {
  it('returns success for valid module + filters', () => {
    // company_size is required by ProspectsSchema
    const result = controller.validateOnly('prospects', { job_title: 'VP', company_size: '50-500' })
    expect(result.success).toBe(true)
  })

  it('returns error for unknown module', () => {
    const result = controller.validateOnly('mystery_module', { x: 1 })
    expect(result.success).toBe(false)
  })
})
