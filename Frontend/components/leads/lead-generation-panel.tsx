"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Sparkles, Loader2 } from "lucide-react"
import { leadsApi, type GenerateLeadsRequest, type Lead } from "@/lib/api/leads"
import { useToast } from "@/hooks/use-toast"

interface LeadGenerationPanelProps {
  onLeadsGenerated: (leads: Lead[]) => void
}

export function LeadGenerationPanel({ onLeadsGenerated }: LeadGenerationPanelProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [filters, setFilters] = useState({
    location: "",
    industry: "",
    companySize: "",
    techStack: "",
  })

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt to generate leads",
        variant: "destructive",
      })
      return
    }

    if (!filters.location.trim() && !filters.industry.trim()) {
      toast({
        title: "Add filters",
        description: "Please specify at least an industry or location before running the search.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const request: GenerateLeadsRequest = {
        prompt,
        filters: {
          location: filters.location || undefined,
          industry: filters.industry || undefined,
          companySize: filters.companySize || undefined,
          techStack: filters.techStack || undefined,
        },
      }
      const leads = await leadsApi.generateLeads(request)
      onLeadsGenerated(leads)
      toast({
        title: "Success",
        description: `Generated ${leads.length} leads matching your criteria`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate leads. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Lead Generation
        </CardTitle>
        <CardDescription>Describe your ideal customer profile and let AI find matching leads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Natural Language Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="Find B2B SaaS companies in the US with 100-500 employees that recently raised funding..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={isGenerating}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., San Francisco, CA"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={filters.industry} onValueChange={(value) => setFilters({ ...filters, industry: value })}>
              <SelectTrigger id="industry" disabled={isGenerating}>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="fintech">Fintech</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="ai-ml">AI/ML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Select
              value={filters.companySize}
              onValueChange={(value) => setFilters({ ...filters, companySize: value })}
            >
              <SelectTrigger id="companySize" disabled={isGenerating}>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-50">1-50 employees</SelectItem>
                <SelectItem value="50-100">50-100 employees</SelectItem>
                <SelectItem value="100-500">100-500 employees</SelectItem>
                <SelectItem value="500-1000">500-1000 employees</SelectItem>
                <SelectItem value="1000+">1000+ employees</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="techStack">Tech Stack</Label>
            <Input
              id="techStack"
              placeholder="e.g., Salesforce, AWS"
              value={filters.techStack}
              onChange={(e) => setFilters({ ...filters, techStack: e.target.value })}
              disabled={isGenerating}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Leads...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Leads
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
