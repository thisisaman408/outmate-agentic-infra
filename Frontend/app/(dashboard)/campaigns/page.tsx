"use client"

import React, { useState, useEffect } from "react"
import {
  Plus, RefreshCw, Mail, Database, Building2, Users, 
  TrendingUp, Shield, Loader2, ChevronRight, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { campaignsApi } from "@/lib/api/campaigns"
import { toast } from "sonner"

interface Sequence {
  id: string
  name: string
  owner: string
  bounce_rate: number
  last_modified: string
  status: string
  leads: number
  sent: number
}

interface InboxAlert {
  id: string
  signal: string
  company: string
  timestamp: string
}

interface AnalyticsSnapshot {
  id: string
  metric: string
  value: number
  change: number
  timestamp: string
}

interface EmailAccount {
  id: string
  email: string
  provider: string
  status: string
  connected: boolean
}

interface BlocklistEntry {
  id: string
  domain: string
  reason: string
  added_by: string
  added_at: string
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [inboxAlerts, setInboxAlerts] = useState<InboxAlert[]>([])
  const [analyticsSnapshots, setAnalyticsSnapshots] = useState<AnalyticsSnapshot[]>([])
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [blocklistEntries, setBlocklistEntries] = useState<BlocklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingInbox, setRefreshingInbox] = useState(false)
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false)
  const [inboxLastRefresh, setInboxLastRefresh] = useState<string>("never")
  const [analyticsLastRefresh, setAnalyticsLastRefresh] = useState<string>("never")

  useEffect(() => {
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      const [campaignsData, sequencesData, inboxData, analyticsData, emailData, blocklistData] = await Promise.all([
        campaignsApi.getCampaigns(),
        campaignsApi.getDashboardSequences(),
        campaignsApi.getGlobalInboxFeed(),
        campaignsApi.getGlobalAnalyticsFeed(),
        campaignsApi.getEmailAccounts(),
        campaignsApi.getBlocklist()
      ])
      setCampaigns(campaignsData)
      setSequences(sequencesData)
      setInboxAlerts(inboxData)
      setAnalyticsSnapshots(analyticsData)
      setEmailAccounts(emailData)
      setBlocklistEntries(blocklistData)
      
      const globalStatus = await campaignsApi.getDashboardGlobalStatus()
      if (globalStatus.inbox_last_refreshed) {
        setInboxLastRefresh(new Date(globalStatus.inbox_last_refreshed).toLocaleString())
      }
      if (globalStatus.analytics_last_refreshed) {
        setAnalyticsLastRefresh(new Date(globalStatus.analytics_last_refreshed).toLocaleString())
      }
    } catch (error) {
      console.error("Failed to load campaign data:", error)
      toast.error("Failed to load campaign data")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshInbox() {
    setRefreshingInbox(true)
    try {
      await campaignsApi.triggerGlobalInbox()
      const inboxData = await campaignsApi.getGlobalInboxFeed()
      setInboxAlerts(inboxData)
      setInboxLastRefresh(new Date().toLocaleString())
      toast.success("Global Inbox refreshed")
    } catch (error) {
      console.error("Failed to refresh inbox:", error)
      toast.error("Failed to refresh Global Inbox")
    } finally {
      setRefreshingInbox(false)
    }
  }

  async function handleRefreshAnalytics() {
    setRefreshingAnalytics(true)
    try {
      await campaignsApi.triggerGlobalAnalytics()
      const analyticsData = await campaignsApi.getGlobalAnalyticsFeed()
      setAnalyticsSnapshots(analyticsData)
      setAnalyticsLastRefresh(new Date().toLocaleString())
      toast.success("Global Analytics refreshed")
    } catch (error) {
      console.error("Failed to refresh analytics:", error)
      toast.error("Failed to refresh Global Analytics")
    } finally {
      setRefreshingAnalytics(false)
    }
  }

  const createNew = () => router.push("/campaigns/new")

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      
      {/* Header */}
      <div className="shrink-0 px-8 py-6 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Campaigns</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Create and manage your outreach campaigns</p>
          </div>
          <Button onClick={createNew} className="gap-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground h-10 px-6 rounded-xl shadow-lg shadow-primary/20">
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/5 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Campaigns Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Campaigns ({campaigns.length})</h2>
            </div>
            
            {campaigns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm font-medium text-muted-foreground mb-2">No campaigns yet</p>
                <p className="text-xs text-muted-foreground/60 mb-4">Create your first campaign to get started</p>
                <Button onClick={createNew} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Create Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="p-4 bg-muted/30 rounded-2xl border border-border hover:border-primary/20 transition-all cursor-pointer" onClick={createNew}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[13px] font-black text-foreground uppercase tracking-tight">{campaign.name}</h3>
                        <p className="text-[11px] font-medium text-muted-foreground/60 mt-1">{campaign.objective || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg",
                          campaign.status === "running" ? "bg-emerald-500/10 text-emerald-500" :
                          campaign.status === "paused" ? "bg-amber-500/10 text-amber-500" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {campaign.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sequences Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Sequences</h2>
                <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">Tracking bounce rate, owner, and modification history to run smarter follow-ups.</p>
              </div>
            </div>
            
            {sequences.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm font-medium">No sequences yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Sequence</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Owner</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Bounce rate</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Last modified</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Status</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Leads</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sequences.map(seq => (
                      <tr key={seq.id} className="hover:bg-muted/10">
                        <td className="p-3 text-[12px] font-medium">{seq.name}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{seq.owner}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{seq.bounce_rate}%</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{seq.last_modified}</td>
                        <td className="p-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                            seq.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                            seq.status === "paused" ? "bg-amber-500/10 text-amber-500" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {seq.status}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-muted-foreground">{seq.leads}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{seq.sent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Global Inbox Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Global Inbox</h2>
                <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">Live alerts that surfaced using the signal rules you defined.</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-medium text-muted-foreground/60">Inbox refreshed: {inboxLastRefresh}</span>
                <Button 
                  onClick={handleRefreshInbox} 
                  disabled={refreshingInbox}
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshingInbox && "animate-spin")} />
                  Refresh Global Inbox
                </Button>
              </div>
            </div>
            
            {inboxAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm font-medium mb-2">No inbox alerts yet</p>
                <p className="text-xs text-muted-foreground/60">Refresh Global Inbox to surface the latest signals.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inboxAlerts.map(alert => (
                  <div key={alert.id} className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[12px] font-medium text-foreground">{alert.signal}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{alert.company}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{alert.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Global Analytics Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Global Analytics</h2>
                <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">Snapshots that capture momentum shifts.</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-medium text-muted-foreground/60">Analytics snapshot: {analyticsLastRefresh}</span>
                <Button 
                  onClick={handleRefreshAnalytics} 
                  disabled={refreshingAnalytics}
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshingAnalytics && "animate-spin")} />
                  Trigger Global Analytics
                </Button>
              </div>
            </div>
            
            {analyticsSnapshots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm font-medium mb-2">No analytics snapshots yet</p>
                <p className="text-xs text-muted-foreground/60">Trigger Global Analytics to capture a snapshot.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analyticsSnapshots.map(snapshot => (
                  <div key={snapshot.id} className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <p className="text-[11px] font-medium text-muted-foreground mb-2">{snapshot.metric}</p>
                    <div className="flex items-end gap-2">
                      <p className="text-2xl font-black text-foreground">{snapshot.value}</p>
                      <span className={cn(
                        "text-[11px] font-medium mb-1",
                        snapshot.change >= 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {snapshot.change >= 0 ? "+" : ""}{snapshot.change}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">{snapshot.timestamp}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Email Accounts Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Email Accounts</h2>
            </div>
            
            {emailAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm font-medium">No email accounts connected.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Email</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Provider</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Status</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Connected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {emailAccounts.map(account => (
                      <tr key={account.id} className="hover:bg-muted/10">
                        <td className="p-3 text-[12px] font-medium">{account.email}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{account.provider}</td>
                        <td className="p-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                            account.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {account.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                            account.connected ? "bg-emerald-500/10 text-emerald-500" :
                            "bg-red-500/10 text-red-500"
                          )}>
                            {account.connected ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Global Blocklist Section */}
          <section className="bg-card border border-border rounded-[32px] p-6 shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Global Blocklist</h2>
            </div>
            
            {blocklistEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-12 h-12 mb-4 mx-auto opacity-20" />
                <p className="text-sm font-medium mb-2">Global blocklist is empty.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Domain</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Reason</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Added by</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Added at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {blocklistEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-muted/10">
                        <td className="p-3 text-[12px] font-medium">{entry.domain}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{entry.reason}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{entry.added_by}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">{entry.added_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>

    </div>
  )
}
