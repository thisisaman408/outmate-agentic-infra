"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Save } from "lucide-react"
import { ICPStep } from "@/components/onboarding/icp-step"
import { ScorePreview } from "@/components/onboarding/score-preview"
import { authService } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

import industriesData from "@/input_data/linkdin_industry.json"
import titlesData from "@/input_data/title.json"
import countriesData from "@/input_data/HQ_Country.json"

const INDUSTRIES: string[] = industriesData as string[]
const JOB_TITLES: string[] = Object.keys(titlesData)
const COUNTRIES: string[] = (countriesData as { name: string }[]).map((c) => c.name)

const COMPANY_SIZES = [
  "1-10", "11-50", "51-200", "201-500",
  "501-1000", "1001-5000", "5001-10000", "10000+",
]

const FUNDING_STAGES = [
  "Pre-seed", "Seed", "Series A", "Series B",
  "Series C", "Series D+", "IPO/Public", "Bootstrapped", "Any",
]

const API_URL = "/api/v1/auth"

interface ICPConfig {
  industries: string[]
  company_sizes: string[]
  geographies: string[]
  job_titles: string[]
  funding_stages: string[]
}

const EMPTY: ICPConfig = {
  industries: [],
  company_sizes: [],
  geographies: [],
  job_titles: [],
  funding_stages: [],
}

export default function ICPSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [icp, setIcp] = useState<ICPConfig>({ ...EMPTY })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/icp`, {
          headers: authService.getAuthHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.icp_config && data.icp_config.version) {
            setIcp({
              industries: data.icp_config.industries || [],
              company_sizes: data.icp_config.company_sizes || [],
              geographies: data.icp_config.geographies || [],
              job_titles: data.icp_config.job_titles || [],
              funding_stages: data.icp_config.funding_stages || [],
            })
          }
        }
      } catch (err) {
        console.error("Failed to load ICP config:", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/icp/update`, {
        method: "POST",
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(icp),
      })
      if (!res.ok) throw new Error("Save failed")
      toast({
        title: "ICP updated",
        description: "Your scoring criteria have been saved. Leads will be re-scored.",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save ICP configuration.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => router.push("/settings")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
          <h1 className="text-2xl font-bold text-[#1e1b4b]">ICP Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define your Ideal Customer Profile to improve lead scoring accuracy.
          </p>
        </div>
        <Button
          className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <div className="space-y-6">
        <ICPStep
          title="Industries"
          description="What industries do your ideal customers operate in?"
          options={INDUSTRIES}
          selected={icp.industries}
          onSelect={(v) => setIcp({ ...icp, industries: v })}
          suggestions={["Software Development", "SaaS", "Financial Services"]}
          searchPlaceholder="Search industries..."
        />

        <ICPStep
          title="Company sizes"
          description="What size companies are you targeting?"
          options={COMPANY_SIZES}
          selected={icp.company_sizes}
          onSelect={(v) => setIcp({ ...icp, company_sizes: v })}
          suggestions={["11-50", "51-200", "201-500"]}
        />

        <ICPStep
          title="Geographies"
          description="Where are your target customers located?"
          options={COUNTRIES}
          selected={icp.geographies}
          onSelect={(v) => setIcp({ ...icp, geographies: v })}
          suggestions={["United States", "United Kingdom", "Canada"]}
          searchPlaceholder="Search countries..."
        />

        <ICPStep
          title="Job titles"
          description="What roles do you sell to?"
          options={JOB_TITLES}
          selected={icp.job_titles}
          onSelect={(v) => setIcp({ ...icp, job_titles: v })}
          suggestions={["CEO", "CTO", "VP Sales", "VP Marketing"]}
          searchPlaceholder="Search job titles..."
        />

        <ICPStep
          title="Funding stages"
          description="What funding stage are your ideal customers?"
          options={FUNDING_STAGES}
          selected={icp.funding_stages}
          onSelect={(v) => setIcp({ ...icp, funding_stages: v })}
          suggestions={["Series A", "Series B", "Series C"]}
        />

        <ScorePreview selections={icp} />

        <div className="flex justify-end pt-4">
          <Button
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-8"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
