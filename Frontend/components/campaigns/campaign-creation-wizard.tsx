"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { campaignsApi, type CreateCampaignRequest } from "@/lib/api/campaigns"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const STEPS = ["Campaign Details", "Select Leads", "Generate Message", "Schedule & Launch"]

export function CampaignCreationWizard() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "email" as CreateCampaignRequest["type"],
    objective: "",
    leads: [] as string[],
    message: "",
    startDate: "",
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
      const message = await campaignsApi.generateMessage(formData.objective, formData.leads)
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
        type: formData.type,
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

  const canGoNext = () => {
    if (currentStep === 0) return formData.name && formData.type && formData.objective
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
                <Label htmlFor="type">Campaign Type</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="slack">Slack Notification</SelectItem>
                    <SelectItem value="multi-channel">Multi-Channel</SelectItem>
                  </SelectContent>
                </Select>
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
            </>
          )}

          {/* Step 1: Select Leads */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">
                  In a production environment, you would select leads from your database here.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFormData({ ...formData, leads: ["1", "2", "3", "4", "5"] })}
                >
                  Simulate Lead Selection (5 leads)
                </Button>
              </div>
              {formData.leads.length > 0 && (
                <div>
                  <Label>Selected Leads</Label>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{formData.leads.length} leads selected</Badge>
                  </div>
                </div>
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
                    <span className="text-muted-foreground">Type:</span> {formData.type}
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
