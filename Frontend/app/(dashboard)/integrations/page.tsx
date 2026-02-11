"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntegrationCard } from "@/components/integrations/integration-card"
import { integrationsApi, type Integration } from "@/lib/api/integrations"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function IntegrationsPage() {
  const { toast } = useToast()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("all")

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const fetchIntegrations = async () => {
    try {
      const data = await integrationsApi.getIntegrations()
      setIntegrations(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (id: string) => {
    try {
      await integrationsApi.connectIntegration(id)
      toast({
        title: "Success",
        description: "Integration connected successfully",
      })
      fetchIntegrations()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect integration",
        variant: "destructive",
      })
    }
  }

  const handleDisconnect = async (id: string) => {
    try {
      await integrationsApi.disconnectIntegration(id)
      toast({
        title: "Success",
        description: "Integration disconnected",
      })
      fetchIntegrations()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      })
    }
  }

  const handleConfigure = (id: string) => {
    toast({
      title: "Configuration",
      description: "Integration configuration panel would open here",
    })
  }

  const filteredIntegrations =
    activeCategory === "all" ? integrations : integrations.filter((i) => i.category === activeCategory)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">Connect your favorite tools and automate your workflows</p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onConfigure={handleConfigure}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
