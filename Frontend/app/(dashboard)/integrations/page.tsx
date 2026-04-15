"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, Eye, EyeOff, Copy, ExternalLink, Blocks, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { integrationsApi, type IntegrationStatus } from "@/lib/api/integrations"
import { toast } from "sonner"

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

const categories = ["CRM", "Outbound & email", "Enrichment & data", "Messaging", "AI models"]

// Map backend integration IDs to frontend display config
const integrationConfig: Record<string, Partial<Integration>> = {
  gmail: { icon: "✉", description: "Send and receive emails", category: "Outbound & email", badges: ["popular", "gtm"] },
  slack: { icon: "#", description: "Team notifications and alerts", category: "Messaging", badges: ["popular"] },
  hubspot: { icon: "⊞", description: "Sync contacts, deals, companies, notes", category: "CRM", badges: ["popular", "gtm"], syncType: "Bi-directional", records: "12,400" },
  salesforce: { icon: "☁", description: "Enterprise CRM sync", category: "CRM", badges: ["popular", "gtm"] },
  outreach: { icon: "◈", description: "Outreach automation via Instantly or Smartlead", category: "Outbound & email", badges: ["gtm"] },
}

export default function IntegrationsPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [selectedId, setSelectedId] = useState<string>("gmail")
  const [showKey, setShowKey] = useState(false)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [testingOutreach, setTestingOutreach] = useState(false)
  const [outreachApiKey, setOutreachApiKey] = useState("")
  const [outreachService, setOutreachService] = useState<"instantly" | "smartlead">("instantly")

  // Fetch integrations from API
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        setLoading(true)
        const status = await integrationsApi.getStatus()
        const mapped = Object.entries(status.integrations).map(([id, int]: [string, IntegrationStatus]) => {
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
    }
    loadIntegrations()
  }, [])

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
        const mapped = Object.entries(status.integrations).map(([id, int]: [string, IntegrationStatus]) => {
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
      const mapped = Object.entries(status.integrations).map(([id, int]: [string, IntegrationStatus]) => {
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
                                onClick={() => setSelectedId(item.id)}
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

                  <Button variant="outline" className="w-full h-11 border-red-500/20 text-red-500 hover:bg-red-500/5 hover:border-red-500/30 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all">
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
                  ) : (
                    <Button className="w-full h-11 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20">
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
