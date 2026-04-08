/**
 * TOOL HANDLERS
 * Implementations for all tools available to Claude
 * Each tool maps to a platform capability that Claude can execute
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCoPilotAgentStore, RouteType, ExecutionStep, WorkflowPlan, WorkflowStep, WorkflowStepType } from './agent-store'
import { NavigationController, isValidRoute, ROUTE_NAMES } from './navigation-controller'
import { FilterController, getModuleFields } from './filter-controller'
import { MODULE_SCHEMAS, getModuleSchema } from './module-schemas'
import { getSearchController } from './search-controller'
import { campaignsApi } from '@/lib/api/campaigns'
import {
  listWatchers,
  getWatcher,
  createEventWatcher,
  createAccountWatcher,
  createLeadWatcher,
  syncWatcher,
  type WatcherRecord,
} from '@/lib/api/watcher-api'
const uuidv4 = () => crypto.randomUUID()

/**
 * TOOL I/O TYPES
 */

export interface ToolInput {
  [key: string]: unknown
}

export interface ToolResult {
  status: 'success' | 'error'
  message: string
  data?: unknown
  toolName?: string
}

export interface ToolExecution {
  toolName: string
  input: ToolInput
  result: ToolResult
  executionTime: number
  timestamp: number
}

/**
 * TOOL HANDLER CLASS
 * Implements all available tools for Claude
 */
export class ToolHandlers {
  private navController: NavigationController
  private filterController: FilterController
  private store: typeof useCoPilotAgentStore
  private executionLog: ToolExecution[] = []

  constructor() {
    this.navController = new NavigationController()
    this.filterController = new FilterController()
    this.store = useCoPilotAgentStore
  }

  /**
   * MAIN TOOL EXECUTOR
   * Routes tool calls to appropriate handlers
   */
  async handleTool(toolName: string, input: ToolInput): Promise<ToolResult> {
    const startTime = Date.now()

    try {
      console.log(`[Tool] Executing: ${toolName}`, input)

      let result: ToolResult

      switch (toolName) {
        case 'navigate_to':
          result = await this.toolNavigateTo(input)
          break

        case 'set_filters':
          result = await this.toolSetFilters(input)
          break

        case 'execute_search':
          result = await this.toolExecuteSearch(input)
          break

        case 'get_module_parameters':
          result = await this.toolGetModuleParameters(input)
          break

        case 'create_campaign':
          result = await this.toolCreateCampaign(input)
          break

        case 'create_workflow':
          result = await this.toolCreateWorkflow(input)
          break

        case 'summarize_results':
          result = await this.toolSummarizeResults(input)
          break

        case 'add_to_campaign':
          result = await this.toolAddToCampaign(input)
          break

        case 'list_campaigns':
          result = await this.toolListCampaigns(input)
          break

        case 'plan_workflow':
          result = await this.toolPlanWorkflow(input)
          break

        case 'undo_last_action':
          result = await this.toolUndoLastAction(input)
          break

        case 'create_watcher':
          result = await this.toolCreateWatcher(input)
          break

        case 'list_watchers':
          result = await this.toolListWatchers(input)
          break

        case 'sync_watcher':
          result = await this.toolSyncWatcher(input)
          break

        case 'get_watcher_results':
          result = await this.toolGetWatcherResults(input)
          break

        case 'get_signal_drafts':
          result = await this.toolGetSignalDrafts(input)
          break

        case 'get_champion_alerts':
          result = await this.toolGetChampionAlerts(input)
          break

        case 'fill_copilot_form':
          result = await this.toolFillCopilotForm(input)
          break

        case 'fill_ai_agent_form':
          result = await this.toolFillAiAgentForm(input)
          break

        default:
          result = {
            status: 'error',
            message: `Unknown tool: ${toolName}`,
          }
      }

      // Advance workflow plan step on success
      if (result.status === 'success') {
        this.maybeAdvanceWorkflow(toolName)
      } else {
        const plan = this.store.getState().workflowPlan
        if (plan?.status === 'running') {
          this.store.getState().failWorkflowStep(result.message)
        }
      }

      // Log execution
      const executionTime = Date.now() - startTime
      this.executionLog.push({
        toolName,
        input,
        result,
        executionTime,
        timestamp: Date.now(),
      })

      console.log(
        `[Tool] Completed: ${toolName} (${executionTime}ms)`,
        result
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Tool] Failed: ${toolName}`, errorMessage)

      return {
        status: 'error',
        message: `Tool execution failed: ${errorMessage}`,
        toolName,
      }
    }
  }

  /**
   * TOOL: navigate_to
   * Navigate to a specific page in the platform
   */
  private async toolNavigateTo(input: ToolInput): Promise<ToolResult> {
    const { page } = input as { page: string }

    // Validate page
    if (!page) {
      return {
        status: 'error',
        message: 'Page parameter is required',
      }
    }

    if (!isValidRoute(page)) {
      const validPages = Object.keys(ROUTE_NAMES).join(', ')
      return {
        status: 'error',
        message: `Invalid page: ${page}. Valid pages: ${validPages}`,
      }
    }

    // Perform navigation
    const success = await this.navController.navigateTo(page)

    if (!success) {
      return {
        status: 'error',
        message: `Navigation to ${page} failed`,
      }
    }

    return {
      status: 'success',
      message: `Successfully navigated to ${ROUTE_NAMES[page]}`,
      data: {
        page,
        pageName: ROUTE_NAMES[page],
        currentRoute: this.store.getState().currentRoute,
      },
    }
  }

  /**
   * TOOL: set_filters
   * Inject filter values for a module
   */
  private async toolSetFilters(input: ToolInput): Promise<ToolResult> {
    const { module, filters } = input as {
      module: string
      filters: Record<string, unknown>
    }

    // Validate inputs
    if (!module || !filters) {
      return {
        status: 'error',
        message: 'Module and filters parameters are required',
      }
    }

    if (Object.keys(filters).length === 0) {
      return {
        status: 'error',
        message: 'At least one filter must be provided',
      }
    }

    // Inject filters
    const result = await this.filterController.injectFilters(module, filters)

    if (!result.success) {
      return {
        status: 'error',
        message: result.message,
        data: { errors: result.errors },
      }
    }

    return {
      status: 'success',
      message: result.message,
      data: {
        module,
        appliedFilters: this.filterController.getFilters(module),
        filterCount: result.appliedCount,
      },
    }
  }

  /**
   * TOOL: execute_search
   * Execute a search with currently set filters
   */
  private async toolExecuteSearch(input: ToolInput): Promise<ToolResult> {
    const { module } = input as { module: string }

    // Validate module
    if (!module) {
      return {
        status: 'error',
        message: 'Module parameter is required',
      }
    }

    const schema = getModuleSchema(module)
    if (!schema) {
      return {
        status: 'error',
        message: `Unknown module: ${module}`,
      }
    }

    // Get current filters
    const filters = this.filterController.getFilters(module)

    // Validate required fields
    const missingRequired = schema.required.filter((f) => !(f in filters))
    if (missingRequired.length > 0) {
      return {
        status: 'error',
        message: `Missing required filters: ${missingRequired.join(', ')}`,
        data: { missingFields: missingRequired },
      }
    }

    // Mark as loading
    this.store.setState((state) => {
      state.isLoading = true
    })

    try {
      const searchController = getSearchController()
      const result = await searchController.executeSearch(module)

      return {
        status: result.status,
        message: result.summary,
        data: {
          module,
          resultCount: result.resultCount,
          appliedFilters: filters,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.store.setState((state) => {
        state.executionResults.push({
          module,
          status: 'error',
          error: errorMessage,
          timestamp: Date.now(),
        })
      })

      return {
        status: 'error',
        message: `Search execution failed: ${errorMessage}`,
      }
    } finally {
      this.store.setState((state) => {
        state.isLoading = false
      })
    }
  }

  /**
   * TOOL: get_module_parameters
   * Get available filter parameters for a module
   */
  private async toolGetModuleParameters(input: ToolInput): Promise<ToolResult> {
    const { module } = input as { module: string }

    if (!module) {
      return {
        status: 'error',
        message: 'Module parameter is required',
      }
    }

    const fields = getModuleFields(module)
    if (!fields) {
      return {
        status: 'error',
        message: `Unknown module: ${module}`,
      }
    }

    const schema = getModuleSchema(module)

    return {
      status: 'success',
      message: `Parameters for ${module} module`,
      data: {
        module,
        required: fields.required,
        optional: fields.optional,
        defaults: fields.defaults,
        description: schema?.description,
        creditCost: schema?.creditCost,
        route: schema?.route,
      },
    }
  }

  /**
   * TOOL: create_campaign
   * Create a new outreach campaign via real API
   */
  private async toolCreateCampaign(input: ToolInput): Promise<ToolResult> {
    const { name, segment_ids, template_id, objective } = input as {
      name: string
      segment_ids?: string[]
      template_id?: string
      objective?: string
    }

    if (!name) {
      return { status: 'error', message: 'Campaign name is required' }
    }

    const leads = segment_ids || []

    try {
      const campaign = await campaignsApi.createCampaign({
        name,
        objective: objective || `Campaign created via Co-Pilot${template_id ? ` using template: ${template_id}` : ''}`,
        leads,
      })

      this.store.setState((state) => {
        state.executionResults.push({
          module: 'campaigns',
          status: 'success',
          resultCount: 1,
          results: [{ campaignId: campaign.id, name: campaign.name, leadCount: leads.length }],
          timestamp: Date.now(),
        })
      })

      return {
        status: 'success',
        message: `Campaign "${name}" created successfully.`,
        data: {
          campaignId: campaign.id,
          name: campaign.name,
          leadCount: leads.length,
          status: campaign.status,
          creditCost: 3,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campaign creation failed'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: add_to_campaign
   * Create a campaign using the last search results as the lead list (multi-step flow)
   */
  private async toolAddToCampaign(input: ToolInput): Promise<ToolResult> {
    const { campaign_name, module } = input as { campaign_name: string; module?: string }

    if (!campaign_name) {
      return { status: 'error', message: 'campaign_name is required' }
    }

    // Find last successful search result
    const results = this.store.getState().executionResults
    const targetModule = module || (results.length > 0 ? results[results.length - 1].module : null)

    if (!targetModule) {
      return {
        status: 'error',
        message: 'No search results available. Run a prospect or company search first.',
      }
    }

    const moduleResults = results.filter((r) => r.module === targetModule && r.status === 'success')
    if (moduleResults.length === 0) {
      return { status: 'error', message: `No results found for module: ${targetModule}. Run a search first.` }
    }

    const lastResult = moduleResults[moduleResults.length - 1]
    const leads = ((lastResult.results || []) as Array<Record<string, unknown>>)
      .map((r) => r?.id as string)
      .filter(Boolean)

    if (leads.length === 0) {
      return {
        status: 'error',
        message: 'Search results have no lead IDs. Try searching prospects or companies first.',
      }
    }

    try {
      const campaign = await campaignsApi.createCampaign({
        name: campaign_name,
        objective: `Auto-created from ${targetModule} search via Co-Pilot`,
        leads,
      })

      this.store.setState((state) => {
        state.executionResults.push({
          module: 'campaigns',
          status: 'success',
          resultCount: 1,
          results: [campaign],
          timestamp: Date.now(),
        })
      })

      return {
        status: 'success',
        message: `Created campaign "${campaign_name}" with ${leads.length} lead${leads.length !== 1 ? 's' : ''} from ${targetModule}.`,
        data: {
          campaignId: campaign.id,
          name: campaign.name,
          leadCount: leads.length,
          sourceModule: targetModule,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campaign creation failed'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: list_campaigns
   * List existing campaigns so Claude can resolve names to IDs
   */
  private async toolListCampaigns(_input: ToolInput): Promise<ToolResult> {
    try {
      const campaigns = await campaignsApi.getCampaigns()

      return {
        status: 'success',
        message: `Found ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}.`,
        data: {
          campaigns: campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            leadsCount: c.leadsCount,
          })),
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load campaigns'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: create_workflow
   * Create an automation workflow
   */
  private async toolCreateWorkflow(input: ToolInput): Promise<ToolResult> {
    const { name, trigger_type, actions } = input as {
      name: string
      trigger_type: string
      actions?: unknown[]
    }

    // Validate inputs
    if (!name || !trigger_type) {
      return {
        status: 'error',
        message: 'Workflow name and trigger type are required',
      }
    }

    const validTriggers = ['intent', 'event', 'schedule', 'form_completion']
    if (!validTriggers.includes(trigger_type)) {
      return {
        status: 'error',
        message: `Invalid trigger type. Valid options: ${validTriggers.join(', ')}`,
      }
    }

    // TODO: Actually call workflow creation API
    const workflowId = uuidv4()

    this.store.setState((state) => {
      state.executionResults.push({
        module: 'workflows',
        status: 'success',
        resultCount: 1,
        results: [{ workflowId, name, triggerType: trigger_type }],
        timestamp: Date.now(),
      })
    })

    return {
      status: 'success',
      message: `Workflow created: ${name}`,
      data: {
        workflowId,
        name,
        triggerType: trigger_type,
        actionCount: (actions || []).length,
        creditCost: 2,
      },
    }
  }

  /**
   * TOOL: summarize_results
   * Summarize the last search results
   */
  private async toolSummarizeResults(input: ToolInput): Promise<ToolResult> {
    const { module } = input as { module?: string }

    const results = this.store.getState().executionResults

    if (results.length === 0) {
      return {
        status: 'error',
        message: 'No results to summarize',
      }
    }

    // Get last result for module (or any if no module specified)
    let lastResult = results[results.length - 1]
    if (module) {
      const moduleResults = results.filter((r) => r.module === module)
      if (moduleResults.length === 0) {
        return {
          status: 'error',
          message: `No results found for module: ${module}`,
        }
      }
      lastResult = moduleResults[moduleResults.length - 1]
    }

    if (lastResult.status === 'error') {
      return {
        status: 'error',
        message: `Previous search failed: ${lastResult.error}`,
      }
    }

    const count = lastResult.resultCount || 0

    return {
      status: 'success',
      message: `Found ${count} results in ${lastResult.module} module`,
      data: {
        module: lastResult.module,
        resultCount: count,
        summary: `${count} matches found. Would you like to take action?`,
        suggestedActions: [
          'Add to campaign',
          'Create workflow',
          'Export results',
          'Create watcher',
        ],
      },
    }
  }

  /**
   * TOOL: plan_workflow
   * Declare a named multi-step plan before executing it.
   * Shows a step tracker in the UI so the user knows what's coming.
   */
  private async toolPlanWorkflow(input: ToolInput): Promise<ToolResult> {
    const { name, steps } = input as {
      name: string
      steps: Array<{ type: string; description: string }>
    }

    if (!name || !steps || steps.length === 0) {
      return { status: 'error', message: 'Workflow name and at least one step are required' }
    }

    const TOOL_TO_STEP_TYPE: Record<string, WorkflowStepType> = {
      navigate: 'navigate',
      filter: 'filter',
      search: 'search',
      create_campaign: 'create_campaign',
      create_workflow: 'create_workflow',
      create_watcher: 'create_watcher',
      fill_copilot_form: 'other',
    }

    const plan: WorkflowPlan = {
      id: `wf-${Date.now()}`,
      name,
      steps: steps.map((s, i) => ({
        id: `step-${i}`,
        type: (TOOL_TO_STEP_TYPE[s.type] ?? 'other') as WorkflowStepType,
        description: s.description,
        status: i === 0 ? 'running' : 'pending',
      } as WorkflowStep)),
      currentStepIndex: 0,
      status: 'running',
      createdAt: Date.now(),
    }

    this.store.setState((state) => {
      state.workflowPlan = plan
    })

    return {
      status: 'success',
      message: `Workflow "${name}" planned with ${steps.length} step${steps.length !== 1 ? 's' : ''}. Executing now.`,
      data: { workflowId: plan.id, stepCount: steps.length },
    }
  }

  /**
   * TOOL: undo_last_action
   * Reverts the last filter injection for the given module.
   */
  private async toolUndoLastAction(input: ToolInput): Promise<ToolResult> {
    const { module } = input as { module: string }

    if (!module) {
      return { status: 'error', message: 'Module parameter is required for undo' }
    }

    const undoResult = this.filterController.undo(module)

    if (!undoResult.success) {
      return {
        status: 'error',
        message: `No filter history found for "${module}" — nothing to undo.`,
      }
    }

    const restored = this.filterController.getFilters(module)

    return {
      status: 'success',
      message: `Undid last filter change for "${module}".`,
      data: {
        module,
        restoredFilters: restored,
        filterCount: Object.keys(restored).length,
      },
    }
  }

  /**
   * TOOL: fill_copilot_form
   * Fills a Copilot page form (meeting prep, pipeline alerts, email optimizer)
   * and auto-submits it. The page subscribes to the store and reacts immediately.
   */
  private async toolFillCopilotForm(input: ToolInput): Promise<ToolResult> {
    const { module, fields, auto_submit } = input as {
      module: string
      fields: Record<string, unknown>
      auto_submit?: boolean
    }

    const VALID_MODULES: Record<string, string> = {
      meeting_prep: '/copilot/meeting-prep',
      pipeline_alerts: '/copilot/pipeline-alerts',
      email_optimizer: '/copilot/campaign-optimizer',
      campaign_creation: '/campaigns/new',
    }

    if (!module || !VALID_MODULES[module]) {
      return {
        status: 'error',
        message: `Invalid module "${module}". Valid options: meeting_prep, pipeline_alerts, email_optimizer, campaign_creation`,
      }
    }

    if (!fields || Object.keys(fields).length === 0) {
      return {
        status: 'error',
        message: 'fields is required — provide the form values to fill',
      }
    }

    // Validate required fields per module
    const REQUIRED: Record<string, string[]> = {
      meeting_prep: ['company_name'],
      pipeline_alerts: ['deals'],
      email_optimizer: ['subject_line', 'email_body'],
      campaign_creation: ['name', 'objective'],
    }

    const missing = (REQUIRED[module] || []).filter((f) => !(f in fields))
    if (missing.length > 0) {
      return {
        status: 'error',
        message: `Missing required fields for ${module}: ${missing.join(', ')}`,
      }
    }

    const shouldSubmit = auto_submit !== false // default true

    // Write into the store — the page's useEffect will pick this up
    this.store.setState((state) => {
      const prev = state.copilotForms?.[module]
      if (!state.copilotForms) state.copilotForms = {}
      state.copilotForms[module] = {
        fields,
        submitSignal: shouldSubmit ? ((prev?.submitSignal ?? 0) + 1) : (prev?.submitSignal ?? 0),
      }
    })

    // Highlight the form panel
    this.store.setState((state) => {
      state.highlightedElement = `${module}-form-panel`
    })
    setTimeout(() => {
      this.store.setState((state) => {
        if (state.highlightedElement === `${module}-form-panel`) {
          state.highlightedElement = null
        }
      })
    }, 3000)

    const fieldSummary = Object.entries(fields)
      .filter(([k]) => k !== 'deals')
      .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
      .join(', ')

    const dealsCount = Array.isArray(fields.deals) ? (fields.deals as unknown[]).length : null
    const dealsSummary = dealsCount !== null ? ` (${dealsCount} deal${dealsCount !== 1 ? 's' : ''})` : ''

    return {
      status: 'success',
      message: `${shouldSubmit ? 'Filled and submitted' : 'Filled'} ${module} form${dealsSummary}. ${fieldSummary ? `Fields: ${fieldSummary}` : ''}`,
      data: {
        module,
        route: VALID_MODULES[module],
        fieldsSet: Object.keys(fields),
        autoSubmit: shouldSubmit,
      },
    }
  }

  /**
   * TOOL: fill_ai_agent_form
   * Fill and auto-run one of the 9 AI Agents on /ai-agents page
   */
  private async toolFillAiAgentForm(input: ToolInput): Promise<ToolResult> {
    const { agent, fields } = input as {
      agent: string
      fields: Record<string, unknown>
    }

    const VALID_AGENTS: Record<string, string> = {
      agentic_search: 'search',
      lookalike: 'lookalike',
      research: 'research',
      predictive: 'predictive',
      crossfire: 'crossfire',
      compliance_oracle: 'compliance',
      virality_engine: 'virality',
      talent_radar: 'talent',
      regime_shifter: 'regime',
    }

    const REQUIRED_FIELDS: Record<string, string[]> = {
      agentic_search: ['query'],
      lookalike: ['seed_pool'],
      research: ['entity_name'],
      predictive: ['company_name'],
      crossfire: ['competitor_domain'],
      compliance_oracle: ['outbound_message'],
      virality_engine: ['seed_customers'],
      talent_radar: ['key_accounts'],
      regime_shifter: ['geo_icp_focus'],
    }

    if (!agent || !VALID_AGENTS[agent]) {
      return {
        status: 'error',
        message: `Invalid agent "${agent}". Valid options: ${Object.keys(VALID_AGENTS).join(', ')}`,
      }
    }

    if (!fields || Object.keys(fields).length === 0) {
      return {
        status: 'error',
        message: 'fields is required — provide the agent form values to fill',
      }
    }

    const missing = (REQUIRED_FIELDS[agent] || []).filter((f) => !(f in fields))
    if (missing.length > 0) {
      return {
        status: 'error',
        message: `Missing required fields for ${agent}: ${missing.join(', ')}`,
      }
    }

    // Write into the store — the AI agents page + panel pick this up
    this.store.setState((state) => {
      const prev = state.copilotForms?.[agent]
      if (!state.copilotForms) state.copilotForms = {}
      state.copilotForms[agent] = {
        fields,
        submitSignal: (prev?.submitSignal ?? 0) + 1,
      }
    })

    // Highlight the agent panel
    this.store.setState((state) => {
      state.highlightedElement = `${agent}-form-panel`
    })
    setTimeout(() => {
      this.store.setState((state) => {
        if (state.highlightedElement === `${agent}-form-panel`) {
          state.highlightedElement = null
        }
      })
    }, 4000)

    const tabId = VALID_AGENTS[agent]
    const fieldSummary = Object.entries(fields)
      .map(([k, v]) => {
        const val = Array.isArray(v) ? (v as string[]).join(', ') : String(v)
        return `${k}: ${val.slice(0, 50)}`
      })
      .join(' | ')

    return {
      status: 'success',
      message: `Deployed ${agent} agent. Fields: ${fieldSummary}`,
      data: {
        agent,
        tabId,
        fieldsSet: Object.keys(fields),
      },
    }
  }

  /**
   * Advance the active workflow plan by one step.
   * Called internally after each successful tool execution when a plan is active.
   */
  private maybeAdvanceWorkflow(toolName: string): void {
    const plan = this.store.getState().workflowPlan
    if (!plan || plan.status !== 'running') return

    const TOOL_TO_STEP: Record<string, WorkflowStepType> = {
      navigate_to: 'navigate',
      set_filters: 'filter',
      execute_search: 'search',
      create_campaign: 'create_campaign',
      add_to_campaign: 'create_campaign',
      create_workflow: 'create_workflow',
      create_watcher: 'create_watcher',
      fill_ai_agent_form: 'run_agent',
      fill_copilot_form: 'other',
    }

    const stepType = TOOL_TO_STEP[toolName]
    if (!stepType) return

    const currentStep = plan.steps[plan.currentStepIndex]
    if (currentStep && currentStep.type === stepType) {
      this.store.getState().advanceWorkflowStep()
    }
  }

  /**
   * TOOL: create_watcher
   * Creates an event, account, or lead watcher via the real backend API.
   */
  private async toolCreateWatcher(input: ToolInput): Promise<ToolResult> {
    const {
      watcher_type,
      name,
      description,
      // event watcher fields
      event_types,
      funding_stage,
      min_funding_amount,
      max_funding_amount,
      job_level,
      department,
      company_size,
      industry,
      location,
      keywords,
      technology_category,
      // account watcher fields
      account_name,
      account_domain,
      account_triggers,
      // lead watcher fields
      lead_name,
      lead_company,
      lead_title,
      lead_email,
      lead_triggers,
      // notifications
      notification_email,
      notification_slack,
    } = input as Record<string, unknown>

    if (!watcher_type || !name) {
      return { status: 'error', message: 'watcher_type and name are required' }
    }

    const notificationSettings =
      notification_email || notification_slack
        ? { email: Boolean(notification_email), slack: notification_slack as string | undefined }
        : undefined

    try {
      let watcher: WatcherRecord

      if (watcher_type === 'event') {
        if (!event_types || !Array.isArray(event_types) || event_types.length === 0) {
          return { status: 'error', message: 'event_types is required for event watchers (array of at least one event type)' }
        }
        watcher = await createEventWatcher({
          name: name as string,
          description: description as string | undefined,
          type: 'event',
          criteria: {
            event_type: event_types as string[],
            funding_stage: funding_stage as string[] | undefined,
            min_funding_amount: min_funding_amount as number | undefined,
            max_funding_amount: max_funding_amount as number | undefined,
            job_level: job_level as string[] | undefined,
            department: department as string[] | undefined,
            company_size: company_size as string[] | undefined,
            industry: industry as string[] | undefined,
            location: location as string[] | undefined,
            keywords: keywords as string[] | undefined,
            technology_category: technology_category as string[] | undefined,
          },
          notificationSettings,
        })

      } else if (watcher_type === 'account') {
        if (!account_name || !account_domain || !account_triggers) {
          return {
            status: 'error',
            message: 'account_name, account_domain, and account_triggers are required for account watchers',
          }
        }
        watcher = await createAccountWatcher({
          name: name as string,
          description: description as string | undefined,
          type: 'account',
          accountName: account_name as string,
          accountDomain: account_domain as string,
          triggers: account_triggers as string[],
          notificationSettings,
        })

      } else if (watcher_type === 'lead') {
        if (!lead_name || !lead_company || !lead_triggers) {
          return {
            status: 'error',
            message: 'lead_name, lead_company, and lead_triggers are required for lead watchers',
          }
        }
        watcher = await createLeadWatcher({
          name: name as string,
          description: description as string | undefined,
          type: 'lead',
          leadName: lead_name as string,
          leadCompany: lead_company as string,
          leadTitle: lead_title as string | undefined,
          leadEmail: lead_email as string | undefined,
          triggers: lead_triggers as string[],
          notificationSettings: notification_email ? { email: true } : undefined,
        })

      } else {
        return {
          status: 'error',
          message: `Invalid watcher_type: "${watcher_type}". Must be "event", "account", or "lead"`,
        }
      }

      // Auto-sync immediately after creation to fetch current matches
      let syncData: { matchCount: number; newMatchCount: number; matches?: unknown[]; updates?: unknown[] } = {
        matchCount: 0,
        newMatchCount: 0,
      }
      try {
        const syncResult = await syncWatcher(watcher.id)
        syncData.matchCount = syncResult.match_count ?? 0
        syncData.newMatchCount = syncResult.new_matches_count ?? 0

        // Fetch full detail with matches
        const detail = await getWatcher(watcher.id)
        if (watcher_type === 'event') {
          syncData.matches = ((detail.matches || []) as unknown[]).slice(0, 5)
        } else {
          syncData.updates = ((detail.recent_updates || []) as unknown[]).slice(0, 5)
        }
      } catch {
        // Sync failure is non-fatal — watcher was still created
      }

      const matchSummary =
        syncData.matchCount > 0
          ? ` Initial sync found ${syncData.matchCount} match${syncData.matchCount !== 1 ? 'es' : ''}.`
          : ' No matches yet — it will alert you as new events occur.'

      this.store.setState((state) => {
        state.executionResults.push({
          module: 'watcher',
          status: 'success',
          resultCount: syncData.matchCount,
          results: (syncData.matches || syncData.updates || []) as Array<Record<string, unknown>>,
          timestamp: Date.now(),
        })
      })

      return {
        status: 'success',
        message: `Watcher "${watcher.name}" created and is now active.${matchSummary}`,
        data: {
          watcherId: watcher.id,
          name: watcher.name,
          type: watcher.type,
          status: watcher.status,
          createdAt: watcher.created_at,
          matchCount: syncData.matchCount,
          topMatches: syncData.matches || syncData.updates || [],
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Watcher creation failed'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: list_watchers
   * Returns a list of all watchers, optionally filtered by type.
   */
  private async toolListWatchers(input: ToolInput): Promise<ToolResult> {
    const { watcher_type } = input as { watcher_type?: 'event' | 'account' | 'lead' }

    try {
      const watchers = await listWatchers(watcher_type)

      const summary = watchers.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        status: w.status,
        match_count: w.match_count ?? '0',
        last_triggered_at: w.last_triggered_at ?? null,
      }))

      const activeCount = watchers.filter((w) => w.status === 'active').length
      const typeLabel = watcher_type ? `${watcher_type} ` : ''

      this.store.setState((state) => {
        state.executionResults.push({
          module: 'watcher',
          status: 'success',
          resultCount: watchers.length,
          results: summary,
          timestamp: Date.now(),
        })
      })

      return {
        status: 'success',
        message: `Found ${watchers.length} ${typeLabel}watcher${watchers.length !== 1 ? 's' : ''} (${activeCount} active).`,
        data: { watchers: summary, total: watchers.length, active: activeCount },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to list watchers'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: sync_watcher
   * Triggers a sync for a watcher by ID or name to fetch the latest matches.
   */
  private async toolSyncWatcher(input: ToolInput): Promise<ToolResult> {
    const { watcher_id, watcher_name } = input as { watcher_id?: string; watcher_name?: string }

    if (!watcher_id && !watcher_name) {
      return { status: 'error', message: 'Provide either watcher_id or watcher_name' }
    }

    try {
      let resolvedId = watcher_id

      // Resolve name → id if needed
      if (!resolvedId && watcher_name) {
        const all = await listWatchers()
        const match = all.find(
          (w) => w.name.toLowerCase() === (watcher_name as string).toLowerCase()
        )
        if (!match) {
          return {
            status: 'error',
            message: `No watcher found with name "${watcher_name}". Use list_watchers to see available watchers.`,
          }
        }
        resolvedId = match.id
      }

      const result = await syncWatcher(resolvedId!)

      const matchCount = result.match_count ?? 0
      const newCount = result.new_matches_count ?? 0

      return {
        status: 'success',
        message: `Sync complete. Found ${matchCount} total match${matchCount !== 1 ? 'es' : ''}${newCount > 0 ? `, ${newCount} new since last sync` : ''}.`,
        data: {
          watcherId: resolvedId,
          matchCount,
          newMatchCount: newCount,
          lastSyncedAt: result.last_synced_at,
          message: result.message,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: get_watcher_results
   * Returns the current matches/results for a specific watcher.
   */
  private async toolGetWatcherResults(input: ToolInput): Promise<ToolResult> {
    const { watcher_id, limit } = input as { watcher_id: string; limit?: number }

    if (!watcher_id) {
      return { status: 'error', message: 'watcher_id is required' }
    }

    try {
      const watcher = await getWatcher(watcher_id)

      const cap = typeof limit === 'number' && limit > 0 ? limit : 10
      const matches = ((watcher.matches || []) as unknown[]).slice(0, cap)
      const updates = ((watcher.recent_updates || []) as unknown[]).slice(0, cap)

      const totalMatches = parseInt(watcher.match_count ?? '0', 10)

      return {
        status: 'success',
        message: `Watcher "${watcher.name}" has ${totalMatches} match${totalMatches !== 1 ? 'es' : ''}. Showing top ${Math.min(cap, matches.length || updates.length)}.`,
        data: {
          watcherId: watcher.id,
          name: watcher.name,
          type: watcher.type,
          status: watcher.status,
          totalMatches,
          matches: watcher.type === 'event' ? matches : updates,
          lastTriggeredAt: watcher.last_triggered_at ?? null,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get watcher results'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: get_signal_drafts
   * Fetches pending Signal-to-Sequence outreach drafts for the user.
   */
  private async toolGetSignalDrafts(input: ToolInput): Promise<ToolResult> {
    const { status = 'shown', limit = 10 } = input as { status?: string; limit?: number }

    try {
      const res = await fetch(`/api/copilot/signal-drafts?status=${status}&limit=${limit}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const drafts = await res.json() as Array<{
        id: string
        company_name: string | null
        signal_type: string
        lead_name: string | null
        lead_role: string | null
        draft_email_subject: string | null
        signal_score: number | null
        status: string
        created_at: string
      }>

      if (!drafts.length) {
        return {
          status: 'success',
          message: 'No pending signal drafts at the moment.',
          data: { drafts: [] },
        }
      }

      const summary = drafts.map((d) =>
        `• ${d.company_name ?? 'Unknown'} — ${d.signal_type.replace(/_/g, ' ')} signal` +
        (d.lead_name ? ` · Contact: ${d.lead_name}${d.lead_role ? `, ${d.lead_role}` : ''}` : '') +
        (d.draft_email_subject ? ` · Subject: "${d.draft_email_subject}"` : '') +
        (d.signal_score !== null ? ` · Score: ${d.signal_score}` : '')
      ).join('\n')

      return {
        status: 'success',
        message: `Found ${drafts.length} signal draft${drafts.length !== 1 ? 's' : ''}:\n${summary}\n\nNavigate to /copilot?tab=signal-drafts to review, edit, or add them to a campaign.`,
        data: { drafts },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch signal drafts'
      return { status: 'error', message: msg }
    }
  }

  /**
   * TOOL: get_champion_alerts
   * Fetches job-change alerts for contacts being tracked.
   */
  private async toolGetChampionAlerts(input: ToolInput): Promise<ToolResult> {
    const { unread_only = false, limit = 20 } = input as { unread_only?: boolean; limit?: number }

    try {
      const params = new URLSearchParams({ unread_only: String(unread_only), limit: String(limit) })
      const res = await fetch(`/api/copilot/champion-alerts?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const alerts = await res.json() as Array<{
        id: string
        contact_name: string | null
        prev_company: string | null
        new_company: string | null
        prev_title: string | null
        new_title: string | null
        change_type: string
        status: string
        is_read: boolean
        detected_at: string
        suggested_action: string
      }>

      if (!alerts.length) {
        return {
          status: 'success',
          message: 'No champion alerts at the moment. Enable "Track job changes" on a lead watcher to start detecting job moves.',
          data: { alerts: [] },
        }
      }

      const changeLabels: Record<string, string> = {
        left_account:   'left account',
        joined_account: 'joined account',
        promoted:       'promoted',
      }

      const summary = alerts.map((a) => {
        const label = changeLabels[a.change_type] ?? a.change_type
        return (
          `• ${a.contact_name ?? 'Unknown'} — ${label}` +
          (a.prev_company ? ` · ${a.prev_company}` : '') +
          ' → ' +
          (a.new_company ?? '?') +
          (a.new_title ? ` (${a.new_title})` : '') +
          ` · ${a.suggested_action}`
        )
      }).join('\n')

      return {
        status: 'success',
        message: `Found ${alerts.length} champion alert${alerts.length !== 1 ? 's' : ''}:\n${summary}\n\nNavigate to /copilot?tab=champion-alerts to review drafts and take action.`,
        data: { alerts },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch champion alerts'
      return { status: 'error', message: msg }
    }
  }

  /**
   * Get execution log
   */
  getExecutionLog(): ToolExecution[] {
    return this.executionLog
  }

  /**
   * Clear execution log
   */
  clearExecutionLog(): void {
    this.executionLog = []
  }
}

/**
 * SINGLETON INSTANCE
 * Single tool handler instance for the app
 */
let toolHandlersInstance: ToolHandlers | null = null

export function getToolHandlers(): ToolHandlers {
  if (!toolHandlersInstance) {
    toolHandlersInstance = new ToolHandlers()
  }
  return toolHandlersInstance
}

/**
 * REACT HOOK FOR TOOL HANDLERS
 */
export function useToolHandlers() {
  const handlers = getToolHandlers()

  return {
    handleTool: (toolName: string, input: ToolInput) =>
      handlers.handleTool(toolName, input),
    getExecutionLog: () => handlers.getExecutionLog(),
  }
}
