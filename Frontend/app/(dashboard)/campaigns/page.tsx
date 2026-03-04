"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Inbox, BarChart3, Mail, Shield } from "lucide-react"
import { CampaignsList } from "@/components/campaigns/campaigns-list"
import { campaignsApi, type Campaign } from "@/lib/api/campaigns"
import { useToast } from "@/hooks/use-toast"

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { toast } = useToast()

  const [sequences, setSequences] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [blocklist, setBlocklist] = useState<any[]>([])
  const [globalStatus, setGlobalStatus] = useState<{ inbox: string | null; analytics: string | null }>({
    inbox: null,
    analytics: null,
  })
  const [inboxFeed, setInboxFeed] = useState<any[]>([])
  const [analyticsFeed, setAnalyticsFeed] = useState<any[]>([])

  const derivedInboxFeed = useMemo(() => {
    return sequences.slice(0, 3).map((seq) => ({
      id: seq.id,
      title: seq.name,
      message: `Status ${seq.status} · ${seq.leads ?? 0} leads · Bounce ${seq.bounce_rate ?? "N/A"}%`,
      timestamp: seq.last_modified ?? new Date().toISOString(),
      source: "Sequence monitor",
    }))
  }, [sequences])

  const derivedAnalyticsFeed = useMemo(() => {
    if (campaigns.length === 0) return []
    const totalLeads = campaigns.reduce((sum, campaign) => sum + (campaign.leadsCount || 0), 0)
    const runningCount = campaigns.filter((campaign) => campaign.status === "running").length
    const averageOpenRate =
      campaigns.reduce((sum, campaign) => sum + (campaign.stats?.openRate || 0), 0) / campaigns.length
    return [
      {
        id: "lead-count",
        label: "Leads captured",
        value: `${totalLeads.toLocaleString()} targets`,
        trend: totalLeads > 0 ? "positive" : "steady",
        timestamp: new Date().toISOString(),
      },
      {
        id: "running-campaigns",
        label: "Running campaigns",
        value: `${runningCount} live`,
        trend: runningCount > 0 ? "positive" : "steady",
        timestamp: new Date().toISOString(),
      },
      {
        id: "open-rate",
        label: "Avg. open rate",
        value: `${averageOpenRate.toFixed(1)}%`,
        trend: averageOpenRate >= 30 ? "positive" : "steady",
        timestamp: new Date().toISOString(),
      },
    ]
  }, [campaigns])

  useEffect(() => {
    fetchCampaigns()
    loadDashboardSections()
  }, [])

  const loadDashboardSections = async () => {
    try {
      const [seq, emailAccounts, blocked] = await Promise.all([
        campaignsApi.getDashboardSequences(),
        campaignsApi.getEmailAccounts(),
        campaignsApi.getBlocklist(),
      ])
      setSequences(seq || [])
      setAccounts(emailAccounts || [])
      setBlocklist(blocked || [])
      const status = await campaignsApi.getDashboardGlobalStatus()
      setGlobalStatus(status)
      await loadGlobalFeeds()
    } catch (error) {
      toast({
        title: "Dashboard load failed",
        description: "Could not load accounts or blocklist.",
        variant: "destructive",
      })
    }
  }

  const loadInboxFeed = async () => {
    try {
      const feed = await campaignsApi.getGlobalInboxFeed()
      setInboxFeed(feed.slice(0, 5))
    } catch {
      toast({
        title: "Inbox load failed",
        description: "Unable to load signal inbox.",
        variant: "destructive",
      })
    }
  }

  const loadAnalyticsFeed = async () => {
    try {
      const feed = await campaignsApi.getGlobalAnalyticsFeed()
      setAnalyticsFeed(feed.slice(0, 3))
    } catch {
      toast({
        title: "Analytics load failed",
        description: "Unable to load snapshot feed.",
        variant: "destructive",
      })
    }
  }

  const loadGlobalFeeds = async () => {
    await Promise.all([loadInboxFeed(), loadAnalyticsFeed()])
  }

  const fetchCampaigns = async () => {
    try {
      const data = await campaignsApi.getCampaigns()
      setCampaigns(data)
    } catch (error) {
      console.error("Failed to fetch campaigns:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGlobalInbox = async () => {
    try {
      const res = await campaignsApi.triggerGlobalInbox()
      setGlobalStatus((prev) => ({
        ...prev,
        inbox: res?.last_refreshed ?? prev.inbox,
      }))
      toast({ title: "Global Inbox", description: res?.message ?? "Inbox refreshed" })
      await loadInboxFeed()
    } catch {
      toast({
        title: "Global Inbox failed",
        description: "Check your connection and try again.",
        variant: "destructive",
      })
    }
  }

  const handleGlobalAnalytics = async () => {
    try {
      const res = await campaignsApi.triggerGlobalAnalytics()
      setGlobalStatus((prev) => ({
        ...prev,
        analytics: res?.last_refreshed ?? prev.analytics,
      }))
      toast({ title: "Global Analytics", description: res?.message ?? "Snapshot captured" })
      await loadAnalyticsFeed()
    } catch {
      toast({
        title: "Global Analytics failed",
        description: "Unable to refresh analytics right now.",
        variant: "destructive",
      })
    }
  }

  const handleAddEmailAccount = async () => {
    const email = window.prompt("Enter the email address to add to the campaign pool:", "new@outmate.ai")
    if (!email) return
    const provider = window.prompt("Enter the provider (Gmail, Outlook, etc.):", "Gmail") || "Gmail"
    try {
      const payload = await campaignsApi.addEmailAccount(email, provider)
      setAccounts((prev) => [payload.account, ...prev])
      toast({ title: "Email account added", description: payload.account.email + " connected" })
    } catch {
      toast({
        title: "Add account failed",
        description: "We could not add the email account.",
        variant: "destructive",
      })
    }
  }

  const handleAddBlocklist = async () => {
    const domain = window.prompt("Domain to block:", "spammyco.com")
    if (!domain) return
    const reason = window.prompt("Reason for blocklisting:", "High bounce rate") || "No reason provided"
    try {
      const payload = await campaignsApi.addBlocklistEntry(domain, reason)
      setBlocklist((prev) => [payload.entry, ...prev])
      toast({ title: "Blocklist updated", description: `${domain} added` })
    } catch {
      toast({
        title: "Blocklist failed",
        description: "Could not add the domain.",
        variant: "destructive",
      })
    }
  }

  const formatTimestamp = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "never"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your outreach campaigns</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleGlobalInbox}>
                <Inbox className="mr-2 h-4 w-4" />
                Global Inbox
              </Button>
              <Button variant="secondary" onClick={handleGlobalAnalytics}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Global Analytics
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Inbox refreshed: {formatTimestamp(globalStatus.inbox)}</p>
              <p>Analytics snapshot: {formatTimestamp(globalStatus.analytics)}</p>
            </div>
          </div>
          <Button onClick={() => router.push("/campaigns/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      <CampaignsList campaigns={campaigns} isLoading={isLoading} onCampaignsChange={fetchCampaigns} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sequences</h2>
        <Card>
          <CardHeader>
            <CardTitle>Sequences Overview</CardTitle>
            <CardDescription>Tracking bounce rate, owner, and modification history to run smarter follow-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sequence</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Bounce rate</TableHead>
                  <TableHead>Last modified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((seq) => (
                  <TableRow key={seq.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{seq.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{seq.owner}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{seq.bounce_rate}%</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(seq.last_modified).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{seq.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{seq.leads}</TableCell>
                    <TableCell className="text-right">{seq.sent}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <CardHeader>
            <CardTitle>Global Inbox</CardTitle>
            <CardDescription>Live alerts that surfaced using the signal rules you defined.</CardDescription>
          </CardHeader>
          <CardContent>
            {inboxFeed.length || derivedInboxFeed.length ? (
              <div className="space-y-3">
                {(inboxFeed.length ? inboxFeed : derivedInboxFeed).map((entry) => (
                  <div key={entry.id} className="rounded border border-border/60 p-3">
                    <p className="text-sm font-semibold">{entry.title}</p>
                    <p className="text-xs text-muted-foreground mb-1">{entry.source}</p>
                    <p className="text-sm">{entry.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No inbox alerts yet. Refresh Global Inbox to surface the latest signals.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="space-y-2">
          <CardHeader>
            <CardTitle>Global Analytics</CardTitle>
            <CardDescription>Snapshots that capture momentum shifts.</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsFeed.length || derivedAnalyticsFeed.length ? (
              <div className="space-y-3">
                {(analyticsFeed.length ? analyticsFeed : derivedAnalyticsFeed).map((snapshot) => (
                  <div key={snapshot.id} className="rounded border border-border/60 p-3">
                    <p className="text-sm font-semibold">{snapshot.label}</p>
                    <p className="text-sm">{snapshot.value}</p>
                    <p className="text-xs text-muted-foreground">
                      Trend: {snapshot.trend} ·{" "}
                      {new Date(snapshot.timestamp).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No analytics snapshots yet. Trigger Global Analytics to capture a snapshot.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Email Accounts</CardTitle>
            <Button size="sm" onClick={handleAddEmailAccount} variant="outline">
              <Mail className="mr-1 h-4 w-4" />
              Add Email Account
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>{account.provider}</TableCell>
                    <TableCell>
                      <Badge variant="default">{account.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(account.connected_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!accounts.length && (
              <p className="text-sm text-muted-foreground mt-4 text-center">No email accounts connected.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Global Blocklist</CardTitle>
            <Button size="sm" onClick={handleAddBlocklist} variant="outline">
              <Shield className="mr-1 h-4 w-4" />
              Global Blocklist
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead>Added at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklist.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.domain}</TableCell>
                    <TableCell>{entry.reason}</TableCell>
                    <TableCell>{entry.added_by}</TableCell>
                    <TableCell>{new Date(entry.added_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!blocklist.length && (
              <p className="text-sm text-muted-foreground mt-4 text-center">Global blocklist is empty.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
