"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, Eye, EyeOff, Copy, ExternalLink, Blocks, CheckCircle2, AlertCircle, Loader2, Plus, Grid3X3, Key, ChevronRight, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { integrationsApi } from "@/lib/api/integrations"
import { toast } from "sonner"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type FilterType = "all" | "connected" | "gtm" | "ai"

interface Integration {
  id: string
  name: string
  icon: string
  description: string
  connected: boolean
  badges: Array<"popular" | "new" | "gtm">
  category: string
  syncType?: string
  records?: string
  lastSync?: string
}

const categories = ["CRM", "Outbound & email", "Messaging", "AI models", "Social Media", "Calendar", "Analytics", "Communication", "Productivity", "Enrichment & data"]

// Map backend integration IDs to frontend display config
const integrationConfig: Record<string, Partial<Integration>> = {
  // Email & Outreach
  gmail: { icon: "✉", description: "Email sync, automated outreach, and campaign tracking", category: "Outbound & email", badges: ["popular", "gtm"] },
  outlook: { icon: "📧", description: "Connect each user's Outlook / Office 365 mailbox through Microsoft OAuth", category: "Outbound & email", badges: ["popular"] },
  sendgrid: { icon: "📨", description: "Transactional email delivery and analytics", category: "Outbound & email" },
  smtp: { icon: "🔌", description: "Custom SMTP server for email delivery", category: "Outbound & email" },
  reply_io: { icon: "💬", description: "Email sequence management and reply tracking", category: "Outbound & email" },
  woodpecker: { icon: "🪶", description: "Cold email automation with follow-up sequences", category: "Outbound & email" },
  lemlist: { icon: "📋", description: "Personalized B2B lead generation and outreach", category: "Outbound & email" },
  salesloft: { icon: "🚀", description: "Sales engagement with cadence automation", category: "Outbound & email", badges: ["gtm"] },
  outreach_io: { icon: "📢", description: "Sales engagement platform with analytics", category: "Outbound & email" },
  
  // CRM
  hubspot: { icon: "⊞", description: "Connect each user's own HubSpot portal for CRM sync", category: "CRM", badges: ["popular", "gtm"], syncType: "Bi-directional", records: "12,400" },
  salesforce: { icon: "☁", description: "Enterprise CRM with real-time data synchronization", category: "CRM", badges: ["popular", "gtm"] },
  pipedrive: { icon: "📊", description: "Visual sales pipeline with activity tracking", category: "CRM", badges: ["gtm"] },
  zoho_crm: { icon: "🏢", description: "Complete CRM suite with automation workflows", category: "CRM" },
  close: { icon: "🔒", description: "Simplified CRM for startup sales teams", category: "CRM" },
  freshsales: { icon: "🌱", description: "AI-powered CRM with lead scoring", category: "CRM" },
  monday: { icon: "📅", description: "Work OS with CRM and project management", category: "CRM" },
  streak: { icon: "🔗", description: "CRM directly inside Gmail interface", category: "CRM" },
  
  // Messaging
  slack: { icon: "#", description: "Real-time notifications, alerts, and team collaboration", category: "Messaging", badges: ["popular"] },
  teams: { icon: "👥", description: "Microsoft Teams integration for sales notifications", category: "Messaging", badges: ["popular"] },
  discord: { icon: "🎮", description: "Community engagement and team communication", category: "Messaging" },
  whatsapp: { icon: "📱", description: "WhatsApp Business API for customer communication", category: "Messaging" },
  twilio: { icon: "📞", description: "SMS, voice, and WhatsApp communication platform", category: "Messaging" },
  ringcentral: { icon: "📞", description: "Cloud communications with call tracking", category: "Messaging" },
  
  // Social Media
  linkedin: { icon: "💼", description: "Lead generation, messaging, and social selling", category: "Social Media", badges: ["popular", "gtm"] },
  twitter: { icon: "🐦", description: "Social listening and engagement tracking", category: "Social Media" },
  twitter_ads: { icon: "📢", description: "Twitter advertising campaign management", category: "Social Media" },
  facebook: { icon: "📘", description: "Facebook marketing and lead generation", category: "Social Media" },
  instagram: { icon: "📷", description: "Visual marketing and influencer outreach", category: "Social Media" },
  
  // Enrichment & Data
  brightdata: { icon: "🌟", description: "Premium dataset API for companies and people data", category: "Enrichment & data", badges: ["popular", "gtm", "new"] },
  clearbit: { icon: "💎", description: "Real-time company and contact data enrichment", category: "Enrichment & data", badges: ["gtm"] },
  apollo: { icon: "🚀", description: "B2B database with email and phone verification", category: "Enrichment & data", badges: ["gtm"] },
  zoominfo: { icon: "🔍", description: "B2B intelligence with org charts and technographics", category: "Enrichment & data", badges: ["gtm"] },
  hunter: { icon: "🎯", description: "Email finding with domain-based search", category: "Enrichment & data" },
  rocketreach: { icon: "🚀", description: "Multi-channel contact finding and verification", category: "Enrichment & data" },
  lusha: { icon: "💎", description: "B2B contact data with mobile numbers", category: "Enrichment & data" },
  snov_io: { icon: "❄", description: "Email finder, verifier, and drip campaigns", category: "Enrichment & data" },
  kaspr: { icon: "🔑", description: "LinkedIn-based B2B contact enrichment", category: "Enrichment & data" },
  
  // Calendar
  google_calendar: { icon: "📅", description: "Meeting scheduling and activity tracking", category: "Calendar", badges: ["popular"] },
  outlook_calendar: { icon: "📆", description: "Microsoft calendar integration for sales activities", category: "Calendar" },
  calendly: { icon: "📅", description: "Automated meeting scheduling with CRM sync", category: "Calendar", badges: ["gtm"] },
  
  // Analytics
  google_analytics: { icon: "📈", description: "Website traffic and conversion analytics", category: "Analytics", badges: ["popular"] },
  segment: { icon: "📊", description: "Customer data platform and event tracking", category: "Analytics" },
  mixpanel: { icon: "📊", description: "Product analytics and user behavior tracking", category: "Analytics" },
  amplitude: { icon: "📊", description: "Digital product analytics and cohort analysis", category: "Analytics" },
  
  // Communication
  intercom: { icon: "💬", description: "Live chat and customer messaging automation", category: "Communication" },
  zendesk: { icon: "🎫", description: "Customer support with ticket management", category: "Communication" },
  helpscout: { icon: "💁", description: "Help desk with knowledge base integration", category: "Communication" },
  
  // Productivity
  notion: { icon: "📝", description: "Knowledge base and documentation management", category: "Productivity", badges: ["popular"] },
  airtable: { icon: "📊", description: "Database automation and workflow management", category: "Productivity" },
  trello: { icon: "📋", description: "Visual project management and task tracking", category: "Productivity" },
  asana: { icon: "✅", description: "Team collaboration and project management", category: "Productivity" },
  
  // Automation
  zapier: { icon: "⚡", description: "Connect 5000+ apps with custom workflows", category: "AI models", badges: ["popular"] },
  make: { icon: "🔧", description: "Visual workflow automation platform", category: "AI models" },
  n8n: { icon: "🔗", description: "Open-source workflow automation", category: "AI models" },
  webhooks: { icon: "🔗", description: "Custom API integrations and real-time data sync", category: "AI models", badges: ["popular"] },
  
  // Outreach (legacy support)
  outreach: { icon: "◈", description: "Multi-platform outreach automation", category: "Outbound & email", badges: ["gtm"] },

  // Additional integrations from reference
  attio: { icon: "◉", description: "Modern CRM contact sync", category: "CRM", badges: ["new", "gtm"] },
  smartlead: { icon: "◈", description: "Multi-channel outbound campaigns", category: "Outbound & email", badges: ["gtm"] },
  instantly: { icon: "→", description: "Cold email at scale", category: "Outbound & email", badges: ["gtm"] },
  unipile: { icon: "◉", description: "Unified LinkedIn + email inbox", category: "Outbound & email", badges: ["new", "gtm"] },
  bettercontact: { icon: "◼", description: "Waterfall contact finding", category: "Enrichment & data", badges: ["gtm"] },
  crustdata: { icon: "◉", description: "Company and people data enrichment", category: "Enrichment & data", badges: ["gtm"] },
  explorium: { icon: "◎", description: "AI-powered data enrichment", category: "Enrichment & data", badges: ["gtm"] },
}

const integrationCapabilities: Record<string, string[]> = {
  // CRM
  hubspot: ["Bi-directional contact sync", "Deal pipeline tracking", "Activity logging", "Custom field mapping"],
  salesforce: ["Real-time data sync", "Lead & opportunity management", "Custom object mapping", "Workflow automation"],
  pipedrive: ["Pipeline visualization", "Activity tracking", "Deal management", "Contact enrichment"],
  zoho_crm: ["Multi-module sync", "Workflow automation", "Contact management", "Custom fields"],
  close: ["Call logging", "Email sequence sync", "Pipeline management", "Reporting integration"],
  freshsales: ["AI lead scoring sync", "Contact enrichment", "Deal tracking", "Activity capture"],
  monday: ["Board integration", "Status sync", "Contact management", "Automation triggers"],
  streak: ["Gmail CRM sync", "Pipeline tracking", "Mail merge", "Activity timeline"],
  attio: ["Contact sync", "Relationship intelligence", "Deal tracking", "Custom attributes"],

  // Outbound & email
  gmail: ["Email send & receive", "Thread tracking", "Campaign sequences", "Open & click analytics"],
  outlook: ["Email automation", "Calendar integration", "Contact sync", "Activity tracking"],
  sendgrid: ["Transactional emails", "Delivery analytics", "Template management", "Bounce handling"],
  smtp: ["Custom email delivery", "DKIM/SPF validation", "Delivery tracking", "IP reputation"],
  reply_io: ["Multi-channel sequences", "Reply detection", "A/B testing", "Team collaboration"],
  woodpecker: ["Cold email automation", "Follow-up sequences", "Bounce detection", "Deliverability tools"],
  lemlist: ["Personalized outreach", "Image personalization", "Multi-channel campaigns", "A/B testing"],
  salesloft: ["Cadence automation", "Call dialing", "Analytics dashboard", "Team performance"],
  outreach_io: ["Sales engagement", "Sequence automation", "Call recording", "Revenue intelligence"],
  outreach: ["Multi-platform outreach", "Sequence management", "Reply tracking", "Performance analytics"],
  smartlead: ["Unlimited mailboxes", "Auto-rotation", "Warm-up", "Unified inbox"],
  instantly: ["Email warm-up", "Deliverability boost", "Campaign analytics", "Lead management"],
  unipile: ["Unified LinkedIn inbox", "Email aggregation", "Multi-account support", "Message scheduling"],

  // Messaging
  slack: ["Channel notifications", "Deal alerts", "Team mentions", "Workflow triggers"],
  teams: ["Sales notifications", "Meeting scheduling", "Channel integration", "Bot automation"],
  discord: ["Server notifications", "Role-based alerts", "Bot integration", "Webhook support"],
  whatsapp: ["Business messaging", "Template messages", "Media sharing", "Chatbot support"],
  twilio: ["SMS campaigns", "Voice calls", "WhatsApp API", "Call analytics"],
  ringcentral: ["Call tracking", "SMS messaging", "Video meetings", "Call recording"],

  // Social Media
  linkedin: ["Profile enrichment", "InMail automation", "Connection requests", "Social selling signals"],
  twitter: ["Social listening", "Engagement tracking", "Lead identification", "Brand monitoring"],
  twitter_ads: ["Ad campaign sync", "Audience targeting", "Conversion tracking", "Budget management"],
  facebook: ["Lead ads sync", "Audience building", "Conversion tracking", "Retargeting"],
  instagram: ["DM automation", "Story engagement", "Influencer tracking", "Content scheduling"],

  // Enrichment & data
  brightdata: ["Premium datasets", "Company intelligence", "People data", "Real-time scraping"],
  clearbit: ["Company enrichment", "Contact enrichment", "Lead scoring", "Form shortening"],
  apollo: ["Email finding", "Phone verification", "Company search", "Sequence automation"],
  zoominfo: ["Org chart mapping", "Technographics", "Intent data", "Contact verification"],
  hunter: ["Domain search", "Email verification", "Bulk finding", "API access"],
  rocketreach: ["Multi-channel lookup", "Email & phone", "Bulk enrichment", "Chrome extension"],
  lusha: ["Direct dials", "Email finding", "Company data", "CRM enrichment"],
  snov_io: ["Email finder", "Verifier", "Drip campaigns", "Technology tracking"],
  kaspr: ["LinkedIn enrichment", "Phone numbers", "Email finding", "Export to CRM"],
  bettercontact: ["Waterfall enrichment", "Multi-provider", "Email cascading", "Phone verification"],
  crustdata: ["Company firmographics", "People search", "Tech stack detection", "Headcount data"],
  explorium: ["AI data discovery", "Signal enrichment", "Predictive analytics", "Custom models"],

  // Calendar
  google_calendar: ["Meeting sync", "Availability sharing", "Activity tracking", "Reminder automation"],
  outlook_calendar: ["Calendar sync", "Meeting tracking", "Room booking", "Activity logging"],
  calendly: ["Auto-scheduling", "CRM sync", "Round-robin", "Intake forms"],

  // Analytics
  google_analytics: ["Traffic analytics", "Conversion tracking", "Goal monitoring", "Audience segments"],
  segment: ["Event tracking", "Data routing", "Identity resolution", "Schema enforcement"],
  mixpanel: ["User analytics", "Funnel analysis", "Retention tracking", "A/B experiments"],
  amplitude: ["Cohort analysis", "Behavioral tracking", "Revenue analytics", "Path analysis"],

  // Communication
  intercom: ["Live chat", "Product tours", "Help center", "Customer segments"],
  zendesk: ["Ticket management", "Help desk", "Knowledge base", "Customer satisfaction"],
  helpscout: ["Shared inbox", "Knowledge base", "Customer profiles", "Reporting"],

  // Productivity
  notion: ["Page sync", "Database integration", "Knowledge base", "Template management"],
  airtable: ["Table sync", "Automation triggers", "View management", "Form integration"],
  trello: ["Card management", "Board sync", "Automation", "Power-Up integration"],
  asana: ["Task sync", "Project tracking", "Timeline management", "Workload balancing"],

  // AI & Automation
  zapier: ["5000+ app connections", "Multi-step workflows", "Conditional logic", "Scheduled triggers"],
  make: ["Visual workflows", "Data transformation", "API integration", "Error handling"],
  n8n: ["Self-hosted workflows", "Custom nodes", "Code execution", "Webhook triggers"],
  webhooks: ["Real-time events", "Custom payloads", "Retry logic", "Signature verification"],
}

const integrationDocs: Record<string, string> = {
  hubspot: "https://developers.hubspot.com/docs/api",
  salesforce: "https://developer.salesforce.com/docs",
  gmail: "https://developers.google.com/gmail/api",
  outlook: "https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview",
  slack: "https://api.slack.com/docs",
  teams: "https://learn.microsoft.com/en-us/microsoftteams/platform",
  linkedin: "https://learn.microsoft.com/en-us/linkedin",
  sendgrid: "https://docs.sendgrid.com",
  twilio: "https://www.twilio.com/docs",
  zapier: "https://platform.zapier.com/docs",
  notion: "https://developers.notion.com",
  google_analytics: "https://developers.google.com/analytics",
  segment: "https://segment.com/docs",
  intercom: "https://developers.intercom.com/docs",
  zendesk: "https://developer.zendesk.com/documentation",
  clearbit: "https://dashboard.clearbit.com/docs",
  apollo: "https://apolloio.github.io/apollo-api-docs",
  zoominfo: "https://api-docs.zoominfo.com",
  pipedrive: "https://developers.pipedrive.com/docs/api/v1",
  calendly: "https://developer.calendly.com/api-docs",
  airtable: "https://airtable.com/developers/web/api",
  mixpanel: "https://developer.mixpanel.com/docs",
}

const slackConnectedFeatures = [
  "Copilot daily briefs",
  "Pipeline alerts",
  "Hot signal notifications",
  "Meeting prep alerts",
  "Watcher alerts",
  "Voice Agent booked-call alerts",
]

export default function IntegrationsPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [selectedId, setSelectedId] = useState<string>("gmail")
  const [showKey, setShowKey] = useState(false)
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; key: string; created: string }>>([])
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null)
  const [instantlyApiKey, setInstantlyApiKey] = useState("")
  const [connectingInstantly, setConnectingInstantly] = useState(false)
  const [integrations, setIntegrations] = useState<any>([])
  const [loading, setLoading] = useState(true)
  const [testingOutreach, setTestingOutreach] = useState(false)
  const [outreachApiKey, setOutreachApiKey] = useState("")
  const [outreachService, setOutreachService] = useState<"instantly" | "smartlead">("instantly")
  const [connectingCrm, setConnectingCrm] = useState<string | null>(null)
  const [crmAuthMethod, setCrmAuthMethod] = useState<"oauth" | "api_key">("oauth")
  const [crmApiKey, setCrmApiKey] = useState("")
  const [crmDescription, setCrmDescription] = useState("")
  const [crmInstanceUrl, setCrmInstanceUrl] = useState("")
  const [crmApiDomain, setCrmApiDomain] = useState("")
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("")
  const [connectingSlackWebhook, setConnectingSlackWebhook] = useState(false)

  // Fetch integrations from API
  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true)
      const status = await integrationsApi.getStatus()
      const mapped = Object.entries(status.integrations).map(([id, int]: [string, any]) => {
        const config = integrationConfig[id] || { icon: "◈", description: int.name, category: "Other", badges: [] }
        return {
          id,
          name: int.name,
          icon: config.icon,
          description: config.description,
          connected: int.connected,
          badges: config.badges || [],
          category: config.category,
          syncType: config.syncType,
          records: config.records,
          lastSync: int.connected ? "Active" : undefined,
        } as Integration
      })
      setIntegrations(mapped)
    } catch (error) {
      console.error("Failed to load integrations:", error)
      toast.error("Failed to load integrations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIntegrations()
  }, [loadIntegrations])

  // Handle CRM connection
  const handleConnectCrm = async (crmId: string) => {
    try {
      setConnectingCrm(crmId)
      if (crmId === "hubspot") {
        const { auth_url } = await integrationsApi.getHubspotAuthUrl()
        const popup = window.open(auth_url, "hubspot-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "salesforce") {
        const { auth_url } = await integrationsApi.getSalesforceAuthUrl()
        const popup = window.open(auth_url, "salesforce-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "zoho_crm") {
        const { auth_url } = await integrationsApi.getZohoCrmAuthUrl()
        const popup = window.open(auth_url, "zoho-crm-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "outlook") {
        const { auth_url } = await integrationsApi.getOutlookAuthUrl()
        const popup = window.open(auth_url, "outlook-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "slack") {
        const { auth_url } = await integrationsApi.getSlackAuthUrl()
        const popup = window.open(auth_url, "slack-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "discord") {
        const { auth_url } = await integrationsApi.getDiscordAuthUrl()
        const popup = window.open(auth_url, "discord-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else if (crmId === "teams") {
        const { auth_url } = await integrationsApi.getTeamsAuthUrl()
        const popup = window.open(auth_url, "teams-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
      } else {
        return
      }
      setConnectingCrm(null)
    } catch (error: any) {
      toast.error(error.message || `Failed to connect ${crmId}`)
      setConnectingCrm(null)
    }
  }

  // Handle CRM disconnect
  const handleDisconnectCrm = async (crmId: string) => {
    try {
      if (crmId === "hubspot") {
        await integrationsApi.hubspotDisconnect()
      } else if (crmId === "salesforce") {
        await integrationsApi.salesforceDisconnect()
      } else if (crmId === "zoho_crm") {
        await integrationsApi.zohoCrmDisconnect()
      } else if (crmId === "outlook") {
        await integrationsApi.outlookDisconnect()
      } else if (crmId === "slack") {
        await integrationsApi.slackDisconnect()
      } else if (crmId === "discord") {
        await integrationsApi.discordDisconnect()
      } else if (crmId === "teams") {
        await integrationsApi.teamsDisconnect()
      } else if (crmId === "whatsapp") {
        await integrationsApi.whatsappDisconnect()
      } else {
        return
      }
      toast.success(`${crmId.replace("_", " ").toUpperCase()} disconnected successfully`)
      // Refresh integrations list
      loadIntegrations()
    } catch (error: any) {
      toast.error(error.message || `Failed to disconnect ${crmId}`)
    }
  }

  // Handle generic integration connection (for Gmail, etc.)
  const handleConnectGeneric = async (integrationId: string) => {
    try {
      if (integrationId === "gmail") {
        // Use the Google OAuth endpoint for Gmail
        const response = await fetch(`${BACKEND_BASE}/api/v1/auth/google/auth-url`, {
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("Failed to get Gmail authorization URL")
        }
        const data = await response.json()
        const authUrl = data.auth_url
        // Open OAuth in popup
        const popup = window.open(authUrl, "gmail-oauth-popup", "width=600,height=600")
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              loadIntegrations()
            }
          }, 500)
        }
        toast.success("Gmail authorization started. Please complete it in the popup.")
      } else {
        // For other integrations, try the catalog connect endpoint
        await integrationsApi.connectIntegration(integrationId)
        toast.success(`${integrationId.replace("_", " ").toUpperCase()} authorization started`)
      }
      // Refresh integrations list
      loadIntegrations()
    } catch (error: any) {
      toast.error(error.message || `Failed to connect ${integrationId}`)
    }
  }

  // Handle CRM API key storage
  const handleStoreApiKey = async (crmId: string) => {
    try {
      setSavingApiKey(true)
      if (crmId === "hubspot") {
        await integrationsApi.hubspotStoreApiKey(crmApiKey, crmDescription)
      } else if (crmId === "salesforce") {
        await integrationsApi.salesforceStoreApiKey(crmApiKey, crmDescription, crmInstanceUrl)
      } else if (crmId === "zoho_crm") {
        await integrationsApi.zohoCrmStoreApiKey(crmApiKey, crmDescription, crmApiDomain)
      } else if (crmId === "outlook") {
        await integrationsApi.outlookStoreApiKey(crmApiKey, crmDescription)
      } else {
        return
      }
      toast.success(`${crmId.replace("_", " ").toUpperCase()} API key connected successfully`)
      // Reset form
      setCrmApiKey("")
      setCrmDescription("")
      setCrmInstanceUrl("")
      setCrmApiDomain("")
      // Refresh integrations list
      loadIntegrations()
    } catch (error: any) {
      toast.error(error.message || `Failed to connect ${crmId} API key`)
    } finally {
      setSavingApiKey(false)
    }
  }

  const filtered = useMemo(() => {
    let items = integrations
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (filter === "connected") items = items.filter(i => i.connected)
    if (filter === "gtm") items = items.filter(i => i.badges.includes("gtm"))
    if (filter === "ai") items = items.filter(i => i.category === "AI models")
    return items
  }, [search, filter, integrations])

  const selected = integrations.find(i => i.id === selectedId) || integrations[0]

  // Handle outreach connection test
  const handleTestOutreach = async () => {
    if (!outreachApiKey.trim()) {
      toast.error("Please enter an API key")
      return
    }
    setTestingOutreach(true)
    try {
      const result = await integrationsApi.testOutreach({
        service: outreachService,
        api_key: outreachApiKey,
      })
      if (result.success) {
        toast.success(result.message)
        // Refresh integrations list
        const status = await integrationsApi.getStatus()
        const mapped = Object.entries(status.integrations).map(([id, int]: [string, any]) => {
          const config = integrationConfig[id] || { icon: "◈", description: int.name, category: "Other", badges: [] }
          return {
            id,
            name: int.name,
            icon: config.icon,
            description: config.description,
            connected: int.connected,
            badges: config.badges || [],
            category: config.category,
            syncType: config.syncType,
            records: config.records,
            lastSync: int.connected ? "Active" : undefined,
          } as Integration
        })
        setIntegrations(mapped)
      } else {
        toast.error(result.message)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to test connection")
    } finally {
      setTestingOutreach(false)
    }
  }

  // Handle skip integration
  const handleSkip = async (service: string) => {
    try {
      await integrationsApi.skipIntegration(service)
      toast.success(`Skipped ${service}`)
      // Refresh list
      const status = await integrationsApi.getStatus()
      const mapped = Object.entries(status.integrations).map(([id, int]: [string, any]) => {
        const config = integrationConfig[id] || { icon: "◈", description: int.name, category: "Other", badges: [] }
        return {
          id,
          name: int.name,
          icon: config.icon,
          description: config.description,
          connected: int.connected,
          badges: config.badges || [],
          category: config.category,
          syncType: config.syncType,
          records: config.records,
          lastSync: int.connected ? "Active" : undefined,
        } as Integration
      })
      setIntegrations(mapped)
    } catch (error: any) {
      toast.error(error.message || "Failed to skip")
    }
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left List */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Search Bar + Filter Tabs */}
        <div className="px-6 py-4 border-b border-border bg-background">
           <div className="flex items-center gap-4">
              <div className="relative group flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                 <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search integrations and APIs..."
                    className="pl-10 h-10 bg-background border-border focus:border-primary/40 text-sm rounded-lg"
                 />
              </div>
              <div className="flex items-center gap-1">
                 {([
                   { key: "all", label: "All" },
                   { key: "connected", label: "Connected" },
                   { key: "gtm", label: "GTM" },
                   { key: "ai", label: "AI Models" },
                 ] as const).map(({ key, label }) => (
                    <button
                       key={key}
                       onClick={() => setFilter(key as FilterType)}
                       className={cn(
                          "px-3.5 py-1.5 text-[12px] font-medium rounded-full transition-all",
                          filter === key ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                       )}
                    >
                       {label}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Catalog */}
        <div className="flex-1 overflow-auto no-scrollbar">
           {loading ? (
             <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
               <Loader2 className="w-8 h-8 animate-spin mb-4" />
               <p className="text-sm font-medium">Loading integrations...</p>
             </div>
           ) : (
           <div className="p-6 space-y-8">
              {/* API Keys Section */}
              {filter === "all" && !search && (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">API keys</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedId("outmate_api")}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                        selectedId === "outmate_api" ? "bg-primary/5 border-primary" : "bg-background border-border hover:border-primary/20"
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold shrink-0">+</div>
                      <div>
                        <div className="text-sm font-semibold">Outmate API</div>
                        <div className="text-xs text-muted-foreground">Access the full platform programmatically</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedId("custom_api_keys")}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                        selectedId === "custom_api_keys" ? "bg-primary/5 border-primary" : "bg-background border-border hover:border-primary/20"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground text-lg shrink-0">▦</div>
                      <div>
                        <div className="text-sm font-semibold">Custom API keys</div>
                        <div className="text-xs text-muted-foreground">Add your own third-party credentials</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Integration Categories */}
              {categories.map(cat => {
                 const allInCategory = integrations.filter((i: Integration) => i.category === cat)
                 const items = filtered.filter(i => i.category === cat)
                 const connectedCount = allInCategory.filter((i: Integration) => i.connected).length
                 if (items.length === 0) return null
                 return (
                    <div key={cat} className="space-y-3">
                       <div className="flex items-center justify-between">
                          <h2 className="text-sm font-medium text-muted-foreground">{cat}</h2>
                          <span className="text-xs text-muted-foreground/60">{connectedCount}/{allInCategory.length} connected</span>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items.map(item => (
                             <button
                                key={item.id}
                                onClick={() => {
                                  setSelectedId(item.id)
                                  setCrmAuthMethod(item.id === "slack" ? "api_key" : "oauth")
                                }}
                                className={cn(
                                   "flex flex-col p-4 rounded-xl border transition-all text-left",
                                   selectedId === item.id
                                      ? "bg-primary/5 border-primary"
                                      : "bg-background border-border hover:border-primary/20"
                                )}
                             >
                                <div className="flex items-center gap-3 mb-2">
                                   <div className="w-9 h-9 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-lg">
                                      {item.icon}
                                   </div>
                                   <div className="text-[13px] font-semibold text-foreground">{item.name}</div>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 line-clamp-1">
                                   {item.description}
                                </p>
                                <div className="flex gap-1.5 flex-wrap">
                                   {item.connected && (
                                     <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-foreground/70">Connected</span>
                                   )}
                                   {item.badges.map(b => (
                                     b === "new" ? (
                                       <span key={b} className="text-[10px] font-semibold px-2 py-0.5 rounded text-green-600">New</span>
                                     ) : (
                                       <span key={b} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{b === "gtm" ? "GTM" : b === "popular" ? "Popular" : b}</span>
                                     )
                                   ))}
                                </div>
                             </button>
                          ))}
                       </div>
                    </div>
                 )
              })}
              {!loading && filtered.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No integrations found</p>
                </div>
              )}
           </div>
           )}
        </div>
      </div>

      {/* Detail Panel */}
      <aside className="w-[360px] shrink-0 bg-card border-l border-border flex flex-col relative z-20">

         {selectedId === "outmate_api" ? (
           <>
             <div className="bg-primary p-5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                   <Plus className="w-5 h-5 text-white" />
                 </div>
                 <span className="text-base font-bold text-white">Outmate API</span>
               </div>
               <button onClick={() => setSelectedId("gmail")} className="text-white/60 hover:text-white transition-colors">
                 <X className="w-4 h-4" />
               </button>
             </div>

             <div className="flex-1 overflow-auto no-scrollbar p-6 space-y-6">
               <Button
                 onClick={() => {
                   const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                   const rand = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
                   const newKey = `sk-outmate-${rand}`
                   const entry = { id: crypto.randomUUID(), key: newKey, created: new Date().toLocaleDateString() }
                   setApiKeys(prev => [entry, ...prev])
                   setNewKeyVisible(entry.id)
                   navigator.clipboard.writeText(newKey)
                   toast.success("Secret key created and copied to clipboard. Store it securely.")
                 }}
                 className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-lg shadow-primary/20"
               >
                 <Plus className="w-4 h-4 mr-2" /> Create new secret key
               </Button>

               {apiKeys.length > 0 ? (
                 <div className="space-y-3">
                   {apiKeys.map(k => (
                     <div key={k.id} className="space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-semibold text-foreground">Key · {k.created}</span>
                         <button
                           onClick={() => {
                             navigator.clipboard.writeText(k.key)
                             toast.success("API key copied to clipboard")
                           }}
                           className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                         >
                           <Copy className="w-3 h-3" /> Copy
                         </button>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="flex-1 h-10 rounded-lg bg-muted/30 border border-border px-3 flex items-center overflow-hidden">
                           <code className="text-xs text-muted-foreground font-mono truncate">
                             {newKeyVisible === k.id ? k.key : `sk-outmate-....${k.key.slice(-4)}`}
                           </code>
                         </div>
                         <button
                           onClick={() => setNewKeyVisible(newKeyVisible === k.id ? null : k.id)}
                           className="h-10 w-10 shrink-0 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                         >
                           {newKeyVisible === k.id ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-foreground">Production key</span>
                     <button
                       onClick={() => {
                         navigator.clipboard.writeText("sk-outmate-xxxxxxxxxxxxxxxxxxXZ9")
                         toast.success("API key copied to clipboard")
                       }}
                       className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                     >
                       <Copy className="w-3 h-3" /> Copy
                     </button>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="flex-1 h-10 rounded-lg bg-muted/30 border border-border px-3 flex items-center">
                       <code className="text-xs text-muted-foreground font-mono">
                         {showKey ? "sk-outmate-xxxxxxxxxxxxxxxxxxXZ9" : "sk-outmate-••••••••••••••XZ9"}
                       </code>
                     </div>
                     <button
                       onClick={() => setShowKey(!showKey)}
                       className="h-10 w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                     >
                       {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                   </div>
                 </div>
               )}

               <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                 <div className="flex gap-3">
                   <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                   <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                     Keys are shown once at creation. Store securely. Never share.
                   </p>
                 </div>
               </div>

               <Separator />

               <div className="space-y-4">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">API details</h4>
                 {[
                   { label: "Version", value: "v2.1" },
                   { label: "Requests/day", value: "10,000" },
                   { label: "Auth type", value: "Bearer token" },
                   { label: "Docs", value: "docs.outmate.ai" },
                 ].map(row => (
                   <div key={row.label} className="flex items-center justify-between">
                     <span className="text-[11px] font-bold text-muted-foreground/60">{row.label}</span>
                     <span className="text-[11px] font-bold text-foreground">{row.value}</span>
                   </div>
                 ))}
               </div>

               <Separator />

               <div className="space-y-3">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Quick links</h4>
                 {[
                   { label: "API documentation", href: "/docs/api#authentication" },
                   { label: "Webhook guide", href: "/docs/api#webhooks" },
                   { label: "Rate limits", href: "/docs/api#rate-limits" },
                   { label: "Code examples", href: "/docs/api#examples" },
                 ].map(link => (
                   <a key={link.label} href={link.href} className="w-full flex items-center justify-between py-2 group">
                     <span className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors">{link.label}</span>
                     <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                   </a>
                 ))}
               </div>
             </div>
           </>
         ) : selectedId === "custom_api_keys" ? (
           <>
             <div className="bg-muted/30 p-5 flex items-center justify-between border-b border-border">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                   <Grid3X3 className="w-5 h-5 text-muted-foreground" />
                 </div>
                 <span className="text-base font-bold text-foreground">Custom API keys</span>
               </div>
               <button onClick={() => setSelectedId("gmail")} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                 <X className="w-4 h-4" />
               </button>
             </div>

             <div className="flex-1 overflow-auto no-scrollbar p-6 space-y-6">
               <div className="p-5 rounded-2xl bg-muted/20 border border-dashed border-border">
                 <div className="flex gap-3">
                   <Key className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                   <p className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed">
                     Add your own third-party API credentials. These keys are stored encrypted and used by Outmate agents during enrichment.
                   </p>
                 </div>
               </div>

               <div className="space-y-3">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Service Name</label>
                   <Input placeholder="e.g., Clearbit, ZoomInfo" className="h-10 text-xs" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">API Key</label>
                   <Input type="password" placeholder="Enter your API key" className="h-10 text-xs" />
                 </div>
                 <Button className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20">
                   Save Custom Key
                 </Button>
               </div>
             </div>
           </>
         ) : (
         <>
         <div className="absolute top-0 right-0 p-4 z-10">
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground rounded-lg">
                <X className="w-4 h-4" />
             </Button>
         </div>

         {!selected ? (
           <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
             <Loader2 className="w-8 h-8 animate-spin mb-4" />
             <p className="text-sm font-medium">Loading integration details...</p>
           </div>
         ) : (
         <>
         <div className="p-8 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-dashed border-border flex items-center justify-center text-4xl mb-6">
               {selected.icon}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">{selected.name}</h2>
            <p className="text-xs font-medium text-muted-foreground/60 mt-2 leading-relaxed">
               {selected.description}
            </p>
         </div>

         <div className="flex-1 overflow-auto no-scrollbar p-8 space-y-8">
            {selected.connected ? (
               <>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Status</span>
                         <Badge className="bg-green-500/10 text-green-500 border-transparent font-black px-2 text-[9px]">ACTIVE & SYNCED</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Last Sync</span>
                         <span className="text-[11px] font-black text-foreground">{selected.lastSync}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Sync Type</span>
                         <span className="text-[11px] font-black text-foreground">{selected.syncType}</span>
                      </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Auto-Sync</span>
                        <Switch defaultChecked className="scale-75" />
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">Error Alerts</span>
                        <Switch defaultChecked className="scale-75" />
                     </div>
                  </div>

                  <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                     <div className="flex gap-3">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        <div>
                           <div className="text-[11px] font-black text-foreground uppercase tracking-wider">All systems operational</div>
                           <p className="text-[10px] font-bold text-muted-foreground/60 mt-1">Successfully synced {selected.records || '0'} records in the last 24 hours.</p>
                        </div>
                     </div>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (selected.id === "hubspot" || selected.id === "salesforce" || selected.id === "zoho_crm") {
                        handleDisconnectCrm(selected.id)
                      }
                    }}
                    className="w-full h-11 border-red-500/20 text-red-500 hover:bg-red-500/5 hover:border-red-500/30 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all"
                  >
                     Disconnect Integration
                  </Button>
               </>
            ) : (
               <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-muted/20 border border-dashed border-border">
                     <div className="flex gap-3">
                        <AlertCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        <p className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed">
                           This tool is not yet connected to your Outmate workspace. Enable it to start syncing data.
                        </p>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Capabilities</h4>
                     {(integrationCapabilities[selected.id] || [
                        "Data synchronization",
                        "Real-time event tracking",
                        "Bi-directional sync",
                        "AI agent accessibility"
                     ]).map(c => (
                        <div key={c} className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                           <span className="text-[11px] font-bold text-foreground/80">{c}</span>
                        </div>
                     ))}
                  </div>

                  {selected.id === "outreach" ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Service</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOutreachService("instantly")}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all",
                              outreachService === "instantly"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Instantly
                          </button>
                          <button
                            onClick={() => setOutreachService("smartlead")}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all",
                              outreachService === "smartlead"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Smartlead
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">API Key</label>
                        <Input
                          type="password"
                          value={outreachApiKey}
                          onChange={(e) => setOutreachApiKey(e.target.value)}
                          placeholder="Enter your API key"
                          className="h-10 text-xs"
                        />
                      </div>
                      <Button
                        onClick={handleTestOutreach}
                        disabled={testingOutreach}
                        className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                      >
                        {testingOutreach ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          "Connect Outreach"
                        )}
                      </Button>
                    </div>
                  ) : selected.id === "instantly" || selected.id === "smartlead" ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border">
                        <p className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed">
                          Connect your own {selected.name} account. Enter the API key from your {selected.name} dashboard to enable outbound campaigns through Outmate.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">API Key</label>
                        <Input
                          type="password"
                          value={instantlyApiKey}
                          onChange={(e) => setInstantlyApiKey(e.target.value)}
                          placeholder={`Enter your ${selected.name} API key`}
                          className="h-10 text-xs"
                        />
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground/50 leading-relaxed">
                        {selected.id === "instantly" ? (
                          <>Go to <span className="text-foreground">app.instantly.ai</span> → Settings → API → Copy your API key.</>
                        ) : (
                          <>Go to <span className="text-foreground">app.smartlead.ai</span> → Settings → API → Copy your API key.</>
                        )}
                      </p>
                      <Button
                        onClick={async () => {
                          if (!instantlyApiKey.trim()) {
                            toast.error("Please enter an API key")
                            return
                          }
                          setConnectingInstantly(true)
                          try {
                            const result = await integrationsApi.testOutreach({
                              service: selected.id,
                              api_key: instantlyApiKey,
                            })
                            if (result.success) {
                              toast.success(`${selected.name} connected successfully`)
                              setInstantlyApiKey("")
                              loadIntegrations()
                            } else {
                              toast.error(result.message)
                            }
                          } catch (error: any) {
                            toast.error(error.message || `Failed to connect ${selected.name}`)
                          } finally {
                            setConnectingInstantly(false)
                          }
                        }}
                        disabled={connectingInstantly || !instantlyApiKey.trim()}
                        className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                      >
                        {connectingInstantly ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          `Connect ${selected.name}`
                        )}
                      </Button>
                    </div>
                  ) : selected.id === "whatsapp" ? (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Connect WhatsApp Business via Unipile. Make sure your WhatsApp account is connected in Unipile first.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            await integrationsApi.whatsappConnect()
                            toast.success("WhatsApp Business connected successfully via Unipile")
                            loadIntegrations()
                          } catch (error: any) {
                            toast.error(error.message || "Failed to connect WhatsApp Business")
                          }
                        }}
                        className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                      >
                        Connect WhatsApp Business
                      </Button>
                    </div>
                  ) : selected.id === "slack" ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-foreground">Shared Slack channel</p>
                              <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">
                                Connect Slack here once and Outmate will use it anywhere Slack delivery is enabled.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {slackConnectedFeatures.map((feature) => (
                                <div key={feature} className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary/80" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Auth Method Toggle: Webhook vs OAuth */}
                      <div className="flex gap-2 p-1 bg-muted/20 rounded-lg">
                        <button
                          onClick={() => setCrmAuthMethod("api_key")}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all",
                            crmAuthMethod === "api_key"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Webhook
                        </button>
                        <button
                          onClick={() => setCrmAuthMethod("oauth")}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all",
                            crmAuthMethod === "oauth"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          OAuth
                        </button>
                      </div>

                      {crmAuthMethod === "api_key" ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Webhook URL</label>
                            <Input
                              type="text"
                              value={slackWebhookUrl}
                              onChange={(e) => setSlackWebhookUrl(e.target.value)}
                              placeholder="https://hooks.slack.com/services/T.../B.../..."
                              className="h-10 text-xs"
                            />
                          </div>
                          <p className="text-[10px] font-medium text-muted-foreground/50 leading-relaxed">
                            Go to <span className="text-foreground">api.slack.com/apps</span> → Your App → Incoming Webhooks → Copy the webhook URL.
                          </p>
                          <Button
                            onClick={async () => {
                              if (!slackWebhookUrl.trim()) {
                                toast.error("Please enter a Slack webhook URL")
                                return
                              }
                              setConnectingSlackWebhook(true)
                              try {
                                await integrationsApi.connectIntegration("slack", slackWebhookUrl)
                                toast.success("Slack connected across Copilot, Signals, Watchers, and Voice Agent")
                                setSlackWebhookUrl("")
                                loadIntegrations()
                              } catch (error: any) {
                                toast.error(error.message || "Failed to connect Slack webhook")
                              } finally {
                                setConnectingSlackWebhook(false)
                              }
                            }}
                            disabled={connectingSlackWebhook || !slackWebhookUrl.trim()}
                            className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                          >
                            {connectingSlackWebhook ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect with Webhook"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleConnectCrm("slack")}
                          disabled={connectingCrm === "slack"}
                          className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                        >
                          {connectingCrm === "slack" ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect with OAuth"
                          )}
                        </Button>
                      )}
                    </div>
                  ) : selected.id === "hubspot" || selected.id === "salesforce" || selected.id === "zoho_crm" || selected.id === "outlook" || selected.id === "discord" || selected.id === "teams" ? (
                    <div className="space-y-4">
                      {selected.id === "outlook" && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-[11px] font-bold leading-relaxed text-muted-foreground">
                            Outmate uses our Azure app registration only to start Microsoft OAuth. Each user signs in with their own Outlook / Office 365 account, and Microsoft grants delegated Graph access to that user's mailbox.
                          </p>
                        </div>
                      )}
                      {selected.id === "hubspot" && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-[11px] font-bold leading-relaxed text-muted-foreground">
                            Outmate does not need its own paid HubSpot account. OAuth sends each user to HubSpot to authorize their own portal; the private app token option is for users who prefer to paste a token from their own HubSpot account.
                          </p>
                        </div>
                      )}
                      {/* Auth Method Toggle */}
                      <div className="flex gap-2 p-1 bg-muted/20 rounded-lg">
                        <button
                          onClick={() => setCrmAuthMethod("oauth")}
                          className={cn(
                            "py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all",
                            selected.id === "outlook" ? "w-full" : "flex-1",
                            crmAuthMethod === "oauth"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          OAuth
                        </button>
                        {selected.id !== "outlook" && (
                          <button
                            onClick={() => setCrmAuthMethod("api_key")}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all",
                              crmAuthMethod === "api_key"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {selected.id === "hubspot" ? "Private App Token" : "API Key"}
                          </button>
                        )}
                      </div>

                      {crmAuthMethod === "oauth" ? (
                        <Button
                          onClick={() => handleConnectCrm(selected.id)}
                          disabled={connectingCrm === selected.id}
                          className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                        >
                          {connectingCrm === selected.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            `Connect with OAuth`
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{selected.id === "hubspot" ? "Private App Token" : "API Key"}</label>
                            <Input
                              type="password"
                              value={crmApiKey}
                              onChange={(e) => setCrmApiKey(e.target.value)}
                              placeholder={selected.id === "hubspot" ? "Paste your HubSpot private app access token" : "Enter your API key"}
                              className="h-10 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Description (Optional)</label>
                            <Input
                              value={crmDescription}
                              onChange={(e) => setCrmDescription(e.target.value)}
                              placeholder="e.g., Production account"
                              className="h-10 text-xs"
                            />
                          </div>
                          {selected.id === "salesforce" && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Instance URL (Optional)</label>
                              <Input
                                value={crmInstanceUrl}
                                onChange={(e) => setCrmInstanceUrl(e.target.value)}
                                placeholder="https://your-instance.salesforce.com"
                                className="h-10 text-xs"
                              />
                            </div>
                          )}
                          {selected.id === "zoho_crm" && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">API Domain (Optional)</label>
                              <Input
                                value={crmApiDomain}
                                onChange={(e) => setCrmApiDomain(e.target.value)}
                                placeholder="https://www.zohoapis.com"
                                className="h-10 text-xs"
                              />
                            </div>
                          )}
                          <Button
                            onClick={() => handleStoreApiKey(selected.id)}
                            disabled={savingApiKey || !crmApiKey}
                            className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                          >
                            {savingApiKey ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              selected.id === "hubspot" ? "Connect with Private App Token" : `Connect with API Key`
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleConnectGeneric(selected.id)}
                      className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                    >
                      Authorize {selected.name}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => handleSkip(selected.id)}
                    className="w-full h-9 text-muted-foreground hover:text-foreground font-black uppercase tracking-widest text-[10px]"
                  >
                    Skip Integration
                  </Button>
               </div>
            )}
         </div>

         <div className="p-8 border-t border-border bg-muted/5">
            <a
              href={selected ? (integrationDocs[selected.id] || "#") : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] font-black text-muted-foreground hover:text-primary transition-all uppercase tracking-widest"
            >
               <ExternalLink className="w-3.5 h-3.5" /> Documentation Guide
            </a>
         </div>
         </>
         )}
         </>
         )}
      </aside>
    </div>
  )
}
