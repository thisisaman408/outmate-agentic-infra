"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, CheckCircle2, Check, ChevronLeft, ChevronRight, ExternalLink, Send, Mail, Copy } from "lucide-react"
import { campaignsApi, type CreateCampaignRequest } from "@/lib/api/campaigns"
import { transformCompanyToLead, type Lead } from "@/lib/api/leads"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const STEPS = ["Campaign Details", "Select Leads", "Generate Message", "Schedule & Launch"]
const MAX_LEADS = 3

const WIZARD_STATE_KEY = "campaign-wizard-state"

const AI_LEADS_PROMPT =
  "Find B2B SaaS companies in the US and Canada that raised Series A or Series B funding with 50 to 500 employees."

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
    subject: "",
    message: "",
    linkedinMessage: "",
    startDate: "",
    signals: "",
  })
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [sendingRecipients, setSendingRecipients] = useState<Record<number, "email" | "linkedin">>({})
  const [sentRecipients, setSentRecipients] = useState<Record<number, "email" | "linkedin" | "both">>({})
  const [sendErrors, setSendErrors] = useState<Record<number, string>>({})

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
      const generated = await campaignsApi.generateMessage({
        objective: formData.objective,
        leads: formData.leads,
        signals,
      })
      setFormData({
        ...formData,
        subject: generated.subject || formData.subject,
        message: generated.email_body || formData.message,
        linkedinMessage: generated.linkedin_message || formData.linkedinMessage,
      })
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
      const alreadySelected = prev.leads.includes(leadId)
      if (!alreadySelected && prev.leads.length >= MAX_LEADS) {
        toast({
          title: "Lead limit",
          description: `You can select up to ${MAX_LEADS} leads.`,
          variant: "destructive",
        })
        return prev
      }
      const nextLeads = alreadySelected
        ? prev.leads.filter((id) => id !== leadId)
        : [...prev.leads, leadId]
      return { ...prev, leads: nextLeads }
    })
  }

  const loadLeads = async () => {
    setIsLeadLoading(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${API}/api/explorium/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: AI_LEADS_PROMPT }),
      })
      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        throw new Error(errText || "Explorium search failed")
      }
      const payload = await response.json()
      const companies: any[] = payload?.results?.data || []
      const leads = companies.slice(0, MAX_LEADS).map(transformCompanyToLead)
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

  useEffect(() => {
    if (typeof window === "undefined") return

    const cached = window.sessionStorage.getItem(WIZARD_STATE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.formData) setFormData(parsed.formData)
        if (parsed.leadPool) setLeadPool(parsed.leadPool)
        if (typeof parsed.currentStep === "number") setCurrentStep(parsed.currentStep)
      } finally {
        window.sessionStorage.removeItem(WIZARD_STATE_KEY)
      }
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get("gmail_connected") === "true") {
      setGmailConnected(true)
      setGmailEmail(params.get("gmail_email") || "")
      toast({
        title: "Gmail connected",
        description: `Connected as ${params.get("gmail_email")}`,
      })
      window.history.replaceState({}, "", window.location.pathname)
    }

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    fetch(`${API}/api/v1/campaigns/gmail/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) {
          setGmailConnected(true)
          setGmailEmail(data.email || "")
        }
      })
      .catch(() => {})
    fetch(`${API}/api/v1/campaigns/linkedin/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) setLinkedinConnected(true)
      })
      .catch(() => {})
  }, [toast])

  const canGoNext = () => {
    if (currentStep === 0) return formData.name && formData.objective
    if (currentStep === 1) return formData.leads.length > 0
    if (currentStep === 2) return formData.message
    return true
  }

  const selectedLeadDetails = leadPool.filter((lead) => formData.leads.includes(lead.id))
  const defaultEmailSubject = formData.subject || `${formData.name || "Campaign"} Outreach`
  const defaultLinkedInMessage = formData.linkedinMessage || formData.message

  const handleConnectGmail = async () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        WIZARD_STATE_KEY,
        JSON.stringify({ currentStep, formData, leadPool })
      )
    }
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const returnPath = "/campaigns/new"
      const res = await fetch(
        `${API}/api/v1/campaigns/gmail/auth-url?return_to=${encodeURIComponent(returnPath)}`
      )
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (error) {
      toast({
        title: "Gmail connection failed",
        description: "Unable to start Gmail OAuth flow.",
        variant: "destructive",
      })
    }
  }

  const getFirstName = (lead: Lead) => {
    if (lead.contactName) {
      return lead.contactName.split(" ")[0]
    }
    if (lead.companyName) {
      return lead.companyName.split(" ")[0]
    }
    return "there"
  }

  const personalizetext = (template: string, lead: Lead) => {
    const firstName = getFirstName(lead)
    const companyName = lead.companyName || lead.domain || "your company"
    return template
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{companyName\}\}/g, companyName)
  }

  const handleSendEmail = async (recipientIdx: number, toEmail: string, subject: string, body: string) => {
    setSendingRecipients((prev) => ({ ...prev, [recipientIdx]: "email" }))
    setSendErrors((prev) => {
      const next = { ...prev }
      delete next[recipientIdx]
      return next
    })
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${API}/api/v1/campaigns/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: toEmail, subject, body }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients((prev) => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "linkedin" ? "both" : "email",
      }))
      toast({
        title: "Email sent",
        description: "Message delivered via Gmail.",
      })
    } catch (error: any) {
      setSendErrors((prev) => ({ ...prev, [recipientIdx]: error.message || "Email send failed" }))
    } finally {
      setSendingRecipients((prev) => {
        const next = { ...prev }
        delete next[recipientIdx]
        return next
      })
    }
  }

  const handleSendLinkedIn = async (recipientIdx: number, linkedinUrl: string, message: string) => {
    setSendingRecipients((prev) => ({ ...prev, [recipientIdx]: "linkedin" }))
    setSendErrors((prev) => {
      const next = { ...prev }
      delete next[recipientIdx]
      return next
    })
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${API}/api/v1/campaigns/send-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: linkedinUrl, message }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients((prev) => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "email" ? "both" : "linkedin",
      }))
      toast({
        title: "LinkedIn message sent",
        description: "Message delivered via Unipile.",
      })
    } catch (error: any) {
      setSendErrors((prev) => ({ ...prev, [recipientIdx]: error.message || "LinkedIn send failed" }))
    } finally {
      setSendingRecipients((prev) => {
        const next = { ...prev }
        delete next[recipientIdx]
        return next
      })
    }
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
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Campaign subject line"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  disabled={isGenerating}
                />
              </div>
              <Textarea
                id="message"
                placeholder="Your campaign message will appear here..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={12}
              />
              <div className="space-y-2">
                <Label htmlFor="linkedinMessage">LinkedIn Message</Label>
                <Textarea
                  id="linkedinMessage"
                  placeholder="LinkedIn touch copy..."
                  value={formData.linkedinMessage}
                  onChange={(e) => setFormData({ ...formData, linkedinMessage: e.target.value })}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  If blank, the email body will be reused for LinkedIn outreach.
                </p>
              </div>
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
              <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Send via Gmail / LinkedIn</p>
                    <p className="text-xs text-muted-foreground">
                      Connect Gmail to send email and Unipile for LinkedIn outreach.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={gmailConnected ? "secondary" : "outline"}>
                      <Mail className="mr-1 h-3 w-3" />
                      {gmailConnected ? `Gmail ready (${gmailEmail || "connected"})` : "Gmail not connected"}
                    </Badge>
                    <Badge variant={linkedinConnected ? "secondary" : "outline"}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {linkedinConnected ? "LinkedIn ready" : "LinkedIn unavailable"}
                    </Badge>
                    {!gmailConnected && (
                      <Button size="xs" variant="outline" onClick={handleConnectGmail}>
                        Connect Gmail
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedLeadDetails.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Select leads in the previous step to start sending outreach.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedLeadDetails.map((lead, idx) => {
                        const personalizedSubject = personalizetext(defaultEmailSubject, lead)
                        const personalizedBody = personalizetext(formData.message, lead)
                        const personalizedLinkedIn = personalizetext(defaultLinkedInMessage, lead)
                        const sending = sendingRecipients[idx]
                        const sent = sentRecipients[idx]
                        const error = sendErrors[idx]
                        return (
                          <div key={lead.id} className="rounded-lg border px-3 py-3">
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="font-medium">{lead.companyName || lead.domain || "Lead"}</p>
                                <p className="text-xs text-muted-foreground">{lead.industry}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {sent && (
                                  <Badge variant="outline" className="text-xs">
                                    <Check className="mr-1 h-3 w-3" />
                                    {sent === "both" ? "Email + LinkedIn sent" : `${sent} sent`}
                                  </Badge>
                                )}
                                {sending && (
                                  <Badge variant="outline" className="text-xs">
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Sending...
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!gmailConnected || !lead.email || !!sending}
                                onClick={() => handleSendEmail(idx, lead.email, personalizedSubject, personalizedBody)}
                                title={
                                  !gmailConnected ? "Connect Gmail first" : !lead.email ? "No email available" : "Send email"
                                }
                                className="gap-1"
                              >
                                <Mail className="h-3 w-3" /> Email
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!linkedinConnected || !lead.linkedin}
                                onClick={() => handleSendLinkedIn(idx, lead.linkedin || "", personalizedLinkedIn)}
                                title={!linkedinConnected ? "LinkedIn not connected" : !lead.linkedin ? "No LinkedIn URL" : "Send LinkedIn message"}
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" /> LinkedIn
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Subject: ${personalizedSubject}\n\n${personalizedBody}`
                                  )
                                  toast({
                                    title: "Copied",
                                    description: "Email body copied to clipboard.",
                                  })
                                }}
                                className="gap-1"
                              >
                                <Copy className="h-3 w-3" /> Copy Email
                              </Button>
                            </div>
                            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )}
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
