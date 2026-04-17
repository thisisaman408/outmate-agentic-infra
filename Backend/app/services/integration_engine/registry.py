"""
Integration Registry — seeds and manages the catalog of all integrations.

The catalog is seeded to the DB at startup if missing.
Connectors are lazily loaded for integrations that have active Python implementations.
"""

import logging
import uuid as _uuid
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.integration import Integration, UserIntegration

logger = logging.getLogger(__name__)


# ── The full 107-integration catalog ────────────────────────────────
# Each entry: (slug, name, category, short_description, auth_type, is_active, is_coming_soon, is_built_in, credit_cost)

INTEGRATION_CATALOG: List[Dict] = [
    # ── Category 1: Data Enrichment (15) ───────────────────────────
    {"slug": "explorium", "name": "Explorium", "category": "enrichment", "short_description": "Business search, firmographics, technographics, intent data & funding events", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "1-3 credits/query"},
    {"slug": "crustdata", "name": "Crustdata", "category": "enrichment", "short_description": "Company & prospect search with LinkedIn data and enrichment", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "1-2 credits/query"},
    {"slug": "contactout", "name": "ContactOut", "category": "enrichment", "short_description": "Email & phone reveal, decision maker search, company enrichment", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "2 credits/reveal"},
    {"slug": "bettercontact", "name": "BetterContact", "category": "enrichment", "short_description": "Waterfall email & phone verification across 20+ providers", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "1 credit/verify"},
    {"slug": "enrich-so", "name": "Enrich.so", "category": "enrichment", "short_description": "LinkedIn profile enrichment with company & contact data", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "1 credit/enrich"},
    {"slug": "brightdata", "name": "Brightdata", "category": "enrichment", "short_description": "Web scraping at scale for prospect & company data", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "Per request"},
    {"slug": "ipinfo", "name": "IPinfo", "category": "enrichment", "short_description": "IP geolocation for visitor identification and company matching", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "Free 50k/mo"},
    {"slug": "apollo", "name": "Apollo.io", "category": "enrichment", "short_description": "People & company search with verified emails and direct dials", "auth_type": "api_key", "is_active": True, "credit_cost": "BYOK"},
    {"slug": "hunter", "name": "Hunter.io", "category": "enrichment", "short_description": "Domain-based email finder and verification", "auth_type": "api_key", "is_active": True, "credit_cost": "BYOK"},
    {"slug": "clearbit", "name": "Clearbit (Breeze)", "category": "enrichment", "short_description": "Real-time enrichment for leads and companies", "auth_type": "api_key", "is_active": True, "credit_cost": "BYOK"},
    {"slug": "snov-io", "name": "Snov.io", "category": "enrichment", "short_description": "Email finder, verifier, and drip campaign tool", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "rocketreach", "name": "RocketReach", "category": "enrichment", "short_description": "Professional contact information for 700M+ profiles", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "lusha", "name": "Lusha", "category": "enrichment", "short_description": "B2B contact & company data enrichment platform", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "kaspr", "name": "Kaspr", "category": "enrichment", "short_description": "LinkedIn contact data extraction and enrichment", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "builtwith", "name": "BuiltWith", "category": "enrichment", "short_description": "Technographic data — see what technologies websites use", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},

    # ── Category 2: CRM (12) ───────────────────────────────────────
    {"slug": "salesforce", "name": "Salesforce", "category": "crm", "short_description": "Sync leads, contacts, and opportunities with Salesforce CRM", "auth_type": "oauth2", "is_active": True, "is_coming_soon": False, "credit_cost": "Free",
     "setup_steps": [
         "Go to Salesforce Setup → Apps → App Manager → New Connected App",
         "Or use Setup → My Personal Information → Reset Security Token",
         "Copy your access token and paste it in Outmate to connect",
     ],
     "features": ["API key or OAuth connection", "Lead & company sync", "Push from any table"],
    },
    {"slug": "hubspot", "name": "HubSpot", "category": "crm", "short_description": "Bi-directional sync with HubSpot CRM contacts, companies & deals", "auth_type": "oauth2", "is_active": True, "is_coming_soon": False, "credit_cost": "Free",
     "setup_steps": [
         "Go to HubSpot → Settings → Integrations → Private Apps",
         "Create a new private app and copy the access token",
         "Paste the token in Outmate to connect",
     ],
     "features": ["API key or OAuth connection", "Contact & company sync", "Push from any table"],
    },
    {"slug": "pipedrive", "name": "Pipedrive", "category": "crm", "short_description": "Push enriched leads to Pipedrive and sync deal stages", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "zoho-crm", "name": "Zoho CRM", "category": "crm", "short_description": "Connect with Zoho CRM for lead and contact management", "auth_type": "oauth2", "is_active": True, "is_coming_soon": False, "credit_cost": "Free",
     "setup_steps": [
         "Go to Zoho API Console → Self Client → Generate token",
         "Use scope ZohoCRM.modules.ALL for full access",
         "Copy the access token and paste it in Outmate to connect",
     ],
     "features": ["API key or OAuth connection", "Lead & contact sync", "Push from any table"],
    },
    {"slug": "freshsales", "name": "Freshsales", "category": "crm", "short_description": "Sync prospects with Freshworks CRM suite", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "close", "name": "Close.com", "category": "crm", "short_description": "Push leads into Close CRM and track outreach activities", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "copper", "name": "Copper CRM", "category": "crm", "short_description": "Google Workspace-native CRM integration", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "monday-crm", "name": "Monday CRM", "category": "crm", "short_description": "Sync leads with Monday.com CRM boards", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "attio", "name": "Attio", "category": "crm", "short_description": "Next-gen CRM with flexible data model integration", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "dynamics-365", "name": "Microsoft Dynamics 365", "category": "crm", "short_description": "Enterprise CRM integration via Microsoft Graph", "auth_type": "oauth2", "is_active": True, "is_coming_soon": False, "credit_cost": "Free",
     "setup_steps": [
         "Go to Azure AD → App Registrations → Create or select your app",
         "Generate a client secret and obtain an access token",
         "Paste the access token in Outmate to connect",
     ],
     "features": ["API key or OAuth connection", "Contact & account sync", "Push from any table"],
    },
    {"slug": "streak", "name": "Streak", "category": "crm", "short_description": "Gmail-based CRM for pipeline management", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "folk", "name": "Folk CRM", "category": "crm", "short_description": "Lightweight CRM for relationship-focused teams", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 3: Email & Outreach (14) ──────────────────────────
    {"slug": "gmail", "name": "Gmail", "category": "email", "short_description": "Send outreach emails from your Gmail with thread tracking and reply detection", "auth_type": "oauth2", "is_active": True, "is_built_in": True, "credit_cost": "Free"},
    {"slug": "outlook", "name": "Outlook / Office 365", "category": "email", "short_description": "Send and track emails via Microsoft Graph API", "auth_type": "api_key", "is_active": True, "is_coming_soon": False, "credit_cost": "Free",
     "setup_steps": [
         "Go to Azure AD → App Registrations → Register an app",
         "Under API Permissions, add Microsoft Graph → Mail.ReadWrite and Mail.Send",
         "Generate an access token and paste it in Outmate to connect",
     ],
     "features": [
         "Send emails via Microsoft Graph",
         "Read inbox and track replies",
         "Mail folder management",
         "Reply to messages",
     ]},
    {"slug": "smtp", "name": "Custom SMTP", "category": "email", "short_description": "Connect any email provider via SMTP configuration", "auth_type": "smtp", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "instantly", "name": "Instantly", "category": "email", "short_description": "Push prospect lists to Instantly campaigns with analytics sync", "auth_type": "api_key", "is_active": True, "is_coming_soon": False, "credit_cost": "BYOK",
     "setup_steps": [
         "Get your API key from Instantly → Settings → Integrations → API",
         "Paste the key in the connection form below",
         "Click 'Setup Webhooks' to enable real-time event sync",
         "Your suppression list will auto-sync for CAN-SPAM/GDPR compliance",
     ],
     "features": [
         "Campaign creation & management",
         "Bulk lead enrollment (100/batch)",
         "Real-time open/reply/bounce tracking",
         "Automatic unsubscribe sync (CAN-SPAM/GDPR)",
         "Bounce rate monitoring with auto-pause at >5%",
         "Analytics dashboard integration",
     ]},
    {"slug": "lemlist", "name": "Lemlist", "category": "email", "short_description": "Multi-channel outreach sequences with personalization", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "smartlead", "name": "Smartlead", "category": "email", "short_description": "Warm-up, deliverability, and campaign orchestration for cold email", "auth_type": "api_key", "is_active": True, "is_coming_soon": False, "credit_cost": "BYOK",
     "setup_steps": [
         "Get your API key from Smartlead → Settings → API",
         "Paste the key in the connection form below",
         "Click 'Refresh Warm-up' to sync scores",
         "Alerts fire at 80 (warning) and 70 (critical)",
     ],
     "features": [
         "Warm-up score monitoring",
         "Campaign creation & schedule management",
         "Spam rate tracking and auto-pause",
         "Domain rotation at sending limits",
         "Webhook event ingestion",
     ]},
    {"slug": "woodpecker", "name": "Woodpecker", "category": "email", "short_description": "Cold email & follow-up automation for B2B teams", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "reply-io", "name": "Reply.io", "category": "email", "short_description": "AI-first sales engagement and outreach automation", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "mailshake", "name": "Mailshake", "category": "email", "short_description": "Sales engagement with email, phone, and social outreach", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "salesloft", "name": "Salesloft", "category": "email", "short_description": "Revenue orchestration platform with cadence management", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "outreach-io", "name": "Outreach.io", "category": "email", "short_description": "Sales execution platform for pipeline generation", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "sendgrid", "name": "SendGrid", "category": "email", "short_description": "Transactional and marketing email delivery via Twilio SendGrid", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "mailchimp", "name": "Mailchimp", "category": "email", "short_description": "Email marketing and audience management platform", "auth_type": "api_key", "is_active": True, "is_coming_soon": False, "credit_cost": "Free tier",
     "setup_steps": [
         "Go to Mailchimp → Account → Extras → API keys",
         "Click 'Create A Key' and copy the key (format: xxxx-us21)",
         "Paste the API key in Outmate to connect",
     ],
     "features": [
         "Audience/list management",
         "Add contacts to audiences",
         "Campaign analytics (open & click rates)",
         "Batch member import",
     ]},
    {"slug": "mixmax", "name": "Mixmax", "category": "email", "short_description": "Sales engagement platform built for Gmail power users", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "BYOK"},

    # ── Category 4: Communication (10) ─────────────────────────────
    {"slug": "slack", "name": "Slack", "category": "communication", "short_description": "Pipeline alerts, daily briefs, and signal notifications in Slack channels", "auth_type": "oauth2", "is_active": True, "is_built_in": True, "credit_cost": "Free"},
    {"slug": "teams", "name": "Microsoft Teams", "category": "communication", "short_description": "Deliver notifications and alerts to Teams channels", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "linkedin-dm", "name": "LinkedIn DM", "category": "communication", "short_description": "Send connection requests and direct messages via LinkedIn", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "Free"},
    {"slug": "twilio", "name": "Twilio SMS", "category": "communication", "short_description": "Send SMS messages and track delivery for outreach campaigns", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "whatsapp", "name": "WhatsApp Business", "category": "communication", "short_description": "Reach prospects on WhatsApp via Meta Cloud API", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "discord", "name": "Discord", "category": "communication", "short_description": "Send notifications to Discord servers and channels", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "intercom", "name": "Intercom", "category": "communication", "short_description": "Sync prospect data with Intercom for live chat and messaging", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "drift", "name": "Drift", "category": "communication", "short_description": "Connect conversational marketing with prospect intelligence", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "aircall", "name": "Aircall", "category": "communication", "short_description": "Cloud phone system integration for sales calls", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "ringcentral", "name": "RingCentral", "category": "communication", "short_description": "Business communications platform for calls and messaging", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 5: Social & LinkedIn (8) ──────────────────────────
    {"slug": "linkedin", "name": "LinkedIn", "category": "social", "short_description": "Full LinkedIn automation — connections, DMs, profile scraping, activity tracking", "auth_type": "none", "is_active": True, "is_built_in": True, "credit_cost": "Free"},
    {"slug": "linkedin-sales-nav", "name": "LinkedIn Sales Navigator", "category": "social", "short_description": "Enhanced LinkedIn search and lead management via Sales Navigator", "auth_type": "none", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "twitter", "name": "Twitter / X", "category": "social", "short_description": "Monitor prospect tweets and engage on Twitter/X", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "facebook-business", "name": "Facebook Business", "category": "social", "short_description": "Connect with Meta Business Suite for audience insights", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "instagram", "name": "Instagram Business", "category": "social", "short_description": "Social listening and engagement via Instagram Business API", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "phantombuster", "name": "PhantomBuster", "category": "social", "short_description": "Automated data extraction and outreach workflows", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "dripify", "name": "Dripify", "category": "social", "short_description": "LinkedIn automation for prospecting and lead generation", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},
    {"slug": "expandi", "name": "Expandi", "category": "social", "short_description": "Safe LinkedIn outreach automation with smart sequences", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "BYOK"},

    # ── Category 6: Workflow Automation (8) ─────────────────────────
    {"slug": "zapier", "name": "Zapier", "category": "automation", "short_description": "Connect Outmate to 7000+ apps with webhook triggers and actions", "auth_type": "webhook", "is_active": True, "credit_cost": "Free"},
    {"slug": "make", "name": "Make (Integromat)", "category": "automation", "short_description": "Visual workflow automation with powerful data transformation", "auth_type": "webhook", "is_active": True, "credit_cost": "Free"},
    {"slug": "n8n", "name": "n8n", "category": "automation", "short_description": "Self-hosted workflow automation with 400+ integrations", "auth_type": "webhook", "is_active": True, "credit_cost": "Free"},
    {"slug": "webhooks", "name": "Generic Webhooks", "category": "automation", "short_description": "Send real-time event notifications to any URL endpoint", "auth_type": "webhook", "is_active": True, "credit_cost": "Free"},
    {"slug": "rest-api", "name": "Public REST API", "category": "automation", "short_description": "Full API access with key authentication for custom integrations", "auth_type": "api_key", "is_active": True, "credit_cost": "Free"},
    {"slug": "power-automate", "name": "Power Automate", "category": "automation", "short_description": "Microsoft Power Automate integration via webhooks", "auth_type": "webhook", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "tray-io", "name": "Tray.io", "category": "automation", "short_description": "Enterprise automation platform with webhook integration", "auth_type": "webhook", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "workato", "name": "Workato", "category": "automation", "short_description": "Enterprise workflow automation and integration platform", "auth_type": "webhook", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 7: Calendar & Meetings (6) ────────────────────────
    {"slug": "google-calendar", "name": "Google Calendar", "category": "calendar", "short_description": "Auto-prepare for meetings with external attendees and CRM matching", "auth_type": "oauth2", "is_active": True, "is_built_in": True, "credit_cost": "Free"},
    {"slug": "outlook-calendar", "name": "Outlook Calendar", "category": "calendar", "short_description": "Meeting prep and attendee intelligence via Microsoft Calendar", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "calendly", "name": "Calendly", "category": "calendar", "short_description": "Match booked meetings to prospects and trigger prep workflows", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "cal-com", "name": "Cal.com", "category": "calendar", "short_description": "Open-source scheduling with prospect matching and prep", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "zoom", "name": "Zoom", "category": "calendar", "short_description": "Meeting link generation and attendee tracking", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "google-meet", "name": "Google Meet", "category": "calendar", "short_description": "Meeting intelligence via Google Calendar integration", "auth_type": "oauth2", "is_active": True, "is_built_in": True, "credit_cost": "Free"},

    # ── Category 8: Productivity & Storage (10) ────────────────────
    {"slug": "google-sheets", "name": "Google Sheets", "category": "productivity", "short_description": "Export prospect and company lists to Google Sheets automatically", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "airtable", "name": "Airtable", "category": "productivity", "short_description": "Sync enriched data with Airtable bases and automations", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "notion", "name": "Notion", "category": "productivity", "short_description": "Push prospect research and company profiles to Notion databases", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "google-drive", "name": "Google Drive", "category": "productivity", "short_description": "Auto-save exports and reports to Google Drive", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "dropbox", "name": "Dropbox", "category": "productivity", "short_description": "Store and share exports via Dropbox", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "onedrive", "name": "OneDrive", "category": "productivity", "short_description": "Save exports to OneDrive via Microsoft Graph", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "jira", "name": "Jira", "category": "productivity", "short_description": "Create Jira tickets from prospect signals and alerts", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "trello", "name": "Trello", "category": "productivity", "short_description": "Push prospects to Trello boards for pipeline tracking", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "asana", "name": "Asana", "category": "productivity", "short_description": "Create tasks and projects from prospect activity", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "clickup", "name": "ClickUp", "category": "productivity", "short_description": "Sync prospect workflows with ClickUp tasks", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 9: Analytics & Tracking (8) ───────────────────────
    {"slug": "segment", "name": "Segment", "category": "analytics", "short_description": "Send enrichment and engagement events to Segment CDP", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "google-analytics", "name": "Google Analytics", "category": "analytics", "short_description": "Track visitor-to-prospect conversion in Google Analytics", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "mixpanel", "name": "Mixpanel", "category": "analytics", "short_description": "Product analytics integration for prospect behavior tracking", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "posthog", "name": "PostHog", "category": "analytics", "short_description": "Open-source product analytics and feature flags", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "amplitude", "name": "Amplitude", "category": "analytics", "short_description": "Behavioral analytics for prospect engagement patterns", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "heap", "name": "Heap", "category": "analytics", "short_description": "Automatic event capture for prospect journey analysis", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "hotjar", "name": "Hotjar", "category": "analytics", "short_description": "Heatmaps and session recordings for visitor intelligence", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free tier"},
    {"slug": "gtm", "name": "Google Tag Manager", "category": "analytics", "short_description": "Deploy Outmate visitor pixel via GTM container", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 10: Advertising & ABM (10) ────────────────────────
    {"slug": "google-ads", "name": "Google Ads", "category": "advertising", "short_description": "Build customer match audiences from enriched prospect lists", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "linkedin-ads", "name": "LinkedIn Ads", "category": "advertising", "short_description": "Create matched audiences for LinkedIn advertising campaigns", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "meta-ads", "name": "Meta / Facebook Ads", "category": "advertising", "short_description": "Custom audience sync for Facebook and Instagram ads", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "twitter-ads", "name": "Twitter / X Ads", "category": "advertising", "short_description": "Tailored audience lists for Twitter advertising", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "rollworks", "name": "RollWorks", "category": "advertising", "short_description": "ABM platform integration for targeted account campaigns", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "demandbase", "name": "Demandbase", "category": "advertising", "short_description": "Account-based marketing intelligence and targeting", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "6sense", "name": "6sense", "category": "advertising", "short_description": "Predictive intelligence and ABM intent data platform", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "bombora", "name": "Bombora", "category": "advertising", "short_description": "B2B intent data for account-based advertising", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "terminus", "name": "Terminus", "category": "advertising", "short_description": "Multi-channel ABM platform for enterprise targeting", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "metadata-io", "name": "Metadata.io", "category": "advertising", "short_description": "B2B demand generation with AI-powered campaign execution", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},

    # ── Category 11: Customer Success & Support (6) ────────────────
    {"slug": "zendesk", "name": "Zendesk", "category": "support", "short_description": "Enrich support tickets with prospect and company intelligence", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "freshdesk", "name": "Freshdesk", "category": "support", "short_description": "Customer support platform integration with lead context", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "gong", "name": "Gong", "category": "support", "short_description": "Revenue intelligence — sync meeting recordings with prospect data", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "chorus", "name": "Chorus.ai", "category": "support", "short_description": "Conversation intelligence with deal and prospect context", "auth_type": "oauth2", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "gainsight", "name": "Gainsight", "category": "support", "short_description": "Customer success management with enriched account data", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
    {"slug": "churnzero", "name": "ChurnZero", "category": "support", "short_description": "Customer success platform for churn prevention", "auth_type": "api_key", "is_coming_soon": True, "credit_cost": "Free"},
]


class IntegrationRegistry:
    """Manages the integration catalog and user connections."""

    @staticmethod
    def seed_catalog(db: Session) -> int:
        """
        Seed all integrations into the DB if missing. Returns count of new rows added.
        Idempotent — skips existing slugs.
        """
        existing_slugs = {
            row[0] for row in db.query(Integration.slug).all()
        }

        new_count = 0
        for entry in INTEGRATION_CATALOG:
            if entry["slug"] in existing_slugs:
                continue

            integration = Integration(
                slug=entry["slug"],
                name=entry["name"],
                category=entry["category"],
                short_description=entry.get("short_description", ""),
                description=entry.get("description", entry.get("short_description", "")),
                auth_type=entry.get("auth_type", "api_key"),
                is_active=entry.get("is_active", False),
                is_coming_soon=entry.get("is_coming_soon", False),
                is_built_in=entry.get("is_built_in", False),
                credit_cost=entry.get("credit_cost"),
                setup_steps=entry.get("setup_steps", []),
                features=entry.get("features", []),
                icon_url=f"/icons/integrations/{entry['slug']}.svg",
            )
            db.add(integration)
            new_count += 1

        if new_count > 0:
            db.commit()
            logger.info("Seeded %d new integrations into catalog", new_count)

        return new_count

    @staticmethod
    def get_catalog(
        db: Session,
        user_id=None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        include_coming_soon: bool = True,
    ) -> List[Dict]:
        """
        Get the full integration catalog, optionally with per-user connection status.
        """
        query = db.query(Integration)

        if category:
            query = query.filter(Integration.category == category)
        if not include_coming_soon:
            query = query.filter(Integration.is_coming_soon == False)
        if search:
            query = query.filter(
                Integration.name.ilike(f"%{search}%")
                | Integration.short_description.ilike(f"%{search}%")
                | Integration.category.ilike(f"%{search}%")
            )

        integrations = query.order_by(
            Integration.is_coming_soon.asc(),
            Integration.is_active.desc(),
            Integration.name.asc(),
        ).all()

        # Build user connection map if user_id provided
        user_connections = {}
        if user_id:
            connections = (
                db.query(UserIntegration)
                .filter(UserIntegration.user_id == user_id)
                .all()
            )
            user_connections = {
                str(c.integration_id): c for c in connections
            }

        result = []
        for i in integrations:
            conn = user_connections.get(str(i.id))
            result.append({
                "id": str(i.id),
                "slug": i.slug,
                "name": i.name,
                "description": i.description,
                "short_description": i.short_description,
                "category": i.category,
                "icon_url": i.icon_url,
                "auth_type": i.auth_type,
                "is_active": i.is_active,
                "is_coming_soon": i.is_coming_soon,
                "is_premium": i.is_premium,
                "is_built_in": i.is_built_in,
                "credit_cost": i.credit_cost,
                "setup_steps": i.setup_steps,
                "features": i.features,
                # Connection status
                "connection_status": conn.status if conn else ("built_in" if i.is_built_in else "not_connected"),
                "connected_at": conn.connected_at.isoformat() if conn and conn.connected_at else None,
                "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
                "error_message": conn.error_message if conn and conn.status == "error" else None,
            })

        return result

    @staticmethod
    def get_categories(db: Session) -> List[Dict]:
        """Get all categories with integration counts."""
        rows = (
            db.query(
                Integration.category,
                func.count(Integration.id),
            )
            .group_by(Integration.category)
            .order_by(Integration.category)
            .all()
        )
        return [{"category": cat, "count": count} for cat, count in rows]
