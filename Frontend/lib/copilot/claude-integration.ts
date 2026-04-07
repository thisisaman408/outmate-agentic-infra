/**
 * CLAUDE API INTEGRATION
 * Handles communication with Claude API for tool calling
 * Manages conversation history and tool execution
 */

'use client'

import { useCoPilotAgentStore, Message, ToolCall } from './agent-store'
import { getToolHandlers, ToolInput, ToolResult } from './tool-handlers'
import { v4 as uuidv4 } from 'uuid'

/**
 * CLAUDE TOOLS DEFINITION
 * All tools available to Claude with full schema
 */
const CLAUDE_TOOLS = [
  {
    name: 'navigate_to',
    description: 'Navigate to a specific page or module in the Outmate platform',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description: 'The page route to navigate to',
          enum: [
            '/leads/prospects',
            '/leads/companies',
            '/leads/companies/search',
            '/leads/companies/identification',
            '/leads/companies/enrichment',
            '/leads/companies/linkedin-posts',
            '/leads/companies/keyword-search',
            '/leads/watcher',
            '/copilot/meeting-prep',
            '/copilot/pipeline-alerts',
            '/copilot/campaign-optimizer',
            '/signals/intents',
            '/signals/events',
            '/signals/trackers',
            '/signals/websights',
            '/signals/form-complete',
            '/campaigns',
            '/workflows',
            '/ai-agents',
            '/ai-powered-search',
          ],
        },
      },
      required: ['page'],
    },
  },

  {
    name: 'set_filters',
    description: 'Set filter values for a specific module to refine search results',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'The module to filter',
          enum: [
            'prospects',
            'companies',
            'company_identification',
            'company_enrichment',
            'company_social_posts',
            'social_keyword_search',
            'intents',
            'events',
            'trackers',
            'websights',
            'form_complete',
            'campaigns',
            'workflows',
            'ai_agents',
            'global_search',
            'watcher_list',
          ],
        },
        filters: {
          type: 'object',
          description: 'Filter parameters for the module (varies by module)',
          additionalProperties: true,
        },
      },
      required: ['module', 'filters'],
    },
  },

  {
    name: 'execute_search',
    description:
      'Execute a search or query with the currently set filters for a module',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'The module to search in',
          enum: [
            'prospects',
            'companies',
            'company_identification',
            'company_enrichment',
            'company_social_posts',
            'social_keyword_search',
            'intents',
            'events',
            'trackers',
            'websights',
            'form_complete',
            'campaigns',
            'workflows',
            'ai_agents',
            'global_search',
            'watcher_list',
          ],
        },
      },
      required: ['module'],
    },
  },

  {
    name: 'get_module_parameters',
    description:
      'Get the available filter parameters and requirements for a specific module',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'The module to get parameters for',
        },
      },
      required: ['module'],
    },
  },

  {
    name: 'create_campaign',
    description: 'Create a new email outreach campaign with a target segment',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Campaign name',
        },
        segment_ids: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'IDs of prospects or segments to target',
        },
        template_id: {
          type: 'string',
          description: 'Email template to use (optional)',
        },
      },
      required: ['name', 'segment_ids'],
    },
  },

  {
    name: 'create_workflow',
    description: 'Create an automation workflow with triggers and actions',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name',
        },
        trigger_type: {
          type: 'string',
          enum: ['intent', 'event', 'schedule', 'form_completion'],
          description: 'What triggers this workflow',
        },
        actions: {
          type: 'array',
          description: 'Actions to execute when triggered',
          items: {
            type: 'object',
          },
        },
      },
      required: ['name', 'trigger_type'],
    },
  },

  {
    name: 'summarize_results',
    description: 'Get a summary of the last search results with next-step suggestions',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'Module to summarize results for (optional)',
        },
      },
      required: [],
    },
  },

  {
    name: 'add_to_campaign',
    description:
      'Create a new campaign using the last search results as the lead list. Use this after execute_search when the user wants to add found prospects/companies to a campaign.',
    input_schema: {
      type: 'object',
      properties: {
        campaign_name: {
          type: 'string',
          description: 'Name for the new campaign',
        },
        module: {
          type: 'string',
          description:
            'Source module to pull leads from (prospects, companies, etc.). Defaults to the last searched module.',
        },
      },
      required: ['campaign_name'],
    },
  },

  {
    name: 'list_campaigns',
    description:
      'List all existing campaigns with their names, statuses, and lead counts. Use this when the user references an existing campaign by name so you can resolve its ID.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'plan_workflow',
    description:
      'Declare a named multi-step workflow plan before executing it. Use this when the user asks you to do several things in sequence (e.g., "search prospects then create a campaign"). Declare the plan first so the user can see what you\'re about to do, then execute the steps.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short name for this workflow (e.g., "Q1 Fintech Outreach")',
        },
        steps: {
          type: 'array',
          description: 'Ordered list of steps in this workflow',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['navigate', 'filter', 'search', 'create_campaign', 'create_workflow', 'create_watcher', 'other'],
              },
              description: {
                type: 'string',
                description: 'Human-readable description of this step',
              },
            },
            required: ['type', 'description'],
          },
        },
      },
      required: ['name', 'steps'],
    },
  },

  {
    name: 'undo_last_action',
    description:
      'Undo the last filter injection for a specific module, restoring the previous filter state. Use when the user says "undo", "go back", "revert", or similar.',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description:
            'The module whose last filter change should be undone (e.g., "prospects", "companies"). Use the module that was most recently filtered.',
        },
      },
      required: ['module'],
    },
  },

  // ─── Copilot Form Tools ──────────────────────────────────────────

  {
    name: 'fill_copilot_form',
    description:
      'Fill and auto-submit a Copilot page form: Meeting Prep, Pipeline Alerts, or Email Optimizer. ' +
      'Injects field values and triggers form submission automatically — output renders on the page in real time. ' +
      'Call this IN THE SAME RESPONSE as navigate_to — do NOT wait for navigation to complete first.',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['meeting_prep', 'pipeline_alerts', 'email_optimizer', 'campaign_creation'],
          description:
            'Which Copilot page form to fill. ' +
            'meeting_prep → /copilot/meeting-prep, ' +
            'pipeline_alerts → /copilot/pipeline-alerts, ' +
            'email_optimizer → /copilot/campaign-optimizer, ' +
            'campaign_creation → /campaigns/new',
        },
        fields: {
          type: 'object',
          description: 'Form field values. See field reference below.',
          properties: {
            // ── meeting_prep fields ──
            company_name: {
              type: 'string',
              description: 'MEETING_PREP — company name (required)',
            },
            company_domain: {
              type: 'string',
              description: 'MEETING_PREP — company domain (e.g. acme.com)',
            },
            prospect_name: {
              type: 'string',
              description: 'MEETING_PREP — prospect full name',
            },
            prospect_title: {
              type: 'string',
              description: 'MEETING_PREP — prospect job title',
            },
            // ── pipeline_alerts fields ──
            deals: {
              type: 'array',
              description: 'PIPELINE_ALERTS — array of deal objects (required)',
              items: {
                type: 'object',
                properties: {
                  company: { type: 'string', description: 'Company name' },
                  stage: { type: 'string', description: 'Deal stage (e.g. Proposal, Discovery, Negotiation)' },
                  last_activity: { type: 'string', description: 'Date of last activity (YYYY-MM-DD)' },
                  value: { type: 'number', description: 'Deal value in USD' },
                },
                required: ['company', 'stage'],
              },
            },
            // ── email_optimizer fields ──
            subject_line: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — email subject line (required)',
            },
            email_body: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — full email body text (required)',
            },
            lead_name: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — lead full name (unlocks personalized rewrite)',
            },
            lead_company: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — lead company name (unlocks personalized rewrite)',
            },
            lead_role: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — lead job title',
            },
            lead_domain: {
              type: 'string',
              description: 'EMAIL_OPTIMIZER — lead company domain',
            },
            open_rate: {
              type: 'number',
              description: 'EMAIL_OPTIMIZER — current email open rate % (optional metric)',
            },
            reply_rate: {
              type: 'number',
              description: 'EMAIL_OPTIMIZER — current email reply rate % (optional metric)',
            },
            // ── campaign_creation fields ──
            name: {
              type: 'string',
              description: 'CAMPAIGN_CREATION — campaign name (required)',
            },
            objective: {
              type: 'string',
              description: 'CAMPAIGN_CREATION — campaign objective / goal description (required)',
            },
            signals: {
              type: 'string',
              description: 'CAMPAIGN_CREATION — comma-separated buying signals to reference (e.g. "raised Series A, expanded hiring in Europe")',
            },
            start_date: {
              type: 'string',
              description: 'CAMPAIGN_CREATION — optional campaign start date (YYYY-MM-DD)',
            },
          },
          additionalProperties: false,
        },
        auto_submit: {
          type: 'boolean',
          description: 'Whether to auto-submit after filling (default true). Set false to only pre-fill without submitting.',
        },
      },
      required: ['module', 'fields'],
    },
  },

  // ─── AI Agent Form Tools ─────────────────────────────────────────

  {
    name: 'fill_ai_agent_form',
    description:
      'Fill and auto-run one of the 9 AI Agents on the /ai-agents page. ' +
      'Call navigate_to("/ai-agents") IN THE SAME RESPONSE as this tool. ' +
      'The agent panel auto-switches to the correct tab, pre-fills all fields, and auto-submits.',
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: [
            'agentic_search',
            'lookalike',
            'research',
            'predictive',
            'crossfire',
            'compliance_oracle',
            'virality_engine',
            'talent_radar',
            'regime_shifter',
          ],
          description:
            'Which AI agent to run. ' +
            'agentic_search=natural-language prospect search, ' +
            'lookalike=mirror best customers, ' +
            'research=deep company intelligence, ' +
            'predictive=lead conversion scoring, ' +
            'crossfire=competitive intelligence warfare, ' +
            'compliance_oracle=outreach compliance check, ' +
            'virality_engine=B2B referral chain design, ' +
            'talent_radar=executive churn prediction, ' +
            'regime_shifter=geo-political ICP adaptation',
        },
        fields: {
          type: 'object',
          description: 'Form fields for the selected agent. See field reference per agent below.',
          properties: {
            // ── agentic_search ──
            query: {
              type: 'string',
              description: 'AGENTIC_SEARCH — natural-language search query (required). e.g. "Find VPs of Sales at Series B fintech startups in SF"',
            },
            // ── lookalike ──
            seed_pool: {
              type: 'array',
              items: { type: 'string' },
              description: 'LOOKALIKE — list of seed company names to mirror (required). e.g. ["Stripe", "Plaid", "Brex"]',
            },
            // ── research ──
            entity_name: {
              type: 'string',
              description: 'RESEARCH — company or entity name to research (required). e.g. "Anthropic", "Stripe", "SpaceX"',
            },
            scan_intensity: {
              type: 'string',
              enum: ['quick', 'standard', 'deep'],
              description: 'RESEARCH — scan depth: quick=1m, standard=2m, deep=5m (default: standard)',
            },
            // ── predictive ──
            company_name: {
              type: 'string',
              description: 'PREDICTIVE — company name to score for conversion probability (required)',
            },
            domain: {
              type: 'string',
              description: 'PREDICTIVE — company domain (optional). e.g. "acmecorp.com"',
            },
            industry: {
              type: 'string',
              description: 'PREDICTIVE — industry segment (optional). e.g. "SaaS", "Fintech", "Healthcare"',
            },
            country: {
              type: 'string',
              description: 'PREDICTIVE — country code (default: US)',
            },
            // ── crossfire ──
            competitor_domain: {
              type: 'string',
              description: 'CROSSFIRE — competitor domain to run intelligence against (required). e.g. "apollo.io", "outreach.io"',
            },
            target_region: {
              type: 'string',
              description: 'CROSSFIRE — optional target region to focus on. e.g. "US", "EU", "Global"',
            },
            extra_context: {
              type: 'string',
              description: 'CROSSFIRE — optional ICP, pipeline, or segment context',
            },
            // ── compliance_oracle ──
            jurisdictions: {
              type: 'string',
              description: 'COMPLIANCE_ORACLE — comma-separated jurisdictions (default: "US, EU, UK"). e.g. "US, EU, UK, APAC"',
            },
            outbound_message: {
              type: 'string',
              description: 'COMPLIANCE_ORACLE — the cold email, social sequence, or multi-step outreach to check (required)',
            },
            // ── virality_engine ──
            seed_customers: {
              type: 'string',
              description: 'VIRALITY_ENGINE — comma-separated champion customers or personas (required). e.g. "Rippling, Figma, Linear"',
            },
            channels: {
              type: 'string',
              description: 'VIRALITY_ENGINE — comma-separated outreach channels (default: "email, linkedin, in-product")',
            },
            additional_notes: {
              type: 'string',
              description: 'VIRALITY_ENGINE — optional constraints, incentives, or audience priorities',
            },
            // ── talent_radar ──
            key_accounts: {
              type: 'string',
              description: 'TALENT_RADAR — comma-separated customer accounts or descriptors to monitor for churn signals (required). e.g. "Salesforce, HubSpot, Zendesk"',
            },
            lookback_window: {
              type: 'number',
              description: 'TALENT_RADAR — lookback window in days (default: 90)',
            },
            // ── regime_shifter ──
            geo_icp_focus: {
              type: 'string',
              description: 'REGIME_SHIFTER — geo and ICP to adapt (required). e.g. "EU SaaS mid-market", "US manufacturing", "APAC fintech"',
            },
            scenario: {
              type: 'string',
              description: 'REGIME_SHIFTER — optional macro events to react to. e.g. "new tariffs", "election outcome", "economic downturn"',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['agent', 'fields'],
    },
  },

  // ─── Watcher Tools ───────────────────────────────────────────────

  {
    name: 'create_watcher',
    description:
      'Create a new watcher to monitor companies, accounts, or leads in real time. ' +
      'Use watcher_type="event" to discover new companies matching business event criteria (funding, hiring, IPO, etc.). ' +
      'Use watcher_type="account" to track changes at one specific company (website, news, job changes, funding). ' +
      'Use watcher_type="lead" to monitor a specific person for job changes, content publishing, speaking events. ' +
      'After creating, optionally call sync_watcher to fetch current matches immediately.',
    input_schema: {
      type: 'object',
      properties: {
        watcher_type: {
          type: 'string',
          enum: ['event', 'account', 'lead'],
          description: 'Type of watcher: event (company discovery), account (track one company), lead (track one person)',
        },
        name: {
          type: 'string',
          description: 'Human-readable name for the watcher (e.g., "Series A SaaS Tracker", "Watch Salesforce")',
        },
        description: {
          type: 'string',
          description: 'Optional description of what this watcher monitors',
        },
        // ── Event watcher fields ──
        event_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'ipo_announcement', 'new_funding_round', 'new_investment',
              'merger_and_acquisitions', 'cost_cutting', 'team_expansion',
              'team_reduction', 'product_launch', 'acquisition',
            ],
          },
          description: 'EVENT WATCHER ONLY — which business events to monitor (at least one required)',
        },
        funding_stage: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['seed', 'series_a', 'series_b', 'series_c', 'series_d_plus', 'ipo'],
          },
          description: 'EVENT WATCHER — filter by company funding stage',
        },
        job_level: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['c_level', 'vp', 'director', 'manager', 'individual'],
          },
          description: 'EVENT WATCHER — filter by hiring job level (used with team_expansion/team_reduction events)',
        },
        department: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['sales', 'marketing', 'engineering', 'product', 'customer_success', 'hr', 'finance'],
          },
          description: 'EVENT WATCHER — filter by department for hiring events',
        },
        company_size: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'],
          },
          description: 'EVENT WATCHER — filter by company headcount range',
        },
        industry: {
          type: 'array',
          items: { type: 'string' },
          description: 'EVENT WATCHER — filter by industry (e.g., ["saas", "fintech", "healthcare"])',
        },
        location: {
          type: 'array',
          items: { type: 'string' },
          description: 'EVENT WATCHER — filter by country/region (e.g., ["United States", "United Kingdom"])',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'EVENT WATCHER — filter by keywords in company description',
        },
        min_funding_amount: {
          type: 'number',
          description: 'EVENT WATCHER — minimum funding amount in USD',
        },
        max_funding_amount: {
          type: 'number',
          description: 'EVENT WATCHER — maximum funding amount in USD',
        },
        // ── Account watcher fields ──
        account_name: {
          type: 'string',
          description: 'ACCOUNT WATCHER ONLY — the company name to monitor (e.g., "Salesforce")',
        },
        account_domain: {
          type: 'string',
          description: 'ACCOUNT WATCHER ONLY — the company domain (e.g., "salesforce.com")',
        },
        account_triggers: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'Website Changes', 'Funding Events', 'Job Changes',
              'Technology Changes', 'News Mentions', 'Web Traffic Changes',
            ],
          },
          description: 'ACCOUNT WATCHER ONLY — what to monitor at this company (at least one required)',
        },
        // ── Lead watcher fields ──
        lead_name: {
          type: 'string',
          description: 'LEAD WATCHER ONLY — the person\'s full name (e.g., "John Smith")',
        },
        lead_company: {
          type: 'string',
          description: 'LEAD WATCHER ONLY — the person\'s current employer',
        },
        lead_title: {
          type: 'string',
          description: 'LEAD WATCHER — the person\'s job title (helps match identity)',
        },
        lead_email: {
          type: 'string',
          description: 'LEAD WATCHER — the person\'s work email (helps match identity)',
        },
        lead_triggers: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'Role Change', 'Company Change', 'Job Anniversary',
              'Content Published', 'Speaking Engagements', 'Social Media Activity',
            ],
          },
          description: 'LEAD WATCHER ONLY — which signals to track for this person (at least one required)',
        },
        // ── Notifications ──
        notification_email: {
          type: 'boolean',
          description: 'Send email notifications when this watcher fires (default false)',
        },
        notification_slack: {
          type: 'string',
          description: 'Slack webhook URL for alerts (optional)',
        },
      },
      required: ['watcher_type', 'name'],
    },
  },

  {
    name: 'list_watchers',
    description:
      'List all existing watchers. Optionally filter by watcher_type (event/account/lead). ' +
      'Returns each watcher\'s name, type, status, match count, and last triggered time. ' +
      'Use this when the user asks to see their watchers, or when you need to find a watcher ID by name.',
    input_schema: {
      type: 'object',
      properties: {
        watcher_type: {
          type: 'string',
          enum: ['event', 'account', 'lead'],
          description: 'Optional: only return watchers of this type',
        },
      },
      required: [],
    },
  },

  {
    name: 'sync_watcher',
    description:
      'Trigger a sync for a watcher to fetch its latest matches and updates from all intelligence sources. ' +
      'Provide either watcher_id (from create_watcher or list_watchers) or watcher_name. ' +
      'After sync, call get_watcher_results to see what was found.',
    input_schema: {
      type: 'object',
      properties: {
        watcher_id: {
          type: 'string',
          description: 'ID of the watcher to sync (preferred, starts with "w-")',
        },
        watcher_name: {
          type: 'string',
          description: 'Name of the watcher to sync (will be resolved to an ID automatically)',
        },
      },
      required: [],
    },
  },

  {
    name: 'get_watcher_results',
    description:
      'Get the current matches and results for a specific watcher. ' +
      'For event watchers: returns matching companies with event details. ' +
      'For account watchers: returns recent company updates (news, hires, web changes). ' +
      'For lead watchers: returns recent person activity signals. ' +
      'Always call sync_watcher first to get fresh data.',
    input_schema: {
      type: 'object',
      properties: {
        watcher_id: {
          type: 'string',
          description: 'ID of the watcher (from create_watcher or list_watchers)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
      required: ['watcher_id'],
    },
  },

  {
    name: 'get_signal_drafts',
    description:
      'Fetch the user\'s pending Signal-to-Sequence draft outreach emails. ' +
      'These are auto-generated personalised emails triggered when a watched account\'s ICP score crossed the user\'s threshold. ' +
      'Each draft includes: company name, signal type (funding/hiring/g2_intent/etc.), contact name and role, ' +
      'a draft subject + body, a 3-email follow-up sequence, and a reply probability score. ' +
      'Use this when the user asks to see their signal drafts, review AI-generated outreach, ' +
      'or wants to know which accounts triggered a sequence. ' +
      'After fetching, summarise each draft in 1-2 sentences and offer to navigate to /copilot?tab=signal-drafts.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['shown', 'all'],
          description: 'shown = pending drafts not yet actioned (default); all = include used/dismissed',
        },
        limit: {
          type: 'number',
          description: 'Max number of drafts to return (default 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_champion_alerts',
    description:
      'Fetch recent job-change alerts for contacts the user is tracking (Champion Alerts). ' +
      'Returns contacts who left a target account, joined one, or were promoted. ' +
      'Each alert includes: contact name, before→after company transition, change type ' +
      '(left_account | joined_account | promoted), a drafted re-engagement email, and a suggested action. ' +
      'Use this when the user asks about champion moves, job changes in their pipeline, ' +
      'contacts who changed companies, or wants to act on a re-engagement opportunity. ' +
      'After fetching, summarise each alert in 1 sentence and offer to navigate to /copilot?tab=champion-alerts.',
    input_schema: {
      type: 'object',
      properties: {
        unread_only: {
          type: 'boolean',
          description: 'If true, return only unread alerts. Default false.',
        },
        limit: {
          type: 'number',
          description: 'Max number of alerts to return. Default 20.',
        },
      },
      required: [],
    },
  },
]

/**
 * SYSTEM PROMPT FOR CLAUDE
 * Defines Claude's role and behavior
 */
const SYSTEM_PROMPT = `You are an advanced automation agent for Outmate, a B2B sales intelligence platform.

Your role is to help users find prospects, analyze signals, create campaigns, and automate their sales workflows—all through natural conversation. You are an ACTIVE EXECUTOR — not a Q&A bot. When the user gives you enough information, IMMEDIATELY execute all 3 steps in a single response without pausing to ask.

## CRITICAL EXECUTION RULES

### Rule 1: NEVER call get_module_parameters
Do NOT call get_module_parameters. You already know all filter fields for every module. Calling it wastes a round-trip and delays the user.

### Rule 2: Execute the FULL chain in ONE response
When you have enough information, call ALL tools in a single response — NEVER stop after just one tool call.

For search modules:
1. navigate_to(route)
2. set_filters(module, filters)
3. execute_search(module)

For Copilot forms (meeting prep, pipeline alerts, email optimizer, campaign creation):
1. navigate_to(route)  ← call SIMULTANEOUSLY with fill_copilot_form
2. fill_copilot_form(module, fields)

For watchers: call create_watcher directly — no navigate needed.

### Rule 3: Use sensible defaults — do NOT ask for missing optional fields
- prospects: company_size defaults to "11-5000" if not specified
- intents: timeframe defaults to "last_30_days" if not specified
- If the user gives you job_title + industry + funding_stage, that is ENOUGH — set all 3 and search immediately

### Rule 4: Act on the FIRST message if intent is clear
If the user says "Find VPs of Sales at Series B fintech companies" — you have everything:
- module: prospects
- job_title: "VP of Sales"
- industry: "fintech"
- funding_stage: "Series B"
→ Navigate + set_filters + execute_search in ONE response. Do not ask anything.

### Rule 5: Only ask a question if a REQUIRED field is truly missing
Required fields:
- prospects: none (all optional, use what you have)
- intents: topic
- companies: none (use what you have)
- events, websights, form_complete: none (use what you have)

## Execution Flow

When a user requests a search:
1. **Identify module** from context (prospects, companies, intents, etc.)
2. **Extract all filters** from the user's message
3. **Immediately execute** — navigate_to → set_filters → execute_search — in one response
4. **Summarize results** in 1-2 sentences + suggest one next step

## Module → Route mapping
- prospects → /leads/prospects
- companies → /leads/companies/search  (In-DB filter search, supports AI natural-language)
- company_identification → /leads/companies/identification  (look up a specific company by name/domain/URL/ID)
- company_enrichment → /leads/companies/enrichment  (bulk enrich companies with firmographics)
- company_social_posts → /leads/companies/linkedin-posts  (get recent LinkedIn posts FROM a company)
- social_keyword_search → /leads/companies/keyword-search  (search posts MENTIONING a keyword across all companies)
- intents → /signals/intents
- events → /signals/events
- websights → /signals/websights
- form_complete → /signals/form-complete
- trackers → /signals/trackers
- watcher → /leads/watcher
- meeting_prep → /copilot/meeting-prep
- pipeline_alerts → /copilot/pipeline-alerts
- email_optimizer → /copilot/campaign-optimizer
- campaigns → /campaigns

## When to use each Companies tool
- User says "find/search companies matching criteria" → **companies** (In-DB search with filters)
- User says "identify/look up [specific company name]" → **company_identification**
- User says "enrich [company domain or list]" → **company_enrichment**
- User says "show LinkedIn posts from [company]" → **company_social_posts**
- User says "search posts about [topic/keyword]" → **social_keyword_search**

## Filter key reference (use these exact keys in set_filters)
**prospects:** job_title, industry, location, company_size, funding_stage, tech_stack, keywords, seniority
**companies (In-DB):** name, domain, industry, headquarters_country, employee_count_range, company_size, funding_stage, recent_funding_activity, operational_regions, google_categories, intent_topics, business_event_signals, tech_stack_keywords, ai_search, keywords
  - employee_count_range values: "1-10","11-50","51-200","201-500","501-1000","1001-5000","5001-10000","10001+"
  - funding_stage values: "Seed","Series A","Series B","Series C+","Growth","Private Equity / Late Stage"
  - operational_regions codes: "us-ca","us-ga","us-ny","us-tx","ca-on","gb-eng","eu","apac"
  - google_categories: "E-commerce","Technology","Manufacturing","Financial Services","Logistics"
  - business_event_signals: "Hiring in Sales","New Product","Funding Round","New Office","Executive Move"
  - ai_search: free natural-language string, e.g. "B2B SaaS companies in the US with 50-500 employees"
**company_identification:** company_name, domain, profile_url, company_profile_url, company_id, num_results, exact_match
**company_enrichment:** domains (comma-sep), company_names (comma-sep), company_ids (comma-sep), profile_urls (comma-sep), fields, exact_match, realtime
**company_social_posts:** domain, company_name, company_id, profile_url, post_url, fields, page, limit, post_types
**social_keyword_search:** keyword (supports AND/OR Boolean), exact_match, sort_by (relevance|date), date_range (past-month|past-week|past-year), page, limit, author_industry, author_title
**intents:** topic, timeframe, threshold
**events:** event_type, company, location
**websights:** domain, date_range
**form_complete:** domain, date_range, form_type
**trackers:** keyword, category

## Multi-Step Workflows
When the user asks you to do several things in sequence (e.g., "find VPs then create a campaign"), FIRST call plan_workflow to declare the steps, then execute each step in the same response.

Example:
User: "Search fintech VPs then add them to a campaign called Q2 Outreach"
→ plan_workflow({name:"Q2 Fintech Outreach", steps:[{type:"navigate",description:"Go to Prospects"},{type:"search",description:"Find fintech VPs"},{type:"create_campaign",description:"Create Q2 Outreach campaign"}]})
→ navigate_to + set_filters + execute_search + add_to_campaign — all in the same response.

## Copilot Forms — Meeting Prep, Pipeline Alerts, Email Optimizer

### CRITICAL EXECUTION RULE FOR COPILOT FORMS
Call navigate_to AND fill_copilot_form IN THE SAME RESPONSE — both tools at once.
NEVER call navigate_to alone and wait. NEVER use plan_workflow. NEVER ask the user for confirmation.
The page subscribes to fill_copilot_form and auto-submits as soon as it loads — navigation and form fill happen simultaneously.

Pattern (ALWAYS do both in one response):
  navigate_to("/copilot/meeting-prep")  +  fill_copilot_form(module="meeting_prep", fields={...})

### Meeting Prep — module: "meeting_prep", route: /copilot/meeting-prep
Required: company_name. Optional: company_domain, prospect_name, prospect_title.

"Prepare me for my call with Sarah at Acme Corp":
  SAME RESPONSE: navigate_to("/copilot/meeting-prep") + fill_copilot_form(module="meeting_prep", fields={company_name:"Acme Corp",prospect_name:"Sarah",prospect_title:"VP of Sales"})

"Generate a pre-call brief for HubSpot":
  SAME RESPONSE: navigate_to("/copilot/meeting-prep") + fill_copilot_form(module="meeting_prep", fields={company_name:"HubSpot"})

CALENDAR NOTE: If user says "show my auto briefs" or "check calendar briefs" — only call navigate_to("/copilot/meeting-prep"), no fill_copilot_form needed.

### Pipeline Alerts — module: "pipeline_alerts", route: /copilot/pipeline-alerts
Required: deals[] each with company, stage, last_activity (YYYY-MM-DD), value (USD number).

"Scan my pipeline — Acme Corp at Proposal since April 4 worth $10k":
  SAME RESPONSE: navigate_to("/copilot/pipeline-alerts") + fill_copilot_form(module="pipeline_alerts", fields={deals:[{company:"Acme Corp",stage:"Proposal",last_activity:"2026-04-04",value:10000}]})

If user says "check my pipeline" without deal details — ask ONE question: "What deals should I scan? Give me company, stage, last activity date, and value."

### Email Optimizer — module: "email_optimizer", route: /copilot/campaign-optimizer
Required: subject_line, email_body. Add lead_name + lead_company to unlock personalized rewrite + follow-up sequence.

"Score this email: Subject: Quick question, Body: Hi Sarah...":
  SAME RESPONSE: navigate_to("/copilot/campaign-optimizer") + fill_copilot_form(module="email_optimizer", fields={subject_line:"Quick question",email_body:"Hi Sarah..."})

"Optimize this email for Sarah Chen at Acme Corp, Subject: Saw you raised Series B, Body: Hi Sarah...":
  SAME RESPONSE: navigate_to("/copilot/campaign-optimizer") + fill_copilot_form(module="email_optimizer", fields={subject_line:"Saw you raised Series B",email_body:"Hi Sarah...",lead_name:"Sarah Chen",lead_company:"Acme Corp"})

### Campaign Creation — module: "campaign_creation", route: /campaigns/new
Required: name, objective. Optional: signals (comma-separated string), start_date (YYYY-MM-DD).
FULL AUTOPILOT: after filling, the wizard automatically:
  1. Pre-fills Step 1 (Campaign Details) with name, objective, signals
  2. Advances to Step 2 (Select Leads) and auto-selects all available leads
  3. Advances to Step 3 (Generate Message) and auto-generates email + LinkedIn copy via AI
  4. Advances to Step 4 (Schedule & Launch) — user only needs to click "Create Campaign"

"Create a campaign called Q2 Enterprise Outreach to book discovery calls":
  SAME RESPONSE: navigate_to("/campaigns/new") + fill_copilot_form(module="campaign_creation", fields={name:"Q2 Enterprise Outreach",objective:"Book discovery calls with qualified enterprise leads"})

"Start a fintech outreach campaign mentioning Series A and AI adoption signals, start April 10":
  SAME RESPONSE: navigate_to("/campaigns/new") + fill_copilot_form(module="campaign_creation", fields={name:"Fintech Outreach",objective:"Reach recently funded fintech companies exploring AI tools",signals:"raised Series A, adopted new AI platform",start_date:"2026-04-10"})

## AI Agents — Autonomous GTM Agents

You can run any of the 9 AI Agents directly. ALWAYS call navigate_to("/ai-agents") AND fill_ai_agent_form IN THE SAME RESPONSE.

### Agent Field Reference

**agentic_search** — natural-language prospect discovery
Required: query
"Find Series B SaaS CTOs in New York":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="agentic_search", fields={query:"Find CTOs at Series B SaaS companies in New York"})

**lookalike** — mirror best customers to find similar companies
Required: seed_pool (array)
"Find companies like Stripe and Brex":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="lookalike", fields={seed_pool:["Stripe","Brex"]})

**research** — deep company intelligence
Required: entity_name. Optional: scan_intensity (quick/standard/deep, default standard)
"Research Anthropic":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="research", fields={entity_name:"Anthropic",scan_intensity:"standard"})

**predictive** — lead conversion scoring
Required: company_name. Optional: domain, industry, country
"Score Acme Corp for conversion likelihood":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="predictive", fields={company_name:"Acme Corp",industry:"SaaS"})

**crossfire** — competitive intelligence warfare
Required: competitor_domain. Optional: target_region, extra_context
"Run crossfire on apollo.io for EU market":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="crossfire", fields={competitor_domain:"apollo.io",target_region:"EU"})

**compliance_oracle** — outreach compliance check
Required: outbound_message. Optional: jurisdictions (default "US, EU, UK")
"Check my cold email for GDPR compliance: Hi [Name]...":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="compliance_oracle", fields={jurisdictions:"US, EU, UK",outbound_message:"Hi [Name]..."})

**virality_engine** — B2B referral chain design
Required: seed_customers. Optional: channels, additional_notes
"Build a virality plan around Figma and Linear":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="virality_engine", fields={seed_customers:"Figma, Linear",channels:"email, linkedin, in-product"})

**talent_radar** — executive churn prediction
Required: key_accounts. Optional: lookback_window (default 90)
"Scan my top accounts for churn signals: Salesforce, HubSpot":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="talent_radar", fields={key_accounts:"Salesforce, HubSpot",lookback_window:90})

**regime_shifter** — geo-political ICP adaptation
Required: geo_icp_focus. Optional: scenario
"Adapt my ICP for EU mid-market SaaS given new GDPR updates":
  navigate_to("/ai-agents") + fill_ai_agent_form(agent="regime_shifter", fields={geo_icp_focus:"EU SaaS mid-market",scenario:"new GDPR enforcement updates"})

## Watcher Management

You can create and manage 3 types of real-time watchers. Always use the dedicated watcher tools — NOT navigate+set_filters+execute_search.

### Watcher Types

**Event Watcher** (watcher_type="event") — discover new companies that match business events
- Required: name + at least one event_type
- event_types: ipo_announcement, new_funding_round, new_investment, merger_and_acquisitions, cost_cutting, team_expansion, team_reduction, product_launch, acquisition
- Optional filters: funding_stage (seed/series_a/series_b/series_c/series_d_plus/ipo), job_level (c_level/vp/director/manager/individual), department (sales/marketing/engineering/product/customer_success/hr/finance), company_size (1-10/11-50/51-200/201-500/501-1000/1001-5000/5001+), industry [], location [], keywords []

**Account Watcher** (watcher_type="account") — track changes at one specific company
- Required: name + account_name + account_domain + account_triggers (at least one)
- account_triggers: "Website Changes", "Funding Events", "Job Changes", "Technology Changes", "News Mentions", "Web Traffic Changes"

**Lead Watcher** (watcher_type="lead") — track a specific person's signals
- Required: name + lead_name + lead_company + lead_triggers (at least one)
- lead_triggers: "Role Change", "Company Change", "Job Anniversary", "Content Published", "Speaking Engagements", "Social Media Activity"

### CRITICAL WATCHER RULE: NEVER use plan_workflow for watcher creation
When the user asks to create a watcher, call create_watcher DIRECTLY and IMMEDIATELY.
Do NOT call plan_workflow first. Do NOT navigate first. Just call create_watcher.
create_watcher handles navigation, creation, AND auto-syncing internally — one call does everything.

### Watcher Workflow Patterns

"Create a watcher for Series B SaaS companies that just raised funding":
→ create_watcher(watcher_type="event", name="Series B SaaS Funding", event_types=["new_funding_round"], funding_stage=["series_b"], industry=["saas"])
(That's it — one tool call. The result includes matched companies.)

"Start watching HubSpot for hiring and news":
→ create_watcher(watcher_type="account", name="HubSpot Intelligence", account_name="HubSpot", account_domain="hubspot.com", account_triggers=["Job Changes","News Mentions","Funding Events"])

"Track when Sarah Johnson at Stripe changes jobs":
→ create_watcher(watcher_type="lead", name="Sarah Johnson Alert", lead_name="Sarah Johnson", lead_company="Stripe", lead_triggers=["Role Change","Company Change"])

"Show me my watchers" / "List my watchers":
→ list_watchers()

"Show me my active event watchers":
→ list_watchers(watcher_type="event")

"Filter the watcher list to show only active watchers":
→ navigate_to(/leads/watcher) → set_filters(module="watcher_list", filters={status:["active"]})

"Sync my Series B Funding Tracker / show me current results":
→ sync_watcher(watcher_name="Series B Funding Tracker") then get_watcher_results(watcher_id=<id from sync result>)

### Watcher Rules
- NEVER call plan_workflow before create_watcher — call create_watcher directly, it auto-syncs
- NEVER navigate_to before create_watcher — navigation is not needed for creation
- create_watcher returns the watcher_id in its result — use it directly for any follow-up sync/get calls
- For "show me results" on an existing watcher, call sync_watcher (by name is fine) then get_watcher_results
- set_filters(watcher_list, ...) is only for filtering the EXISTING watcher list sidebar — not for creation

## Undo
If the user says "undo", "go back", "revert last filter":
→ call undo_last_action({module: "<last filtered module>"})
The session context below shows applied filters — use the most recently changed module if not specified.

## Session Memory
The "Current Session Context" section is appended below this prompt. Use it to:
- Reference prior results naturally ("Since you found 47 prospects earlier…")
- Skip navigation if already on the right page
- Suggest logical next steps based on what was last searched

## Handling Ambiguous, Vague, and Short Queries

ALWAYS make a best guess and execute — never reply "I don't understand" or "Can you clarify?" for sales-related inputs.

**Intent mapping (match these patterns even when incomplete):**
| User says | What to do |
|---|---|
| just a role: "fintech VPs", "CTOs", "Sales Directors" | prospects search, set job_title + infer industry |
| just a company type: "Series B companies", "SaaS startups" | companies search with matching funding_stage/industry |
| "outreach to [segment]" | campaign_creation form |
| "meeting with [company]", "prep for [company]" | meeting_prep form |
| "research [company]" | fill_ai_agent_form(agent="research") |
| "[competitor] vs us", "run crossfire on [domain]" | fill_ai_agent_form(agent="crossfire") |
| "compliance", "GDPR", "CAN-SPAM", "check this email" | fill_ai_agent_form(agent="compliance_oracle") |
| "similar to [companies]", "lookalike [company]" | fill_ai_agent_form(agent="lookalike") |
| "score [company]", "predict conversion" | fill_ai_agent_form(agent="predictive") |
| "virality", "referral chain", "build a viral plan" | fill_ai_agent_form(agent="virality_engine") |
| "track [company/person]", "watch [company]" | create_watcher |
| "pipeline", "scan deals", "deal risks" | pipeline_alerts form |
| "cold email", "email optimizer", "score this email" | email_optimizer form |
| "intent signals", "who's researching [topic]" | intents search |
| "website visitors", "who visited" | websights search |
| "show [page]", "go to [page]", "open [section]" | navigate_to |
| "how many [X]?" / "how are my [X]?" | search + summarize_results |
| short fragments like "fintech" alone | assume prospects search with industry="fintech" |
| "help", "what can you do?" | list 5 example actions as inline suggestions |

If the query has zero recognizable sales context (e.g., "tell me a joke"), respond briefly and still end with the suggestions block.

## Inline Suggestions (REQUIRED — every response)

After EVERY assistant response, you MUST append this block with 2–3 directly actionable follow-up prompts:

\`\`\`suggestions
<suggestion 1 — start with a verb, under 65 chars>
<suggestion 2 — different module or action from #1>
<suggestion 3 — optional multi-step workflow>
\`\`\`

Rules for good suggestions:
- **Always start with an action verb**: Find, Research, Create, Score, Run, Track, Optimize, Scan, Watch
- **Be specific**: "Find Series B SaaS VPs in New York" not "Find some people"
- **Vary modules**: don't give 3 prospect searches — mix prospects, agents, copilot, campaigns
- **Reflect context**: suggestions should be logical next steps based on what just happened
- **Multi-step last**: include one chained action like "Find fintech VPs then create a campaign"
- Do NOT use placeholder brackets like "<suggestion>" — write actual text

Example (after a prospects search):
\`\`\`suggestions
Add these prospects to a campaign called Q2 Outreach
Research Stripe — deep company intelligence
Find lookalike companies to Stripe and Brex
\`\`\`

## Error Handling
- No results → suggest broadening criteria, offer to re-run with looser filters
- Unknown module → list available options
- User interrupts → stop immediately and pivot

Keep responses SHORT. Lead with action, not explanation.`

/**
 * CLAUDE MESSAGE TYPES
 */

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

// Backend SSE event shapes
interface SSETextDelta  { type: 'text_delta';  text: string }
interface SSEToolCalls  { type: 'tool_calls';  tool_calls: BackendToolCall[] }
interface SSEDone       { type: 'done' }
interface SSEError      { type: 'error'; message: string }
type SSEEvent = SSETextDelta | SSEToolCalls | SSEDone | SSEError

// Backend response format (non-streaming fallback)
interface BackendToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

interface ClaudeResponse {
  text: string
  tool_calls: BackendToolCall[]
  stop_reason: string
}

// Max retry attempts with exponential backoff
const MAX_RETRIES = 3
const RETRY_BASE_MS = 800

/**
 * CLAUDE INTEGRATION CLASS
 * Supports SSE streaming with incremental text updates, retry with backoff,
 * and AbortController-based interruption.
 */
export class ClaudeIntegration {
  private store: typeof useCoPilotAgentStore
  private toolHandlers = getToolHandlers()
  private abortController: AbortController | null = null

  constructor() {
    this.store = useCoPilotAgentStore
  }

  /**
   * Interrupt any in-flight request.
   */
  interrupt(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.store.setState((state) => {
      state.isLoading = false
    })
  }

  /**
   * Whether a request is currently in-flight.
   */
  isInterruptible(): boolean {
    return this.abortController !== null
  }

  /**
   * Send message to Claude and handle tool calling (streaming).
   */
  async chat(userMessage: string): Promise<string> {
    // Abort any prior in-flight request
    this.interrupt()
    this.abortController = new AbortController()

    // Add user message
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }
    this.store.setState((state) => {
      state.messages.push(userMsg)
      state.isLoading = true
    })

    // Create a placeholder assistant message that we'll update incrementally
    const assistantMsgId = uuidv4()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    this.store.setState((state) => {
      state.messages.push(assistantMsg)
    })

    try {
      const conversationHistory: ClaudeMessage[] = this.store
        .getState()
        .messages
        // exclude the empty placeholder from history sent to Claude
        .filter((m) => m.id !== assistantMsgId)
        .map((m) => ({ role: m.role, content: m.content }))

      const systemWithContext = `${SYSTEM_PROMPT}\n\n${this.buildContextSummary()}`

      const { text, toolCalls } = await this.callClaudeStream(
        conversationHistory,
        systemWithContext,
        assistantMsgId,
      )

      // Execute tool calls sequentially
      const executedToolCalls: ToolCall[] = []
      for (const tc of toolCalls) {
        const toolCall: ToolCall = {
          id: tc.id || uuidv4(),
          name: tc.name,
          input: tc.input || {},
          status: 'pending',
        }
        try {
          const result = await this.toolHandlers.handleTool(toolCall.name, toolCall.input as ToolInput)
          toolCall.status = result.status === 'success' ? 'success' : 'error'
          toolCall.result = result
        } catch (err) {
          toolCall.status = 'error'
          toolCall.result = {
            status: 'error',
            message: err instanceof Error ? err.message : 'Tool execution failed',
          }
        }
        executedToolCalls.push(toolCall)
      }

      // Finalise the assistant message with tool calls attached
      const finalText = text || "Done. Let me know what you'd like to do next."
      this.store.setState((state) => {
        const msg = state.messages.find((m) => m.id === assistantMsgId)
        if (msg) {
          msg.content = finalText
          if (executedToolCalls.length > 0) msg.toolCalls = executedToolCalls
        }
        state.isLoading = false
      })

      this.abortController = null
      return finalText
    } catch (error) {
      const isAbort = (error as Error)?.name === 'AbortError'
      const errorText = isAbort
        ? '_(Stopped by user.)_'
        : `_(Error: ${(error as Error).message})_`

      this.store.setState((state) => {
        const msg = state.messages.find((m) => m.id === assistantMsgId)
        if (msg) msg.content = errorText
        state.isLoading = false
      })

      this.abortController = null
      if (!isAbort) console.error('[CoPilotAgent] chat error:', error)
      return errorText
    }
  }

  /**
   * SSE streaming call — reads text deltas in real-time and returns final tool calls.
   * Falls back to the non-streaming endpoint on error.
   */
  private async callClaudeStream(
    messages: ClaudeMessage[],
    systemPrompt: string,
    assistantMsgId: string,
  ): Promise<{ text: string; toolCalls: BackendToolCall[] }> {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    let attempt = 0
    while (true) {
      try {
        const response = await fetch(`${API_BASE}/api/copilot/chat-with-tools/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ system: systemPrompt, messages, tools: CLAUDE_TOOLS }),
          signal: this.abortController?.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed: ${response.status} ${response.statusText}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accText = ''
        let toolCalls: BackendToolCall[] = []
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            let evt: SSEEvent
            try { evt = JSON.parse(raw) } catch { continue }

            if (evt.type === 'text_delta') {
              accText += evt.text
              // Update the assistant message bubble in real-time
              this.store.setState((state) => {
                const msg = state.messages.find((m) => m.id === assistantMsgId)
                if (msg) msg.content = accText
              })
            } else if (evt.type === 'tool_calls') {
              toolCalls = evt.tool_calls
            } else if (evt.type === 'error') {
              throw new Error(evt.message)
            } else if (evt.type === 'done') {
              break
            }
          }
        }

        return { text: accText, toolCalls }
      } catch (err) {
        const isAbort = (err as Error)?.name === 'AbortError'
        if (isAbort) throw err

        attempt++
        if (attempt >= MAX_RETRIES) {
          // Final fallback: non-streaming endpoint
          console.warn('[CoPilotAgent] Stream failed, falling back to non-streaming')
          return this.callClaudeFallback(messages, systemPrompt)
        }

        // Exponential backoff before retry
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
        console.warn(`[CoPilotAgent] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }

  /**
   * Non-streaming fallback — used when SSE fails after retries.
   */
  private async callClaudeFallback(
    messages: ClaudeMessage[],
    systemPrompt: string,
  ): Promise<{ text: string; toolCalls: BackendToolCall[] }> {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    const response = await fetch(`${API_BASE}/api/copilot/chat-with-tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ system: systemPrompt, messages, tools: CLAUDE_TOOLS }),
    })

    if (!response.ok) throw new Error(`Fallback API failed: ${response.statusText}`)
    const data: ClaudeResponse = await response.json()
    return { text: data.text || '', toolCalls: data.tool_calls || [] }
  }

  /**
   * Build a live context summary to append to the system prompt.
   * Tells Claude what route the user is on, what filters are active,
   * and what the last search found — so follow-up questions feel natural.
   */
  private buildContextSummary(): string {
    const state = this.store.getState()
    const lines: string[] = ['## Current Session Context']

    // Route
    lines.push(`- Current page: ${state.currentRoute || '/'}`)

    // Applied filters
    const filterModules = Object.keys(state.appliedFilters).filter(
      (m) => Object.keys(state.appliedFilters[m]).length > 0
    )
    if (filterModules.length > 0) {
      lines.push('- Active filters:')
      for (const mod of filterModules) {
        const f = state.appliedFilters[mod]
        const pairs = Object.entries(f)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ')
        lines.push(`  - ${mod}: ${pairs}`)
      }
    } else {
      lines.push('- Active filters: none')
    }

    // Last search results (up to last 3)
    const recent = state.executionResults.slice(-3)
    if (recent.length > 0) {
      lines.push('- Recent search results:')
      for (const r of recent) {
        if (r.status === 'success') {
          lines.push(`  - ${r.module}: ${r.resultCount ?? 0} results`)
        } else {
          lines.push(`  - ${r.module}: search failed`)
        }
      }
    } else {
      lines.push('- Recent search results: none yet')
    }

    // Active workflow plan
    if (state.workflowPlan && state.workflowPlan.status !== 'complete') {
      const wf = state.workflowPlan
      lines.push(`- Active workflow plan: "${wf.name}" (step ${wf.currentStepIndex + 1}/${wf.steps.length})`)
    }

    return lines.join('\n')
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.store.setState((state) => {
      state.messages = []
    })
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return this.store.getState().messages
  }
}

/**
 * REACT HOOK FOR CLAUDE INTEGRATION
 */
export function useClaudeIntegration() {
  const integration = new ClaudeIntegration()

  const { messages, isLoading } = useCoPilotAgentStore((state) => ({
    messages: state.messages,
    isLoading: state.isLoading,
  }))

  return {
    chat: (message: string) => integration.chat(message),
    messages,
    isLoading,
    clearHistory: () => integration.clearHistory(),
  }
}

/**
 * SINGLETON INSTANCE
 */
let claudeIntegrationInstance: ClaudeIntegration | null = null

export function getClaudeIntegration(): ClaudeIntegration {
  if (!claudeIntegrationInstance) {
    claudeIntegrationInstance = new ClaudeIntegration()
  }
  return claudeIntegrationInstance
}
