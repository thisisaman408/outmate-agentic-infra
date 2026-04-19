"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, Eye, EyeOff, Copy, ExternalLink, Blocks, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
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
  gmail: { icon: "✉", description: "Send and receive emails", category: "Outbound & email", badges: ["popular", "gtm"] },
  outlook: { icon: "📧", description: "Microsoft Outlook email integration", category: "Outbound & email", badges: ["popular"] },
  sendgrid: { icon: "📨", description: "Transactional email service", category: "Outbound & email" },
  smtp: { icon: "🔌", description: "Custom SMTP server", category: "Outbound & email" },
  reply_io: { icon: "💬", description: "Email reply management", category: "Outbound & email" },
  woodpecker: { icon: "🪶", description: "Cold email follow-up tool", category: "Outbound & email" },
  lemlist: { icon: "📋", description: "B2B lead generation platform", category: "Outbound & email" },
  salesloft: { icon: "🚀", description: "Sales engagement platform", category: "Outbound & email", badges: ["gtm"] },
  outreach_io: { icon: "📢", description: "Sales engagement and analytics", category: "Outbound & email" },
  
  // CRM
  hubspot: { icon: "⊞", description: "Sync contacts, deals, companies, notes", category: "CRM", badges: ["popular", "gtm"], syncType: "Bi-directional", records: "12,400" },
  salesforce: { icon: "☁", description: "Enterprise CRM sync", category: "CRM", badges: ["popular", "gtm"] },
  pipedrive: { icon: "📊", description: "Sales pipeline management", category: "CRM", badges: ["gtm"] },
  zoho_crm: { icon: "🏢", description: "Zoho CRM integration", category: "CRM" },
  close: { icon: "🔒", description: "CRM for startups", category: "CRM" },
  freshsales: { icon: "🌱", description: "Freshworks CRM", category: "CRM" },
  monday: { icon: "📅", description: "Work management and CRM", category: "CRM" },
  streak: { icon: "🔗", description: "CRM inside Gmail", category: "CRM" },
  
  // Messaging
  slack: { icon: "#", description: "Team notifications and alerts", category: "Messaging", badges: ["popular"] },
  teams: { icon: "👥", description: "Microsoft Teams integration", category: "Messaging", badges: ["popular"] },
  discord: { icon: "🎮", description: "Community management", category: "Messaging" },
  whatsapp: { icon: "📱", description: "WhatsApp Business API", category: "Messaging" },
  twilio: { icon: "📞", description: "SMS and voice communication", category: "Messaging" },
  ringcentral: { icon: "📞", description: "Cloud phone system", category: "Messaging" },
  
  // Social Media
  linkedin: { icon: "💼", description: "LinkedIn connections and DMs", category: "Social Media", badges: ["popular", "gtm"] },
  twitter: { icon: "🐦", description: "Twitter/X integration", category: "Social Media" },
  twitter_ads: { icon: "📢", description: "Twitter advertising", category: "Social Media" },
  facebook: { icon: "📘", description: "Facebook integration", category: "Social Media" },
  instagram: { icon: "📷", description: "Instagram integration", category: "Social Media" },
  
  // Enrichment & Data
  clearbit: { icon: "💎", description: "Company and contact enrichment", category: "Enrichment & data", badges: ["gtm"] },
  apollo: { icon: "🚀", description: "B2B contact database", category: "Enrichment & data", badges: ["gtm"] },
  zoominfo: { icon: "🔍", description: "B2B intelligence platform", category: "Enrichment & data", badges: ["gtm"] },
  hunter: { icon: "🎯", description: "Email finder and verifier", category: "Enrichment & data" },
  rocketreach: { icon: "🚀", description: "Contact finder platform", category: "Enrichment & data" },
  lusha: { icon: "💎", description: "B2B contact database", category: "Enrichment & data" },
  snov_io: { icon: "❄", description: "Email finder and verifier", category: "Enrichment & data" },
  kaspr: { icon: "🔑", description: "B2B contact enrichment", category: "Enrichment & data" },
  
  // Calendar
  google_calendar: { icon: "📅", description: "Google Calendar sync", category: "Calendar", badges: ["popular"] },
  outlook_calendar: { icon: "📆", description: "Microsoft Outlook calendar", category: "Calendar" },
  calendly: { icon: "📅", description: "Meeting scheduling automation", category: "Calendar", badges: ["gtm"] },
  
  // Analytics
  google_analytics: { icon: "📈", description: "Website analytics", category: "Analytics", badges: ["popular"] },
  segment: { icon: "📊", description: "Customer data platform", category: "Analytics" },
  mixpanel: { icon: "📊", description: "Product analytics", category: "Analytics" },
  amplitude: { icon: "📊", description: "Digital analytics platform", category: "Analytics" },
  
  // Communication
  intercom: { icon: "💬", description: "Customer messaging platform", category: "Communication" },
  zendesk: { icon: "🎫", description: "Customer support platform", category: "Communication" },
  helpscout: { icon: "💁", description: "Help desk software", category: "Communication" },
  
  // Productivity
  notion: { icon: "📝", description: "Productivity and knowledge base", category: "Productivity", badges: ["popular"] },
  airtable: { icon: "📊", description: "Spreadsheet-database hybrid", category: "Productivity" },
  trello: { icon: "📋", description: "Project management", category: "Productivity" },
  asana: { icon: "✅", description: "Work management platform", category: "Productivity" },
  
  // Automation
  zapier: { icon: "⚡", description: "Connect 7000+ apps via Zapier", category: "AI models", badges: ["popular"] },
  make: { icon: "🔧", description: "Automation platform", category: "AI models" },
  n8n: { icon: "🔗", description: "Workflow automation", category: "AI models" },
  webhooks: { icon: "🔗", description: "Custom webhook integrations", category: "AI models", badges: ["popular"] },
  
  // Outreach (legacy support)
  outreach: { icon: "◈", description: "Outreach automation via Instantly or Smartlead", category: "Outbound & email", badges: ["gtm"] },
}

export default function IntegrationsPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [selectedId, setSelectedId] = useState<string>("gmail")
  const [showKey, setShowKey] = useState(false)
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
        {/* Top Header */}
        <div className="px-8 pt-8 pb-6 bg-card border-b border-border">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                 <Blocks className="w-6 h-6 text-indigo-500" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground">Integrations</h1>
                <p className="text-xs font-bold text-muted-foreground mt-0.5 opacity-60">Connect your stack to power global automation.</p>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative group flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                 <Input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tools, platforms, or categories..." 
                    className="pl-10 h-10 bg-muted/40 border-transparent focus:bg-background focus:ring-0 text-xs font-bold rounded-xl" 
                 />
              </div>
              <div className="flex gap-1.5 p-1 bg-muted/30 rounded-xl">
                 {(["all", "connected", "gtm"] as const).map(k => (
                    <button
                       key={k}
                       onClick={() => setFilter(k)}
                       className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                          filter === k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                       )}
                    >
                       {k}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Catalog */}
        <div className="flex-1 overflow-auto no-scrollbar bg-muted/5">
           {loading ? (
             <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
               <Loader2 className="w-8 h-8 animate-spin mb-4" />
               <p className="text-sm font-medium">Loading integrations...</p>
             </div>
           ) : (
           <div className="p-8 space-y-10">
              {categories.map(cat => {
                 const items = filtered.filter(i => i.category === cat)
                 if (items.length === 0) return null
                 return (
                    <div key={cat} className="space-y-4">
                       <div className="flex items-center justify-between px-2">
                          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{cat}</h2>
                          <span className="text-[10px] font-bold text-muted-foreground/30">{items.length} detected</span>
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
                                   "flex flex-col p-4 rounded-2xl border transition-all text-left group relative backdrop-blur-sm",
                                   selectedId === item.id
                                      ? "bg-primary/5 border-primary shadow-xl shadow-primary/5"
                                      : "bg-background/50 border-border/50 hover:border-primary/20 hover:bg-background"
                                )}
                             >
                                {item.connected && (
                                   <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                )}
                                <div className="flex items-center gap-3 mb-3">
                                   <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-xl font-bold group-hover:border-primary/30 transition-all">
                                      {item.icon}
                                   </div>
                                   <div className="min-w-0">
                                      <div className="text-[13px] font-black text-foreground truncate">{item.name}</div>
                                      <div className="text-[10px] font-bold text-muted-foreground/50 truncate">v2.4.0</div>
                                   </div>
                                </div>
                                <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed mb-4 line-clamp-2">
                                   {item.description}
                                </p>
                                <div className="flex gap-2">
                                   {item.badges.map(b => (
                                      <Badge key={b} variant="secondary" className="bg-muted/50 border-transparent text-[9px] font-black uppercase tracking-widest px-1.5 py-0 rounded-md opacity-60">
                                         {b}
                                      </Badge>
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
         <div className="absolute top-0 right-0 p-4">
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
                     {[
                        "Automatic lead enrichment",
                        "Real-time event tracking",
                        "Bi-directional sync",
                        "AI agent accessibility"
                     ].map(c => (
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
                                toast.success("Slack webhook connected successfully")
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
                      {/* Auth Method Toggle */}
                      <div className="flex gap-2 p-1 bg-muted/20 rounded-lg">
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
                        <button
                          onClick={() => setCrmAuthMethod("api_key")}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all",
                            crmAuthMethod === "api_key"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          API Key
                        </button>
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">API Key</label>
                            <Input
                              type="password"
                              value={crmApiKey}
                              onChange={(e) => setCrmApiKey(e.target.value)}
                              placeholder="Enter your API key"
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
                              `Connect with API Key`
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
            <button className="flex items-center gap-2 text-[11px] font-black text-muted-foreground hover:text-primary transition-all uppercase tracking-widest">
               <ExternalLink className="w-3.5 h-3.5" /> Documentation Guide
            </button>
         </div>
         </>
         )}
      </aside>
    </div>
  )
}
