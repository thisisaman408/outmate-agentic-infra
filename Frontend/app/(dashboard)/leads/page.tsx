"use client"

import { useEffect, useState } from "react"
import { LeadGenerationPanel } from "@/components/leads/lead-generation-panel"
import { LeadsTable } from "@/components/leads/leads-table"
import { leadsApi, type Lead } from "@/lib/api/leads"

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const data = await leadsApi.getLeads()
      setLeads(data)
    } catch (error) {
      console.error("Failed to fetch leads:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeadsGenerated = (newLeads: Lead[]) => {
    setLeads((prev) => [...newLeads, ...prev])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">Generate and manage your B2B leads with AI-powered insights</p>
      </div>

      <LeadGenerationPanel onLeadsGenerated={handleLeadsGenerated} />
      <LeadsTable leads={leads} isLoading={isLoading} onLeadsChange={fetchLeads} />
    </div>
  )
}
