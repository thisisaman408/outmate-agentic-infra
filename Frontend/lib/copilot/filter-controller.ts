/**
 * FILTER INJECTION CONTROLLER
 * Handles validating, injecting, and managing filter state
 * Used by Claude to set search criteria on behalf of the user
 */

'use client'

import { useCoPilotAgentStore, FilterSnapshot } from './agent-store'
import { MODULE_SCHEMAS, validateFilters, getModuleSchema } from './module-schemas'

export interface FilterInjectionResult {
  success: boolean
  message: string
  appliedCount?: number
  errors?: string[]
}

export class FilterController {
  private store: typeof useCoPilotAgentStore

  constructor() {
    this.store = useCoPilotAgentStore
  }

  /**
   * Inject filters for a specific module
   * Validates against schema, saves history, updates store, highlights UI
   */
  async injectFilters(
    module: string,
    filters: Record<string, unknown>
  ): Promise<FilterInjectionResult> {
    try {
      // Validate module exists
      const schema = getModuleSchema(module)
      if (!schema) {
        return {
          success: false,
          message: `Unknown module: ${module}`,
          errors: [`Module "${module}" is not recognized`],
        }
      }

      // Validate filters against schema
      const validated = validateFilters(module, filters)
      if (!validated) {
        return {
          success: false,
          message: `Filter validation failed for ${module}`,
          errors: ['Could not validate filters against module schema'],
        }
      }

      // Get current filters for history
      const currentFilters = this.store.getState().appliedFilters[module] || {}

      // Save to history for undo
      this.store.setState((state) => {
        state.filterHistoryStack.push({
          module,
          filters: currentFilters,
          timestamp: Date.now(),
        })
      })

      // Apply new filters
      this.store.setState((state) => {
        state.appliedFilters[module] = { ...currentFilters, ...validated }
        delete state.pendingFilters[module]
      })

      // Highlight the filter panel
      this.highlightFilterPanel(module)

      return {
        success: true,
        message: `Applied ${Object.keys(validated).length} filters to ${module}`,
        appliedCount: Object.keys(validated).length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Filter injection failed: ${errorMessage}`,
        errors: [errorMessage],
      }
    }
  }

  /**
   * Set pending filters (not yet applied)
   * Allows step-by-step parameter collection
   */
  setPendingFilters(
    module: string,
    filters: Record<string, unknown>
  ): FilterInjectionResult {
    try {
      const schema = getModuleSchema(module)
      if (!schema) {
        return {
          success: false,
          message: `Unknown module: ${module}`,
        }
      }

      this.store.setState((state) => {
        state.pendingFilters[module] = filters
      })

      return {
        success: true,
        message: `Set ${Object.keys(filters).length} pending filters for ${module}`,
        appliedCount: Object.keys(filters).length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Setting pending filters failed: ${errorMessage}`,
        errors: [errorMessage],
      }
    }
  }

  /**
   * Apply pending filters to a module
   */
  applyPendingFilters(module: string): FilterInjectionResult {
    try {
      const pending = this.store.getState().pendingFilters[module]
      if (!pending || Object.keys(pending).length === 0) {
        return {
          success: false,
          message: `No pending filters for ${module}`,
        }
      }

      // Inject the pending filters
      return this.injectFilters(module, pending)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Applying pending filters failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Clear all filters for a module
   */
  clearFilters(module: string): FilterInjectionResult {
    try {
      const current = this.store.getState().appliedFilters[module]

      // Only save to history if there are filters to clear
      if (current && Object.keys(current).length > 0) {
        this.store.setState((state) => {
          state.filterHistoryStack.push({
            module,
            filters: current,
            timestamp: Date.now(),
          })
        })
      }

      this.store.setState((state) => {
        state.appliedFilters[module] = {}
        delete state.pendingFilters[module]
      })

      return {
        success: true,
        message: `Cleared all filters for ${module}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Clearing filters failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Clear all filters across all modules
   */
  clearAllFilters(): FilterInjectionResult {
    try {
      this.store.setState((state) => {
        state.appliedFilters = {}
        state.pendingFilters = {}
      })

      return {
        success: true,
        message: 'Cleared all filters across all modules',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Clearing all filters failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Undo the last filter change for a module
   */
  undo(module: string): FilterInjectionResult {
    try {
      const state = this.store.getState()
      const history = state.filterHistoryStack

      // Find the MOST RECENT entry for this module (search from end)
      let lastIndex = -1
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].module === module) { lastIndex = i; break }
      }
      if (lastIndex === -1) {
        return {
          success: false,
          message: `No filter history for ${module}`,
        }
      }

      const { filters } = history[lastIndex]

      this.store.setState((s) => {
        s.appliedFilters[module] = filters
        s.pendingFilters[module] = undefined
        s.filterHistoryStack.splice(lastIndex, 1)
      })

      this.highlightFilterPanel(module)

      return {
        success: true,
        message: `Undid filter change for ${module}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Undo failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Get current filters for a module
   */
  getFilters(module: string): Record<string, unknown> {
    return this.store.getState().appliedFilters[module] || {}
  }

  /**
   * Get pending filters for a module
   */
  getPendingFilters(module: string): Record<string, unknown> {
    return this.store.getState().pendingFilters[module] || {}
  }

  /**
   * Get filter history for a module
   */
  getHistory(module?: string): FilterSnapshot[] {
    const history = this.store.getState().filterHistoryStack
    if (module) {
      return history.filter((h) => h.module === module)
    }
    return history
  }

  /**
   * Highlight filter panel in UI (visual feedback)
   * Auto-removes highlight after 2.5 seconds
   */
  private highlightFilterPanel(module: string): void {
    const elementId = `${module}-filters-panel`

    this.store.setState((state) => {
      state.highlightedElement = elementId
    })

    // Auto-remove highlight after 2.5 seconds
    setTimeout(() => {
      this.store.setState((state) => {
        if (state.highlightedElement === elementId) {
          state.highlightedElement = null
        }
      })
    }, 2500)
  }

  /**
   * Validate filters without applying them
   */
  validateOnly(
    module: string,
    filters: Record<string, unknown>
  ): FilterInjectionResult {
    try {
      const schema = getModuleSchema(module)
      if (!schema) {
        return {
          success: false,
          message: `Unknown module: ${module}`,
        }
      }

      const validated = validateFilters(module, filters)
      if (!validated) {
        return {
          success: false,
          message: 'Validation failed',
        }
      }

      return {
        success: true,
        message: 'Validation passed',
        appliedCount: Object.keys(validated).length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        message: `Validation failed: ${errorMessage}`,
        errors: [errorMessage],
      }
    }
  }
}

/**
 * REACT HOOK FOR FILTER CONTROLLER
 */
export function useFilterController() {
  const controller = new FilterController()

  const {
    appliedFilters,
    pendingFilters,
    applyFilters,
    clearFilters,
  } = useCoPilotAgentStore((state) => ({
    appliedFilters: state.appliedFilters,
    pendingFilters: state.pendingFilters,
    applyFilters: state.applyFilters,
    clearFilters: state.clearFilters,
  }))

  return {
    controller,
    appliedFilters,
    pendingFilters,
    injectFilters: (module: string, filters: Record<string, unknown>) =>
      controller.injectFilters(module, filters),
    clearFilters: (module: string) => controller.clearFilters(module),
    undo: (module: string) => controller.undo(module),
    getFilters: (module: string) => controller.getFilters(module),
  }
}

/**
 * FILTER FIELD HELPER
 * Utility to get required/optional fields for a module
 */
export function getModuleFields(module: string) {
  const schema = getModuleSchema(module)
  if (!schema) {
    return null
  }

  return {
    required: schema.required,
    optional: schema.optional,
    defaults: schema.defaults,
    fields: schema.validation,
  }
}
