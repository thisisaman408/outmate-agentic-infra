"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, Settings } from "lucide-react"
import type { Integration } from "@/lib/api/integrations"

interface IntegrationCardProps {
  integration: Integration
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onConfigure: (id: string) => void
}

export function IntegrationCard({ integration, onConnect, onDisconnect, onConfigure }: IntegrationCardProps) {
  const getStatusIcon = () => {
    switch (integration.status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-success" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />
      default:
        return <XCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = () => {
    switch (integration.status) {
      case "connected":
        return (
          <Badge variant="outline" className="text-success border-success">
            Connected
          </Badge>
        )
      case "error":
        return (
          <Badge variant="outline" className="text-destructive border-destructive">
            Error
          </Badge>
        )
      default:
        return <Badge variant="secondary">Not Connected</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{integration.icon}</div>
            <div>
              <CardTitle className="text-lg">{integration.name}</CardTitle>
              <CardDescription className="text-sm capitalize">{integration.category}</CardDescription>
            </div>
          </div>
          {getStatusIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{integration.description}</p>

        {integration.status === "connected" && integration.connectedAt && (
          <p className="text-xs text-muted-foreground">
            Connected on {new Date(integration.connectedAt).toLocaleDateString()}
          </p>
        )}

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {integration.status === "connected" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onConfigure(integration.id)}>
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDisconnect(integration.id)}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onConnect(integration.id)}>
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
