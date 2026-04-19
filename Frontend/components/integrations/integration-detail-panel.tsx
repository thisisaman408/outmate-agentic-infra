"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  RefreshCw,
  Search,
  Send,
  Database,
  Users,
  Building2,
  Zap,
  Link2,
  Shield,
  Play,
  ArrowRight,
} from "lucide-react"
import type { Integration } from "@/lib/api/integrations"
import { integrationsApi } from "@/lib/api/integrations"
import { instantlyApi } from "@/lib/api/instantly"
import { smartleadApi } from "@/lib/api/smartlead"
import { mailchimpApi } from "@/lib/api/mailchimp"
import { outlookApi } from "@/lib/api/outlook"
import { IntegrationLogo } from "./integration-logo"
import { authService } from "@/lib/auth"

interface IntegrationDetailPanelProps {
  integration: Integration | null
  open: boolean
  onClose: () => void
  onDisconnect: (slug: string) => void
  onConnect: (slug: string, apiKey?: string) => Promise<void>
}

export function IntegrationDetailPanel({
  integration,
  open,
  onClose,
  onDisconnect,
  onConnect,
}: IntegrationDetailPanelProps) {
  const { toast } = useToast()
  const i = integration

  if (!i) return null

  const isConnected =
    i.connection_status === "connected" || i.connection_status === "built_in"

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <IntegrationLogo slug={i.slug} name={i.name} size={48} />
            <div>
              <SheetTitle className="text-lg">{i.name}</SheetTitle>
              <SheetDescription className="capitalize">
                {i.category.replace("-", " ")}
                {i.credit_cost && ` · ${i.credit_cost}`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge
                variant="outline"
                className="text-emerald-600 border-emerald-600/40 bg-emerald-50"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {i.is_built_in ? "Built-in — Always Active" : "Connected"}
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {i.description || i.short_description}
          </p>

          <Separator />

          {/* Render the right panel based on category + auth type */}
          {["hubspot", "salesforce", "zoho-crm", "dynamics-365"].includes(i.slug) ? (
            <CrmPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.slug === "mailchimp" ? (
            <MailchimpPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.slug === "outlook" ? (
            <OutlookPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.is_coming_soon ? (
            <ComingSoonPanel integration={i} />
          ) : i.slug === "smartlead" ? (
            <SmartleadPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.slug === "instantly" ? (
            <InstantlyPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.category === "enrichment" && i.is_built_in ? (
            <BuiltInEnrichmentPanel integration={i} />
          ) : i.category === "enrichment" && !i.is_built_in ? (
            <BYOKEnrichmentPanel
              integration={i}
              isConnected={isConnected}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ) : i.category === "automation" ? (
            <AutomationPanel integration={i} isConnected={isConnected} />
          ) : isConnected ? (
            <ConnectedGenericPanel
              integration={i}
              onDisconnect={onDisconnect}
            />
          ) : (
            <NotConnectedPanel
              integration={i}
              onConnect={onConnect}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SmartleadPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [warmupWarnings, setWarmupWarnings] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const handleConnect = async () => {
    if (!apiKey.trim()) return
    setConnecting(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Smartlead connected" })
    } catch (e: any) {
      toast({
        title: "Connection failed",
        description: e?.message || "Unable to connect",
        variant: "destructive",
      })
    } finally {
      setConnecting(false)
    }
  }

  const refreshWarmup = async () => {
    setRefreshing(true)
    try {
      const data = await smartleadApi.refreshWarmup()
      setWarmupWarnings(data?.warnings || [])
      if ((data?.warnings || []).length === 0) {
        toast({ title: "Warm-up scores updated", description: "All domains above 80." })
      }
    } catch (e: any) {
      toast({
        title: "Warm-up refresh failed",
        description: e?.message || "Unable to refresh warm-up scores",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Connect Smartlead</h4>
        <p className="text-xs text-muted-foreground">
          Smartlead manages warm-up and deliverability. Use it for warming domains and fallback routing.
        </p>
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="Paste your Smartlead API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
        </div>
        {Array.isArray(i.setup_steps) && i.setup_steps.length > 0 && (
          <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">Setup steps</p>
            {i.setup_steps.map((step, idx) => (
              <div key={step} className="flex gap-2">
                <span>{idx + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}
        <Button className="w-full" disabled={!apiKey.trim() || connecting} onClick={handleConnect}>
          {connecting ? "Connecting..." : "Connect Smartlead"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          <Shield className="inline h-3 w-3 mr-0.5" />
          Key is encrypted with AES-256 and never logged.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm">Smartlead is connected.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => (window.location.href = "/campaigns")}>
          View Campaigns
        </Button>
        <Button size="sm" variant="outline" disabled={refreshing} onClick={refreshWarmup}>
          {refreshing ? "Refreshing..." : "Refresh Warm-up"}
        </Button>
      </div>

      {warmupWarnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-medium text-amber-700 mb-2">Warm-up alerts</p>
          <div className="space-y-1">
            {warmupWarnings.map((w) => (
              <div key={w.domain} className="flex items-center justify-between">
                <span>{w.domain}</span>
                <span className="font-medium">{w.score}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-700 mt-2">
            Warning at 80, critical at 70. Domains with spam &gt;0.3% auto-park for 30 days.
          </p>
        </div>
      )}

      {Array.isArray(i.features) && i.features.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm mb-2">Features</p>
          <ul className="list-disc list-inside space-y-1">
            {i.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Never send to purchased lists — they destroy domain reputation and will trigger auto-parking.
      </p>

      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-destructive hover:text-destructive"
        onClick={() => onDisconnect(i.slug)}
      >
        Disconnect Smartlead
      </Button>
    </div>
  )
}

function InstantlyPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [suppressionCount, setSuppressionCount] = useState<number | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)

  useEffect(() => {
    if (isConnected) {
      loadStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const overview = await instantlyApi.getAnalyticsOverview()
      const suppression = await instantlyApi.getSuppressionList()
      setAnalytics(overview)
      setSuppressionCount((suppression?.entries || []).length)
    } catch (e: any) {
      toast({
        title: "Instantly",
        description: e?.message || "Unable to load analytics",
        variant: "destructive",
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const handleConnect = async () => {
    if (!apiKey.trim()) return
    setConnecting(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Instantly connected" })
      loadStats()
    } catch (e: any) {
      toast({
        title: "Connection failed",
        description: e?.message || "Unable to connect",
        variant: "destructive",
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleSetupWebhooks = async () => {
    setWebhookLoading(true)
    try {
      await instantlyApi.setupWebhooks()
      toast({ title: "Webhooks connected", description: "Instantly webhooks are active." })
    } catch (e: any) {
      toast({
        title: "Webhook setup failed",
        description: e?.message || "Unable to setup webhooks",
        variant: "destructive",
      })
    } finally {
      setWebhookLoading(false)
    }
  }

  const handleSyncBlockList = async () => {
    setSyncLoading(true)
    try {
      await instantlyApi.syncBlockList()
      toast({ title: "Suppression list synced" })
    } catch (e: any) {
      toast({
        title: "Sync failed",
        description: e?.message || "Unable to sync",
        variant: "destructive",
      })
    } finally {
      setSyncLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Connect Instantly</h4>
        <p className="text-xs text-muted-foreground">
          Add your Instantly API key to sync campaigns, enroll leads, and receive webhook events.
        </p>
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="Paste your Instantly API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
        </div>
        {Array.isArray(i.setup_steps) && i.setup_steps.length > 0 && (
          <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">Setup steps</p>
            {i.setup_steps.map((step, idx) => (
              <div key={step} className="flex gap-2">
                <span>{idx + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}
        <Button className="w-full" disabled={!apiKey.trim() || connecting} onClick={handleConnect}>
          {connecting ? "Connecting..." : "Connect Instantly"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          <Shield className="inline h-3 w-3 mr-0.5" />
          Key is encrypted with AES-256 and never logged.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm">Instantly is connected.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => (window.location.href = "/campaigns")}>
          View Campaigns
        </Button>
        <Button size="sm" variant="outline" disabled={webhookLoading} onClick={handleSetupWebhooks}>
          {webhookLoading ? "Setting up..." : "Setup Webhooks"}
        </Button>
        <Button size="sm" variant="outline" disabled={syncLoading} onClick={handleSyncBlockList}>
          {syncLoading ? "Syncing..." : "Sync Block List"}
        </Button>
        <Button size="sm" variant="ghost" onClick={loadStats} disabled={loadingStats}>
          {loadingStats ? "Refreshing..." : "Refresh Analytics"}
        </Button>
      </div>

      <div className="rounded-md border p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Suppression list</span>
          <span className="font-medium">{suppressionCount ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Open rate</span>
          <span className="font-medium">{analytics?.open_rate ?? analytics?.openRate ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Reply rate</span>
          <span className="font-medium">{analytics?.reply_rate ?? analytics?.replyRate ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Bounce rate</span>
          <span className="font-medium">{analytics?.bounce_rate ?? analytics?.bounceRate ?? "—"}</span>
        </div>
      </div>

      {Array.isArray(i.features) && i.features.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm mb-2">Features</p>
          <ul className="list-disc list-inside space-y-1">
            {i.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-destructive hover:text-destructive"
        onClick={() => onDisconnect(i.slug)}
      >
        Disconnect Instantly
      </Button>
    </div>
  )
}

/* ================================================================== */
/*  Sub-panels for each integration type                              */
/* ================================================================== */

/** Built-in enrichment (Explorium, Crustdata, ContactOut, etc.) */
function BuiltInEnrichmentPanel({ integration: i }: { integration: Integration }) {
  const actions = ENRICHMENT_ACTIONS[i.slug] || []

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Available Actions</h4>
      <p className="text-xs text-muted-foreground">
        {i.name} is built into Outmate. Use it from any of these features:
      </p>
      <EnrichmentQuickActions integration={i} isConnected />
      <div className="space-y-2">
        {actions.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </div>
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <Shield className="inline h-3 w-3 mr-1" />
        This provider is managed by Outmate. Each query costs credits from your plan.
      </div>
    </div>
  )
}

/** BYOK enrichment (Apollo, Hunter, Clearbit, etc.) */
function BYOKEnrichmentPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Key saved", description: `${i.name} is now connected` })
    } catch (e) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Could not save key",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">
        {isConnected ? "API Key Connected" : "Connect Your API Key"}
      </h4>

      {isConnected ? (
        <>
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">
              Your {i.name} API key is securely stored. Outmate will use it for
              enrichment queries.
            </span>
          </div>
          <h4 className="text-sm font-semibold pt-2">How It Works</h4>
          <ul className="space-y-2 text-xs text-muted-foreground list-disc list-inside">
            <li>When you search or enrich prospects, Outmate will call {i.name} using your key</li>
            <li>Usage is billed by {i.name} directly to your account</li>
            <li>Your key is AES-encrypted at rest — we never see the plaintext after save</li>
          </ul>
          <h4 className="text-sm font-semibold pt-2">Run It Now</h4>
          <EnrichmentQuickActions integration={i} isConnected />
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Update API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Paste new key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-sm"
              />
              <Button size="sm" disabled={!apiKey.trim() || saving} onClick={handleSave}>
                {saving ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => onDisconnect(i.slug)}
          >
            Remove Key & Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Add your {i.name} API key to use it as an enrichment source.
            Outmate will call {i.name} on your behalf when you search or enrich
            prospects.
          </p>
          <div className="space-y-2">
            <Label htmlFor="byok-key">API Key</Label>
            <Input
              id="byok-key"
              type="password"
              placeholder={`Paste your ${i.name} API key...`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <Button
            className="w-full"
            disabled={!apiKey.trim() || saving}
            onClick={handleSave}
          >
            <Key className="mr-2 h-4 w-4" />
            {saving ? "Connecting..." : "Connect"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            <Shield className="inline h-3 w-3 mr-0.5" />
            Key is encrypted with AES-256 and never logged or shared.
          </p>
        </>
      )}
    </div>
  )
}

/** Automation integrations (Zapier, Make, n8n, Webhooks, REST API) */
function AutomationPanel({
  integration: i,
  isConnected,
}: {
  integration: Integration
  isConnected: boolean
}) {
  const { toast } = useToast()
  const backendBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Webhook URL unique per user — in production this would come from the backend
  const webhookInboundUrl = `${backendBase}/api/v1/webhooks/inbound/{your-webhook-id}`
  const apiBaseUrl = `${backendBase}/api/v1`

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied", description: `${label} copied to clipboard` })
  }

  if (i.slug === "rest-api") {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Public REST API</h4>
        <p className="text-xs text-muted-foreground">
          Use the Outmate API to build custom integrations with any platform.
          Create an API key, then call any endpoint programmatically.
        </p>
        <div className="space-y-2">
          <Label className="text-xs">API Base URL</Label>
          <div className="flex gap-2">
            <Input value={apiBaseUrl} readOnly className="text-xs font-mono" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(apiBaseUrl, "API URL")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <h4 className="text-sm font-semibold pt-2">Available Endpoints</h4>
        <div className="space-y-1 text-xs">
          {REST_API_ENDPOINTS.map((ep) => (
            <div key={ep.path} className="flex items-start gap-2 rounded p-2 hover:bg-muted/30">
              <Badge variant="outline" className="text-[10px] font-mono shrink-0 mt-0.5">
                {ep.method}
              </Badge>
              <div>
                <code className="text-[11px] font-mono">{ep.path}</code>
                <p className="text-muted-foreground">{ep.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Use your JWT token from login in the <code>Authorization: Bearer</code> header.
          API key auth coming soon.
        </div>
      </div>
    )
  }

  if (i.slug === "webhooks") {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Outbound Webhooks</h4>
        <p className="text-xs text-muted-foreground">
          Outmate can POST real-time events to your endpoints whenever
          something happens — prospect enriched, campaign sent, signal
          detected, etc.
        </p>
        <h4 className="text-sm font-semibold">Supported Events</h4>
        <div className="space-y-1">
          {WEBHOOK_EVENTS.map((ev) => (
            <div
              key={ev.event}
              className="flex items-center gap-2 rounded p-2 text-xs hover:bg-muted/30"
            >
              <Zap className="h-3 w-3 text-amber-500 shrink-0" />
              <code className="font-mono text-[11px]">{ev.event}</code>
              <span className="text-muted-foreground">— {ev.description}</span>
            </div>
          ))}
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">How to set up:</p>
          1. Go to Settings → Webhooks (coming in next release)<br />
          2. Add your endpoint URL<br />
          3. Select which events to receive<br />
          4. Outmate signs each payload with HMAC-SHA256
        </div>
      </div>
    )
  }

  // Zapier / Make / n8n
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Connect via {i.name}</h4>
      <p className="text-xs text-muted-foreground">
        Use {i.name} to connect Outmate with 7000+ other apps. No code
        required.
      </p>

      <h4 className="text-sm font-semibold">Triggers (Outmate → {i.name})</h4>
      <p className="text-xs text-muted-foreground mb-2">
        Set up a {i.name} scenario with a Webhook trigger, then paste the URL
        into Outmate's webhook settings.
      </p>
      <div className="space-y-1">
        {WEBHOOK_EVENTS.slice(0, 5).map((ev) => (
          <div
            key={ev.event}
            className="flex items-center gap-2 rounded p-1.5 text-xs"
          >
            <Zap className="h-3 w-3 text-amber-500" />
            <span>{ev.description}</span>
          </div>
        ))}
      </div>

      <h4 className="text-sm font-semibold pt-2">
        Actions ({i.name} → Outmate)
      </h4>
      <p className="text-xs text-muted-foreground mb-2">
        Use HTTP/Webhook action in {i.name} to call the Outmate API:
      </p>
      <div className="space-y-2">
        <Label className="text-xs">Outmate API Base</Label>
        <div className="flex gap-2">
          <Input value={apiBaseUrl} readOnly className="text-xs font-mono" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(apiBaseUrl, "API URL")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {REST_API_ENDPOINTS.slice(0, 4).map((ep) => (
          <div key={ep.path} className="flex items-center gap-2 rounded p-1.5">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
              {ep.method}
            </Badge>
            <code className="font-mono text-[11px]">{ep.path}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mailchimp integration panel */
function MailchimpPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const [stats, setStats] = useState<any>(null)
  const [audiences, setAudiences] = useState<any[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Connected", description: "Mailchimp is now connected." })
    } catch (e) {
      toast({ title: "Connection failed", description: e instanceof Error ? e.message : "Could not connect", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const loadData = async () => {
    setLoadingStats(true)
    try {
      const [audienceData, analyticsData] = await Promise.all([
        mailchimpApi.getAudiences(5),
        mailchimpApi.getAnalyticsOverview(),
      ])
      setAudiences(audienceData.audiences || [])
      setStats(analyticsData)
    } catch { /* ignore if not connected */ }
    finally { setLoadingStats(false) }
  }

  useEffect(() => { if (isConnected) loadData() }, [isConnected])

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">
        {isConnected ? "Mailchimp Connected" : "Connect Mailchimp"}
      </h4>

      {isConnected ? (
        <>
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">Mailchimp is connected and syncing.</span>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadData} disabled={loadingStats}>
              {loadingStats ? "Loading..." : "Refresh Data"}
            </Button>
          </div>

          {audiences.length > 0 && (
            <>
              <h4 className="text-sm font-semibold pt-2">Audiences</h4>
              <div className="space-y-1">
                {audiences.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded p-2 text-xs hover:bg-muted/30">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground">{a.member_count} members</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stats && (
            <>
              <h4 className="text-sm font-semibold pt-2">Campaign Analytics</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{stats.campaign_count}</p>
                  <p className="text-[10px] text-muted-foreground">Campaigns</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{stats.total_sent}</p>
                  <p className="text-[10px] text-muted-foreground">Emails Sent</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{stats.open_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">Open Rate</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{stats.click_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">Click Rate</p>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Update API Key</Label>
            <div className="flex gap-2">
              <Input type="password" placeholder="Paste new key..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="text-sm" />
              <Button size="sm" disabled={!apiKey.trim() || saving} onClick={handleSave}>{saving ? "Saving..." : "Update"}</Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => onDisconnect(i.slug)}>
            Remove Key & Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Connect your Mailchimp account to manage audiences and view campaign analytics.
          </p>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to get your API key:</p>
            Go to Mailchimp &rarr; Account &rarr; Extras &rarr; API keys &rarr; Create A Key. The key format is <code>xxxx-us21</code> (the suffix is your datacenter).
          </div>
          <div className="space-y-2">
            <Label htmlFor="mailchimp-key">API Key</Label>
            <Input id="mailchimp-key" type="password" placeholder="e.g. abc123def456-us21" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
          </div>
          <Button className="w-full" disabled={!apiKey.trim() || saving} onClick={handleSave}>
            <Key className="mr-2 h-4 w-4" />{saving ? "Connecting..." : "Connect"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            <Shield className="inline h-3 w-3 mr-0.5" />Your key is encrypted with AES-256 and never logged.
          </p>
        </>
      )}
    </div>
  )
}

/** Outlook / Office 365 integration panel */
function OutlookPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Connected", description: "Outlook is now connected." })
    } catch (e) {
      toast({ title: "Connection failed", description: e instanceof Error ? e.message : "Could not connect", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [profileData, folderData] = await Promise.all([
        outlookApi.getProfile(),
        outlookApi.getFolders(),
      ])
      setProfile(profileData)
      setFolders(folderData.folders || [])
    } catch { /* ignore if not connected */ }
    finally { setLoadingData(false) }
  }

  useEffect(() => { if (isConnected) loadData() }, [isConnected])

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">
        {isConnected ? "Outlook Connected" : "Connect Outlook / Office 365"}
      </h4>

      {isConnected ? (
        <>
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">
              Outlook is connected{profile?.email ? ` as ${profile.email}` : ""}.
            </span>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadData} disabled={loadingData}>
              {loadingData ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {profile && (
            <div className="rounded-md bg-muted/50 p-2 text-xs">
              <p><span className="font-medium">Name:</span> {profile.display_name}</p>
              <p><span className="font-medium">Email:</span> {profile.email}</p>
            </div>
          )}

          {folders.length > 0 && (
            <>
              <h4 className="text-sm font-semibold pt-2">Mail Folders</h4>
              <div className="space-y-1">
                {folders.slice(0, 6).map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between rounded p-2 text-xs hover:bg-muted/30">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground">
                      {f.unread_count > 0 && <Badge variant="secondary" className="text-[10px] mr-1">{f.unread_count} unread</Badge>}
                      {f.total_count} total
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Update Access Token</Label>
            <div className="flex gap-2">
              <Input type="password" placeholder="Paste new token..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="text-sm" />
              <Button size="sm" disabled={!apiKey.trim() || saving} onClick={handleSave}>{saving ? "Saving..." : "Update"}</Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => onDisconnect(i.slug)}>
            Remove Token & Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Connect your Microsoft account to send and read emails via Outlook.
          </p>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to get your access token:</p>
            Go to Azure AD &rarr; App Registrations &rarr; Register an app. Add <code>Mail.ReadWrite</code> and <code>Mail.Send</code> permissions under Microsoft Graph. Generate an access token and paste it below.
          </div>
          <div className="space-y-2">
            <Label htmlFor="outlook-token">Access Token</Label>
            <Input id="outlook-token" type="password" placeholder="Paste your Microsoft Graph access token..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
          </div>
          <Button className="w-full" disabled={!apiKey.trim() || saving} onClick={handleSave}>
            <Key className="mr-2 h-4 w-4" />{saving ? "Connecting..." : "Connect"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            <Shield className="inline h-3 w-3 mr-0.5" />Your token is encrypted with AES-256 and never logged.
          </p>
        </>
      )}
    </div>
  )
}

/** CRM integration panel — API key connect for HubSpot, Salesforce, Zoho, Dynamics */
function CrmPanel({
  integration: i,
  isConnected,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isConnected: boolean
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onConnect(i.slug, apiKey)
      setApiKey("")
      toast({ title: "Connected", description: `${i.name} is now connected. You can push leads & companies from any table.` })
    } catch (e) {
      toast({
        title: "Connection failed",
        description: e instanceof Error ? e.message : "Could not connect",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const CRM_SETUP_HINTS: Record<string, string> = {
    hubspot: "Go to HubSpot → Settings → Integrations → Private Apps → Create and copy your Access Token",
    salesforce: "Go to Salesforce → Setup → My Personal Information → Reset Security Token, or create a Connected App and copy the Access Token",
    "zoho-crm": "Go to Zoho API Console → Self Client → Generate token with scope ZohoCRM.modules.ALL → Copy the access token",
    "dynamics-365": "Go to Azure AD → App Registrations → Create app → Generate client secret → Use the access token",
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">
        {isConnected ? `${i.name} Connected` : `Connect ${i.name}`}
      </h4>

      {isConnected ? (
        <>
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">
              {i.name} is connected. Push leads and companies from any table.
            </span>
          </div>

          <h4 className="text-sm font-semibold pt-2">Where to Use</h4>
          <div className="space-y-1">
            {[
              { label: "Leads", href: "/leads" },
              { label: "Prospects", href: "/leads/prospects" },
              { label: "Company Search", href: "/leads/companies/search" },
              { label: "AI-Powered Search", href: "/ai-powered-search" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50"
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {link.label} — Push to {i.name}
              </a>
            ))}
          </div>

          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Update API Key / Access Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Paste new key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-sm"
              />
              <Button size="sm" disabled={!apiKey.trim() || saving} onClick={handleSave}>
                {saving ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => onDisconnect(i.slug)}
          >
            Remove Key & Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Add your {i.name} API key or access token to push leads and companies
            directly from Outmate.
          </p>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to get your key:</p>
            {CRM_SETUP_HINTS[i.slug] || `Check your ${i.name} settings for an API key or access token.`}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crm-key">API Key / Access Token</Label>
            <Input
              id="crm-key"
              type="password"
              placeholder={`Paste your ${i.name} access token...`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <Button
            className="w-full"
            disabled={!apiKey.trim() || saving}
            onClick={handleSave}
          >
            <Key className="mr-2 h-4 w-4" />
            {saving ? "Connecting..." : "Connect"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            <Shield className="inline h-3 w-3 mr-0.5" />
            Your key is encrypted with AES-256 and never logged or shared.
          </p>
        </>
      )}
    </div>
  )
}

/** Connected generic integration (social, calendar, comm, etc.) */
function ConnectedGenericPanel({
  integration: i,
  onDisconnect,
}: {
  integration: Integration
  onDisconnect: (slug: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm">{i.name} is connected and active.</span>
      </div>
      {/* Map category → where to use it */}
      <h4 className="text-sm font-semibold">Where to Use</h4>
      <div className="space-y-1">
        {getCategoryUsageLinks(i.category).map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50"
          >
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            {link.label}
          </a>
        ))}
      </div>
      <Separator />
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-destructive hover:text-destructive"
        onClick={() => onDisconnect(i.slug)}
      >
        Disconnect {i.name}
      </Button>
    </div>
  )
}

/** Not-connected panel */
function NotConnectedPanel({
  integration: i,
  onConnect,
}: {
  integration: Integration
  onConnect: (slug: string, apiKey?: string) => Promise<void>
}) {
  const [apiKey, setApiKey] = useState("")
  const [connecting, setConnecting] = useState(false)

  const isApiKeySupported = i.auth_type === "api_key" || i.category === "crm"
  const isWebhook = i.auth_type === "webhook"

  const handleConnect = async () => {
    setConnecting(true)
    try {
      if (isWebhook && apiKey.trim()) {
        await onConnect(i.slug, apiKey)
        return
      }
      if (isApiKeySupported && apiKey.trim()) {
        await onConnect(i.slug, apiKey)
        return
      }
      if (i.auth_type === "oauth2") {
        const data = await integrationsApi.startOAuth(i.slug)
        if (data?.auth_url) {
          window.location.href = data.auth_url
        }
        return
      }
      await onConnect(i.slug)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Connect {i.name}</h4>
      <p className="text-xs text-muted-foreground">
        {i.description || i.short_description}
      </p>

      {isWebhook && (
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <Input
            type="text"
            placeholder={`Paste your ${i.name} Incoming Webhook URL...`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          <p className="text-[11px] text-muted-foreground">
            {i.slug === "slack"
              ? "Go to api.slack.com/apps → Your App → Incoming Webhooks → Copy the webhook URL."
              : `Paste your ${i.name} webhook URL to receive notifications and alerts.`}
          </p>
        </div>
      )}

      {isApiKeySupported && !isWebhook && (
        <div className="space-y-2">
          <Label>API Key (or OAuth)</Label>
          <Input
            type="password"
            placeholder={`Paste your ${i.name} API key...`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          {i.auth_type === "oauth2" && (
            <p className="text-[11px] text-muted-foreground">
               Leave blank to connect using OAuth (requires a paid {i.name} account), or provide a manual API key.
            </p>
          )}
        </div>
      )}

      <Button
        className="w-full"
        disabled={connecting || ((isApiKeySupported || isWebhook) && !apiKey.trim())}
        onClick={handleConnect}
      >
        {connecting ? "Connecting..." : "Connect"}
      </Button>
    </div>
  )
}

/** Coming soon panel */
function ComingSoonPanel({ integration: i }: { integration: Integration }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 p-4 text-center">
        <p className="text-sm font-medium mb-2">{i.name} is coming soon</p>
        <p className="text-xs text-muted-foreground">
          We're building native {i.name} integration. It will support{" "}
          {i.auth_type === "oauth2"
            ? "one-click OAuth connection"
            : i.auth_type === "api_key"
              ? "API key authentication"
              : "webhook-based connection"}
          .
        </p>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Static data                                                       */
/* ================================================================== */

function EnrichmentQuickActions({
  integration: i,
  isConnected,
}: {
  integration: Integration
  isConnected: boolean
}) {
  const { toast } = useToast()
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [resultText, setResultText] = useState<string>("")

  const [companyQuery, setCompanyQuery] = useState("")
  const [companyDomain, setCompanyDomain] = useState("")
  const [prospectLinkedinUrl, setProspectLinkedinUrl] = useState("")
  const [prospectEmail, setProspectEmail] = useState("")
  const [scrapeTarget, setScrapeTarget] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const authHeaders = () => authService.getAuthHeaders()

  const runAction = async (key: string, fn: () => Promise<string>) => {
    if (!isConnected && !i.is_built_in) {
      toast({ title: "Connect first", description: `Connect ${i.name} to use this action.`, variant: "destructive" })
      return
    }
    setLoadingKey(key)
    setResultText("")
    try {
      const text = await fn()
      setResultText(text)
    } catch (e: any) {
      setResultText("")
      toast({ title: "Action failed", description: e?.message || "Please try again", variant: "destructive" })
    } finally {
      setLoadingKey(null)
    }
  }

  if (!["explorium", "crustdata", "contactout", "bettercontact", "enrich-so", "brightdata"].includes(i.slug)) {
    return null
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        Run a live action from {i.name} without leaving this page.
      </p>

      {i.slug === "explorium" && (
        <div className="space-y-2">
          <Label className="text-xs">Company Search</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Company name or query..."
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!companyQuery.trim() || loadingKey === "company-search"}
              onClick={() =>
                runAction("company-search", async () => {
                  const endpoint = `${apiBase}/api/v1/explorium/company/search`
                  const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...authHeaders(),
                    },
                    body: JSON.stringify({ query: companyQuery }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Search failed")
                  }
                  const data = await res.json()
                  const companies =
                    data?.data?.companies ||
                    data?.companies ||
                    data?.results ||
                    data?.results?.data ||
                    []
                  const names = (Array.isArray(companies) ? companies : [])
                    .slice(0, 3)
                    .map((c: any) => c.name || c.company_name || c.domain)
                    .filter(Boolean)
                  return `Found ${Array.isArray(companies) ? companies.length : 0} companies. Top: ${names.join(", ") || "—"}`
                })
              }
            >
              {loadingKey === "company-search" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {(i.slug === "crustdata" || i.slug === "contactout" || i.slug === "bettercontact") && (
        <div className="space-y-2">
          <Label className="text-xs">Company Domain Enrichment</Label>
          <div className="flex gap-2">
            <Input
              placeholder="example.com"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!companyDomain.trim() || loadingKey === "company-domain"}
              onClick={() =>
                runAction("company-domain", async () => {
                  if (i.slug === "crustdata") {
                    const res = await fetch(
                      `${apiBase}/api/v1/crustdata/enrich?company_domain=${encodeURIComponent(companyDomain)}`,
                      { headers: { ...authHeaders() } },
                    )
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ detail: res.statusText }))
                      throw new Error(err.detail || "Enrichment failed")
                    }
                    const data = await res.json()
                    const company = Array.isArray(data) ? data[0] : data?.companies?.[0] || data
                    const cName = company?.company_name || company?.name || companyDomain
                    const industry = company?.industry || company?.linkedin_industry || ""
                    const headcount = company?.linkedin_headcount ?? company?.headcount?.linkedin_headcount ?? company?.headcount?.employee_count ?? ""
                    const hqCountry = company?.hq_country || company?.headquarters_country || ""
                    const domain = company?.company_website_domain || company?.company_domain || ""
                    const parts = [
                      cName ? `Company: ${cName}` : null,
                      domain ? `Domain: ${domain}` : null,
                      industry ? `Industry: ${industry}` : null,
                      headcount ? `Employees: ${headcount}` : null,
                      hqCountry ? `HQ: ${hqCountry}` : null,
                    ].filter(Boolean)
                    return parts.length ? parts.join(" | ") : `Enriched ${cName} (no detail fields returned)`
                  }
                  if (i.slug === "contactout") {
                    const res = await fetch(
                      `${apiBase}/api/v1/contactout/company/${encodeURIComponent(companyDomain)}`,
                      { headers: { ...authHeaders() } },
                    )
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ detail: res.statusText }))
                      throw new Error(err.detail || "ContactOut failed")
                    }
                    const data = await res.json()
                    const dmCount = Array.isArray(data?.decision_makers) ? data.decision_makers.length : 0
                    return `Company fetched. Decision makers: ${dmCount}`
                  }
                  const res = await fetch(`${apiBase}/api/v1/bettercontact/enrich-company`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ company_name: companyQuery || companyDomain, company_domain: companyDomain }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Enrichment failed")
                  }
                  const data = await res.json()
                  return `Company contact: ${data?.email || "email not found"} / ${data?.phone || "phone not found"}`
                })
              }
            >
              {loadingKey === "company-domain" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {i.slug === "crustdata" && (
        <div className="space-y-2">
          <Label className="text-xs">Prospect Enrichment (LinkedIn)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="LinkedIn profile URL"
              value={prospectLinkedinUrl}
              onChange={(e) => setProspectLinkedinUrl(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!prospectLinkedinUrl.trim() || loadingKey === "crustdata-prospect"}
              onClick={() =>
                runAction("crustdata-prospect", async () => {
                  const res = await fetch(`${apiBase}/api/v1/crustdata/person/enrich`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ linkedin_profile_url: prospectLinkedinUrl, enrich_realtime: true }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Prospect enrichment failed")
                  }
                  const data = await res.json()
                  const raw = data?.data ?? data
                  const payload = Array.isArray(raw) ? raw[0] : raw
                  const email =
                    payload?.email ||
                    payload?.emails?.[0] ||
                    payload?.business_email?.[0] ||
                    payload?.business_emails?.[0]
                  const phone = payload?.phone || payload?.phones?.[0]
                  const name =
                    payload?.full_name ||
                    payload?.name ||
                    payload?.person?.name ||
                    payload?.person?.full_name
                  const currentEmployer =
                    payload?.current_employers?.[0]?.employer_name ||
                    payload?.current_employer ||
                    payload?.company_name ||
                    payload?.company
                  const employerDomain =
                    payload?.current_employers?.[0]?.employer_company_website_domain?.[0]
                  const parts = [
                    currentEmployer ? `Company: ${currentEmployer}` : null,
                    employerDomain ? `Domain: ${employerDomain}` : null,
                    name ? `Name: ${name}` : null,
                    email ? `Email: ${email}` : null,
                    phone ? `Phone: ${phone}` : null,
                  ].filter(Boolean)
                  const fallback = employerDomain || currentEmployer || name || "Prospect enriched"
                  return parts.length ? parts.join(" | ") : `${fallback} (no contact data returned)`
                })
              }
            >
              {loadingKey === "crustdata-prospect" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {i.slug === "contactout" && (
        <div className="space-y-2">
          <Label className="text-xs">Prospect Contact Reveal</Label>
          <div className="flex gap-2">
            <Input
              placeholder="LinkedIn profile URL"
              value={prospectLinkedinUrl}
              onChange={(e) => setProspectLinkedinUrl(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!prospectLinkedinUrl.trim() || loadingKey === "contactout-prospect"}
              onClick={() =>
                runAction("contactout-prospect", async () => {
                  const res = await fetch(`${apiBase}/api/v1/contactout/reveal-contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ linkedin_url: prospectLinkedinUrl, include_phone: true }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Contact reveal failed")
                  }
                  const data = await res.json()
                  const payload = data?.data || data
                  const emails = payload?.emails || payload?.work_emails || []
                  const phones = payload?.phones || []
                  return `Found ${Array.isArray(emails) ? emails.length : 0} emails, ${Array.isArray(phones) ? phones.length : 0} phones`
                })
              }
            >
              {loadingKey === "contactout-prospect" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {i.slug === "bettercontact" && (
        <div className="space-y-2">
          <Label className="text-xs">Prospect Waterfall</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Company domain (optional)"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!firstName.trim() || !lastName.trim() || loadingKey === "prospect-waterfall"}
              onClick={() =>
                runAction("prospect-waterfall", async () => {
                  const res = await fetch(`${apiBase}/api/v1/bettercontact/enrich-prospect`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({
                      first_name: firstName,
                      last_name: lastName,
                      company_domain: companyDomain,
                    }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Enrichment failed")
                  }
                  const data = await res.json()
                  return `Prospect enriched: ${data?.email || "email not found"} / ${data?.phone || "phone not found"}`
                })
              }
            >
              {loadingKey === "prospect-waterfall" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {i.slug === "enrich-so" && (
        <div className="space-y-2">
          <Label className="text-xs">Prospect Enrichment (Email)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Work email address"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!prospectEmail.trim() || loadingKey === "enrichso-prospect"}
              onClick={() =>
                runAction("enrichso-prospect", async () => {
                  const res = await fetch(`${apiBase}/api/v1/enrichso/person`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ email: prospectEmail }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Enrich.so lookup failed")
                  }
                  const data = await res.json()
                  const person = data?.data || data
                  const firstName = person?.firstName || ""
                  const lastName = person?.lastName || ""
                  const name = [firstName, lastName].filter(Boolean).join(" ") || person?.full_name || person?.fullName
                  const title = person?.title
                  const company = person?.company || person?.company_name || person?.companyName
                  const email = person?.email || person?.work_email
                  const linkedinUrl = person?.linkedinUrl
                  const found = person?.found
                  if (found === false) return "No profile found for this email (credits refunded)"
                  const parts = [
                    name ? `Name: ${name}` : null,
                    title ? `Title: ${title}` : null,
                    company ? `Company: ${company}` : null,
                    email ? `Email: ${email}` : null,
                    linkedinUrl ? `LinkedIn: ${linkedinUrl}` : null,
                  ].filter(Boolean)
                  return parts.length ? parts.join(" | ") : "Enriched (no profile data returned)"
                })
              }
            >
              {loadingKey === "enrichso-prospect" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {i.slug === "brightdata" && (
        <div className="space-y-2">
          <Label className="text-xs">Web Scraping</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Company domain or URL to scrape"
              value={scrapeTarget}
              onChange={(e) => setScrapeTarget(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!scrapeTarget.trim() || loadingKey === "brightdata-scrape"}
              onClick={() =>
                runAction("brightdata-scrape", async () => {
                  const res = await fetch(`${apiBase}/api/v1/brightdata/scrape`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ url: scrapeTarget }),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }))
                    throw new Error(err.detail || "Brightdata scrape failed")
                  }
                  const data = await res.json()
                  return data?.summary || "Scrape completed"
                })
              }
            >
              {loadingKey === "brightdata-scrape" ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      )}

      {resultText && (
        <div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {resultText}
        </div>
      )}
    </div>
  )
}

const ENRICHMENT_ACTIONS: Record<
  string,
  { icon: React.ReactNode; label: string; description: string; href: string }[]
> = {
  explorium: [
    { icon: <Search className="h-4 w-4" />, label: "Company Search", description: "Search companies by industry, size, tech stack, funding", href: "/leads/companies/search" },
    { icon: <Building2 className="h-4 w-4" />, label: "Company Enrichment", description: "Firmographics, technographics, intent signals", href: "/leads/companies/search" },
    { icon: <Users className="h-4 w-4" />, label: "Prospect Search", description: "Find decision makers at target companies", href: "/leads/prospects" },
    { icon: <Zap className="h-4 w-4" />, label: "Signal Pipeline", description: "Business events, funding alerts, hiring signals", href: "/dashboard" },
  ],
  crustdata: [
    { icon: <Search className="h-4 w-4" />, label: "Company Search", description: "Real-time company search with advanced filters", href: "/leads/companies/search" },
    { icon: <Users className="h-4 w-4" />, label: "Prospect Search", description: "Find people with job title, location, seniority filters", href: "/leads/prospects" },
    { icon: <Database className="h-4 w-4" />, label: "Company Enrichment", description: "Revenue, headcount, LinkedIn data, decision makers", href: "/leads/companies/search" },
    { icon: <Send className="h-4 w-4" />, label: "LinkedIn Posts", description: "Keyword search across company LinkedIn posts", href: "/leads/companies/search" },
  ],
  contactout: [
    { icon: <Users className="h-4 w-4" />, label: "Decision Makers", description: "Find key contacts at any company by domain", href: "/leads/companies/search" },
    { icon: <Key className="h-4 w-4" />, label: "Contact Reveal", description: "Reveal verified emails and phone numbers", href: "/leads/prospects" },
    { icon: <Building2 className="h-4 w-4" />, label: "Company Enrichment", description: "Enrich company data by domain", href: "/leads/companies/search" },
  ],
  bettercontact: [
    { icon: <RefreshCw className="h-4 w-4" />, label: "Waterfall Enrichment", description: "Verify emails and phones across 20+ providers", href: "/leads/prospects" },
    { icon: <Building2 className="h-4 w-4" />, label: "Company Contact Finder", description: "Find key contacts at a company domain", href: "/leads/companies/search" },
  ],
  "enrich-so": [
    { icon: <Users className="h-4 w-4" />, label: "LinkedIn Enrichment", description: "Enrich profiles with company and contact data", href: "/leads/prospects" },
  ],
  instantly: [
    { icon: <Send className="h-4 w-4" />, label: "Campaigns", description: "Manage Instantly campaigns and sequences", href: "/campaigns" },
    { icon: <Users className="h-4 w-4" />, label: "Enroll Leads", description: "Push lead lists into Instantly sequences", href: "/campaigns" },
  ],
  brightdata: [
    { icon: <Database className="h-4 w-4" />, label: "Web Scraping", description: "Scrape prospect and company data at scale", href: "/leads/prospects" },
  ],
  ipinfo: [
    { icon: <Building2 className="h-4 w-4" />, label: "Visitor Intelligence", description: "Identify companies visiting your website by IP", href: "/visitors" },
  ],
}

const WEBHOOK_EVENTS = [
  { event: "prospect.created", description: "New prospect added to database" },
  { event: "prospect.enriched", description: "Prospect data enriched" },
  { event: "company.created", description: "New company added" },
  { event: "company.enriched", description: "Company data enriched" },
  { event: "campaign.sent", description: "Campaign email sent" },
  { event: "campaign.replied", description: "Reply received on outreach" },
  { event: "signal.detected", description: "New buying signal detected" },
  { event: "visitor.identified", description: "Website visitor identified" },
]

const REST_API_ENDPOINTS = [
  { method: "GET", path: "/prospects", description: "List & search prospects" },
  { method: "POST", path: "/prospects/search", description: "Advanced prospect search" },
  { method: "GET", path: "/companies", description: "List & search companies" },
  { method: "POST", path: "/crustdata/company/search", description: "Company search via Crustdata" },
  { method: "POST", path: "/explorium/search", description: "NLP company search via Explorium" },
  { method: "POST", path: "/bettercontact/enrich-prospect", description: "Enrich prospect email/phone" },
  { method: "GET", path: "/contactout/company/{domain}", description: "Get company + decision makers" },
  { method: "GET", path: "/campaigns", description: "List campaigns" },
  { method: "POST", path: "/campaigns", description: "Create campaign" },
  { method: "GET", path: "/signals", description: "List buying signals" },
]

function getCategoryUsageLinks(
  category: string,
): { label: string; href: string }[] {
  switch (category) {
    case "communication":
      return [
        { label: "Campaign Outreach", href: "/campaigns" },
        { label: "Copilot Alerts", href: "/copilot" },
      ]
    case "social":
      return [
        { label: "LinkedIn Automation", href: "/integrations" },
        { label: "Prospect Research", href: "/leads/prospects" },
      ]
    case "calendar":
      return [
        { label: "Meeting Prep", href: "/copilot" },
        { label: "Calendar Sync", href: "/integrations" },
      ]
    case "productivity":
      return [
        { label: "Export Prospects", href: "/leads/prospects" },
        { label: "Export Companies", href: "/leads/companies/search" },
      ]
    case "analytics":
      return [
        { label: "Visitor Intelligence", href: "/visitors" },
        { label: "Dashboard", href: "/dashboard" },
      ]
    default:
      return [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Prospects", href: "/leads/prospects" },
      ]
  }
}
