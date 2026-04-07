/**
 * NAVIGATION CONTROLLER
 * Handles client-side routing and state synchronization
 * Used by Claude to navigate to different modules programmatically
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCoPilotAgentStore, RouteType } from './agent-store'

export interface NavigationOptions {
  replace?: boolean
  timeout?: number
}

/**
 * Module-level router ref — set once from a hook via initNavigationRouter().
 * This avoids calling useRouter() inside class constructors, which violates
 * the Rules of Hooks when the singleton is created lazily.
 */
let _router: ReturnType<typeof useRouter> | null = null

export function initNavigationRouter(router: ReturnType<typeof useRouter>): void {
  _router = router
}

export class NavigationController {
  private store: typeof useCoPilotAgentStore

  constructor() {
    this.store = useCoPilotAgentStore
  }

  /**
   * Navigate to a specific route
   * Waits for route change to complete before resolving
   */
  async navigateTo(
    page: RouteType,
    options: NavigationOptions = {}
  ): Promise<boolean> {
    const { replace = false, timeout = 5000 } = options

    try {
      // Mark navigation in progress
      this.store.setState((state) => {
        state.targetRoute = page
        state.navigationInProgress = true
      })

      // Perform navigation
      if (!_router) {
        // Fallback: use window.location if router not yet initialized
        window.location.href = page
        this.store.setState((state) => {
          state.currentRoute = page
          state.targetRoute = null
          state.navigationInProgress = false
        })
        return true
      }
      if (replace) {
        _router.replace(page)
      } else {
        _router.push(page)
      }

      // Update store immediately — don't poll.
      // The component that mounts on the new route will update pathname via
      // useEffect in use-copilot-agent, but we can't wait for it here because
      // the current component may unmount during navigation.
      this.store.setState((state) => {
        state.currentRoute = page
        state.targetRoute = null
        state.navigationInProgress = false
      })

      return true
    } catch (error) {
      console.error(`Navigation failed to ${page}:`, error)

      this.store.setState((state) => {
        state.navigationInProgress = false
        state.targetRoute = null
      })

      return false
    }
  }

  /**
   * Wait for route to actually change
   * Polls router state with timeout
   */
  private async waitForRouteChange(
    targetRoute: RouteType,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const checkRoute = () => {
        const currentRoute = this.store.getState().currentRoute

        // Route successfully changed
        if (currentRoute === targetRoute) {
          resolve()
          return
        }

        // Timeout exceeded
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Route change timeout after ${timeout}ms`))
          return
        }

        // Check again after 100ms
        setTimeout(checkRoute, 100)
      }

      checkRoute()
    })
  }

  /**
   * Get current route from store
   */
  getCurrentRoute(): string {
    return this.store.getState().currentRoute
  }

  /**
   * Check if navigation is in progress
   */
  isNavigating(): boolean {
    return this.store.getState().navigationInProgress
  }

  /**
   * Sync current route with store (called from route change listeners)
   */
  syncCurrentRoute(route: string): void {
    this.store.setState((state) => {
      state.currentRoute = route
    })
  }

  /**
   * Navigate back in history
   */
  goBack(): void {
    _router?.back()
  }

  /**
   * Navigate forward in history
   */
  goForward(): void {
    _router?.forward()
  }

  /**
   * Refresh current page
   */
  refresh(): void {
    _router?.refresh()
  }
}

/**
 * REACT HOOK FOR USING NAVIGATION CONTROLLER
 * Creates controller instance and syncs route changes
 */
export function useNavigationController() {
  const router = useRouter()
  const { currentRoute, setCurrentRoute } = useCoPilotAgentStore((state) => ({
    currentRoute: state.currentRoute,
    setCurrentRoute: state.setCurrentRoute,
  }))

  // Wire the module-level router ref so NavigationController.navigateTo() works
  initNavigationRouter(router)

  // Create controller instance (no useRouter() call inside anymore)
  const controller = new NavigationController()

  return {
    controller,
    currentRoute,
    navigateTo: (page: RouteType, options?: NavigationOptions) =>
      controller.navigateTo(page, options),
    isNavigating: () => controller.isNavigating(),
    syncRoute: (route: string) => controller.syncCurrentRoute(route),
  }
}

/**
 * VALID ROUTES
 * List of all valid routes that Claude can navigate to
 */
export const VALID_ROUTES: RouteType[] = [
  '/leads/prospects',
  '/leads/companies',
  '/leads/companies/search',
  '/leads/companies/identification',
  '/leads/companies/enrichment',
  '/leads/companies/linkedin-posts',
  '/leads/companies/keyword-search',
  '/signals/intents',
  '/signals/events',
  '/signals/trackers',
  '/signals/websights',
  '/signals/form-complete',
  '/campaigns',
  '/campaigns/new',
  '/workflows',
  '/ai-agents',
  '/ai-powered-search',
  '/leads/watcher',
  '/copilot/meeting-prep',
  '/copilot/pipeline-alerts',
  '/copilot/campaign-optimizer',
]

/**
 * ROUTE VALIDATOR
 * Checks if a route string is valid
 */
export function isValidRoute(route: string): route is RouteType {
  return VALID_ROUTES.includes(route as RouteType)
}

/**
 * ROUTE METADATA
 * Human-readable names for routes
 */
export const ROUTE_NAMES: Record<RouteType, string> = {
  '/leads/prospects': 'Prospects',
  '/leads/companies': 'Companies Overview',
  '/leads/companies/search': 'Company Search',
  '/leads/companies/identification': 'Company Identification',
  '/leads/companies/enrichment': 'Company Enrichment',
  '/leads/companies/linkedin-posts': 'Social Posts by Company',
  '/leads/companies/keyword-search': 'Social Posts Keyword Search',
  '/signals/intents': 'Intent Signals',
  '/signals/events': 'Events',
  '/signals/trackers': 'Trackers',
  '/signals/websights': 'Websights',
  '/signals/form-complete': 'Form Completions',
  '/campaigns': 'Campaigns',
  '/campaigns/new': 'New Campaign',
  '/workflows': 'Workflows',
  '/ai-agents': 'AI Agents',
  '/ai-powered-search': 'Global Search',
  '/leads/watcher': 'Watcher',
  '/copilot/meeting-prep': 'Meeting Prep',
  '/copilot/pipeline-alerts': 'Pipeline Alerts',
  '/copilot/campaign-optimizer': 'Email Optimizer',
}

/**
 * ROUTE CATEGORIZATION
 * Group routes by feature area
 */
export const ROUTE_CATEGORIES = {
  leads: ['/leads/prospects', '/leads/companies', '/leads/companies/search', '/leads/companies/identification', '/leads/companies/enrichment', '/leads/companies/linkedin-posts', '/leads/companies/keyword-search', '/leads/watcher'] as RouteType[],
  signals: [
    '/signals/intents',
    '/signals/events',
    '/signals/trackers',
    '/signals/websights',
    '/signals/form-complete',
  ] as RouteType[],
  automation: ['/campaigns', '/campaigns/new', '/workflows', '/ai-agents'] as RouteType[],
  search: ['/ai-powered-search'] as RouteType[],
}
