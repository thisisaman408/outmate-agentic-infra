"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
  Coins,
  ExternalLink,
} from "lucide-react"
import type { Integration } from "@/lib/api/integrations"
import { IntegrationLogo } from "./integration-logo"

interface IntegrationCardProps {
  integration: Integration
  onConnect: (slug: string, apiKey?: string) => Promise<void>
  onDisconnect: (slug: string) => void
  onCardClick?: (integration: Integration) => void
}

export function IntegrationCard({ integration, onConnect, onDisconnect, onCardClick }: IntegrationCardProps) {
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [connecting, setConnecting] = useState(false)

  const i = integration

  const getStatusBadge = () => {
    if (i.is_coming_soon) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">
          <Clock className="mr-1 h-3 w-3" />
          Coming Soon
        </Badge>
      )
    }
    switch (i.connection_status) {
      case "connected":
      case "built_in":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600/40 bg-emerald-50">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {i.is_built_in ? "Built-in" : "Connected"}
          </Badge>
        )
      case "error":
      case "expired":
        return (
          <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/5">
            <AlertCircle className="mr-1 h-3 w-3" />
            {i.connection_status === "expired" ? "Expired" : "Error"}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <XCircle className="mr-1 h-3 w-3" />
            Not Connected
          </Badge>
        )
    }
  }

  const handleConnectClick = async () => {
    if (i.is_coming_soon) return

    // API key integrations: show the key input dialog
    if (i.auth_type === "api_key" && !i.is_built_in) {
      setShowKeyDialog(true)
      return
    }

    // Webhook / built-in / none: connect immediately
    setConnecting(true)
    try {
      await onConnect(i.slug)
    } finally {
      setConnecting(false)
    }
  }

  const handleKeySubmit = async () => {
    if (!apiKey.trim()) return
    setConnecting(true)
    try {
      await onConnect(i.slug, apiKey)
      setShowKeyDialog(false)
      setApiKey("")
    } finally {
      setConnecting(false)
    }
  }

  const isConnected = i.connection_status === "connected" || i.connection_status === "built_in"

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString()
  }

  return (
    <>
      <Card
        className={`group relative transition-all duration-200 ${
          i.is_coming_soon
            ? "opacity-70 cursor-default"
            : "hover:shadow-md hover:border-primary/30 cursor-pointer"
        }`}
        onClick={() => onCardClick?.(i)}
      >
        {i.is_premium && (
          <div className="absolute -top-2 -right-2 z-10">
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5">
              <Sparkles className="mr-0.5 h-2.5 w-2.5" />
              Pro
            </Badge>
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <IntegrationLogo slug={i.slug} name={i.name} size={40} />
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold truncate">{i.name}</CardTitle>
                <CardDescription className="text-xs capitalize">
                  {i.category.replace("-", " ")}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {i.short_description || i.description}
          </p>

          {/* Credit cost */}
          {i.credit_cost && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Coins className="h-3 w-3" />
              {i.credit_cost}
            </div>
          )}

          {/* Last sync time */}
          {isConnected && i.last_synced_at && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last sync: {formatSyncTime(i.last_synced_at)}
            </div>
          )}

          {/* Error message */}
          {i.connection_status === "error" && i.error_message && (
            <div className="text-[11px] text-destructive truncate" title={i.error_message}>
              {i.error_message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {getStatusBadge()}

            {!i.is_coming_soon && (
              <div className="flex items-center gap-1">
                {isConnected && !i.is_built_in ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDisconnect(i.slug)
                    }}
                  >
                    Disconnect
                  </Button>
                ) : !isConnected ? (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={connecting}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnectClick()
                    }}
                  >
                    {connecting ? (
                      "Connecting..."
                    ) : i.auth_type === "api_key" && !i.is_built_in ? (
                      <>
                        <Lock className="mr-1 h-3 w-3" />
                        Add Key
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IntegrationLogo slug={i.slug} name={i.name} size={24} />
              Connect {i.name}
            </DialogTitle>
            <DialogDescription>
              Enter your {i.name} API key to connect this integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleKeySubmit()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is encrypted at rest and never shared. We only use it to make API calls on your behalf.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleKeySubmit} disabled={!apiKey.trim() || connecting}>
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
