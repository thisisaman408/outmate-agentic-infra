"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { campaignsApi, type CreateCampaignRequest } from "@/lib/api/campaigns"
import { leadsApi, type Lead } from "@/lib/api/leads"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const STEPS = ["Campaign Details", "Select Leads", "Generate Message", "Schedule & Launch"]

export function CampaignCreationWizard() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [leadPool, setLeadPool] = useState<Lead[]>([])
  const [isLeadLoading, setIsLeadLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    objective: "",
    leads: [] as string[],
    message: "",
    startDate: "",
    signals: "",
  })

  const handleGenerateMessage = async () => {
    if (!formData.objective) {
      toast({
        title: "Error",
        description: "Please enter a campaign objective first",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const signals = formData.signals
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const message = await campaignsApi.generateMessage({
        objective: formData.objective,
        leads: formData.leads,
        signals,
      })
      setFormData({ ...formData, message })
      toast({
        title: "Success",
        description: "AI-generated message is ready",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate message",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateCampaign = async () => {
    setIsCreating(true)
    try {
      const request: CreateCampaignRequest = {
        name: formData.name,
        objective: formData.objective,
        leads: formData.leads,
        schedule: formData.startDate
          ? {
              startDate: formData.startDate,
            }
          : undefined,
      }
      await campaignsApi.createCampaign(request)
      toast({
        title: "Success",
        description: "Campaign created successfully",
      })
      router.push("/campaigns")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const toggleLeadSelection = (leadId: string) => {
    setFormData((prev) => {
      const nextLeads = prev.leads.includes(leadId)
        ? prev.leads.filter((id) => id !== leadId)
        : [...prev.leads, leadId]
      return { ...prev, leads: nextLeads }
    })
  }

  const loadLeads = async () => {
    setIsLeadLoading(true)
    try {
      const leads = await leadsApi.getLeads({
        prompt: "",
        filters: {
          industry: ["software"],
        },
        limit: 3,
      })
      setLeadPool(leads)
    } catch (error) {
      toast({
        title: "Lead load failed",
        description: "Could not fetch leads from the database.",
        variant: "destructive",
      })
    } finally {
      setIsLeadLoading(false)
    }
  }

  useEffect(() => {
    if (currentStep === 1 && leadPool.length === 0) {
      loadLeads()
    }
  }, [currentStep, leadPool.length])

  const canGoNext = () => {
    if (currentStep === 0) return formData.name && formData.objective
    if (currentStep === 1) return formData.leads.length > 0
    if (currentStep === 2) return formData.message
    return true
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  index < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === currentStep
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {index < currentStep ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
              </div>
              <span
                className={`text-sm font-medium ${index === currentStep ? "text-foreground" : "text-muted-foreground"}`}
              >
                {step}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-4 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Set up your campaign basics"}
            {currentStep === 1 && "Choose which leads to target"}
            {currentStep === 2 && "Create or generate your campaign message"}
            {currentStep === 3 && "Schedule and launch your campaign"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Campaign Details */}
          {currentStep === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  placeholder="Q1 Enterprise Outreach"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objective">Campaign Objective</Label>
                <Textarea
                  id="objective"
                  placeholder="Introduce our new enterprise features to qualified leads and book discovery calls"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signals">Signal references</Label>
                <Textarea
                  id="signals"
                  placeholder="e.g. raised Series A, expanded hiring in Europe, adopted new AI platform"
                  value={formData.signals}
                  onChange={(e) => setFormData({ ...formData, signals: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Provide the signals you want the AI to mention, separated by commas.
                </p>
              </div>
            </>
          )}

          {/* Step 1: Select Leads */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground mb-2">
                    Select actual leads from the seeker pool below.
                  </p>
                  <Button variant="outline" size="sm" onClick={loadLeads} disabled={isLeadLoading}>
                    {isLeadLoading ? "Refreshing..." : "Refresh Leads"}
                  </Button>
                </div>
              </div>
              {isLeadLoading ? (
                <p className="text-sm text-muted-foreground">Loading leads...</p>
              ) : leadPool.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads available yet.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {leadPool.map((lead) => {
                      const selected = formData.leads.includes(lead.id)
                      return (
                        <Card
                          key={lead.id}
                          className={`border ${selected ? "border-primary bg-primary/5" : "border-border"} space-y-2 p-4`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-base font-medium">{lead.companyName}</p>
                              <p className="text-xs text-muted-foreground">{lead.industry}</p>
                            </div>
                            <Button size="sm" variant={selected ? "secondary" : "outline"} onClick={() => toggleLeadSelection(lead.id)}>
                              {selected ? "Selected" : "Select"}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>{lead.location}</p>
                            <p>Signals: {lead.signalsCount} · Score: {lead.score}</p>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{formData.leads.length} leads selected</Badge>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Generate Message */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Campaign Message</Label>
                <Button variant="outline" size="sm" onClick={handleGenerateMessage} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Generate
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="message"
                placeholder="Your campaign message will appear here..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={12}
              />
              <p className="text-xs text-muted-foreground">
                Use variables like {`{{firstName}}`}, {`{{companyName}}`} to personalize messages
              </p>
            </div>
          )}

          {/* Step 3: Schedule & Launch */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date (Optional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <h4 className="font-medium">Campaign Summary</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Name:</span> {formData.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Leads:</span> {formData.leads.length}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> Draft
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} disabled={currentStep === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canGoNext()}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreateCampaign} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
