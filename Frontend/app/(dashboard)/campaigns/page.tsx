"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CampaignsList } from "@/components/campaigns/campaigns-list"
import { campaignsApi, type Campaign } from "@/lib/api/campaigns"

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Create and manage your outreach campaigns</p>
        </div>
        <Button onClick={() => router.push("/campaigns/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <CampaignsList campaigns={campaigns} isLoading={isLoading} onCampaignsChange={fetchCampaigns} />
    </div>
  )
}
