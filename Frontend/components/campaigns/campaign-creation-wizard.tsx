"use client"

import { useState, useEffect, useRef } from "react"
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
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"

const STEPS = ["Campaign Details", "Select Leads", "Generate Message", "Schedule & Launch"]
const MAX_LEADS = 3

const WIZARD_STATE_KEY = "campaign-wizard-state"

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
    SocialMessage: "",
    startDate: "",
    signals: "",
  })
  const [EmailConnected, setEmailConnected] = useState(false)
  const [EmailEmail, setEmailEmail] = useState("")
  const [SocialConnected, setSocialConnected] = useState(false)
  const [sendingRecipients, setSendingRecipients] = useState<Record<number, "email" | "Social">>({})
  const [sentRecipients, setSentRecipients] = useState<Record<number, "email" | "Social" | "both">>({})
  const [sendErrors, setSendErrors] = useState<Record<number, string>>({})

  // ── Automation Agent form injection + autopilot ──
  const agentForm = useCoPilotAgentStore(
    (state) => state.copilotForms?.['campaign_creation']
  )
  const clearCopilotForm = useCoPilotAgentStore((state) => state.clearCopilotForm)

  const [isAutopilot, setIsAutopilot] = useState(false)
  const autopilotStartDateRef = useRef<string | undefined>(undefined)
  const autopilotLeadsSelectedRef = useRef(false)
  const autopilotGeneratedRef = useRef(false)
  // Always-current snapshot of formData to avoid stale closures in effects
  const formDataRef = useRef(formData)
  useEffect(() => { formDataRef.current = formData }, [formData])

  // Step 0: fill form fields from agent, then advance to Select Leads
  useEffect(() => {
    if (!agentForm) return
    const { fields } = agentForm
    const f = fields as Record<string, any>
    setFormData((prev) => ({
      ...prev,
      ...(f.name !== undefined ? { name: f.name } : {}),
      ...(f.objective !== undefined ? { objective: f.objective } : {}),
      ...(f.signals !== undefined ? { signals: f.signals } : {}),
    }))
    autopilotStartDateRef.current = f.start_date
    autopilotLeadsSelectedRef.current = false
    autopilotGeneratedRef.current = false
    clearCopilotForm('campaign_creation')
    setIsAutopilot(true)
    setTimeout(() => setCurrentStep(1), 400)
  }, [agentForm])

  // Step 1: auto-select all available leads then advance to Generate Message
  useEffect(() => {
    if (!isAutopilot || currentStep !== 1 || leadPool.length === 0 || autopilotLeadsSelectedRef.current) return
    autopilotLeadsSelectedRef.current = true
    const ids = leadPool.slice(0, MAX_LEADS).map((l) => l.id)
    setFormData((prev) => ({ ...prev, leads: ids }))
    setTimeout(() => setCurrentStep(2), 600)
  }, [isAutopilot, currentStep, leadPool])

  // Step 2: auto-generate message using current formDataRef then advance to Schedule
  useEffect(() => {
    if (!isAutopilot || currentStep !== 2 || autopilotGeneratedRef.current) return
    autopilotGeneratedRef.current = true
    const fd = formDataRef.current
    if (!fd.objective) return
    const signals = fd.signals.split(",").map((s: string) => s.trim()).filter(Boolean)
    setIsGenerating(true)
    campaignsApi
      .generateMessage({ objective: fd.objective, leads: fd.leads, signals })
      .then((generated) => {
        const fallbackText = (generated.raw || generated.email_body || "").trim()
        let subject = generated.subject || ""
        let emailBody = generated.email_body || ""
        let linkedinMessage = generated.linkedin_message || ""
        if (fallbackText && (!subject || !linkedinMessage)) {
          const jsonMatch = fallbackText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0])
              subject = subject || parsed.subject || parsed.email_subject || ""
              emailBody = emailBody || parsed.email_body || parsed.body || ""
              linkedinMessage = linkedinMessage || parsed.linkedin_message || parsed.linkedin || ""
            } catch { /* ignore */ }
          }
        }
        setFormData((prev) => ({
          ...prev,
          subject: subject || prev.subject,
          message: emailBody || prev.message,
          SocialMessage: linkedinMessage || prev.SocialMessage,
        }))
        setTimeout(() => {
          setCurrentStep(3)
          if (autopilotStartDateRef.current) {
            setFormData((prev) => ({ ...prev, startDate: autopilotStartDateRef.current! }))
          }
        }, 500)
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to generate message", variant: "destructive" })
      })
      .finally(() => setIsGenerating(false))
  }, [isAutopilot, currentStep])

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
      const fallbackText = (generated.raw || generated.email_body || "").trim()
      let subject = generated.subject || formData.subject
      let emailBody = generated.email_body || formData.message
      let linkedinMessage = generated.linkedin_message || formData.SocialMessage

      if (fallbackText && (!subject || !linkedinMessage)) {
        const jsonMatch = fallbackText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            subject = subject || parsed.subject || parsed.email_subject || ""
            emailBody = emailBody || parsed.email_body || parsed.body || ""
            linkedinMessage = linkedinMessage || parsed.linkedin_message || parsed.linkedin || ""
          } catch {
            // ignore JSON parse errors
          }
        }
      }

      if (fallbackText && (!subject || !linkedinMessage)) {
        const subjectMatch = fallbackText.match(/subject\s*:\s*(.+)/i)
        const linkedinMatch = fallbackText.match(/linkedin(?:_message)?\s*:\s*([\s\S]*)/i)
        const bodyMatch = fallbackText.match(/email(?:_body)?\s*:\s*([\s\S]*?)(?:\n\s*linkedin|$)/i)
        subject = subject || (subjectMatch ? subjectMatch[1].trim() : "")
        emailBody = emailBody || (bodyMatch ? bodyMatch[1].trim() : emailBody)
        linkedinMessage = linkedinMessage || (linkedinMatch ? linkedinMatch[1].trim() : "")
      }

      setFormData({
        ...formData,
        subject,
        message: emailBody,
        SocialMessage: linkedinMessage,
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
      router.refresh()
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
      const API = ""
      const response = await fetch(`${API}/api/v1/companies/db?limit=${MAX_LEADS}`)
      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        throw new Error(errText || "Database lead fetch failed")
      }
      const payload = await response.json()
      const companies: any[] = payload?.data?.companies || []
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
    if (params.get("Email_connected") === "true") {
      setEmailConnected(true)
      setEmailEmail(params.get("Email_email") || "")
      toast({
        title: "Email connected",
        description: `Connected as ${params.get("Email_email")}`,
      })
      window.history.replaceState({}, "", window.location.pathname)
    }

    const API = ""
    fetch(`${API}/api/v1/campaigns/gmail/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) {
          setEmailConnected(true)
          setEmailEmail(data.email || "")
        }
      })
      .catch(() => {})
    fetch(`${API}/api/v1/campaigns/linkedin/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) setSocialConnected(true)
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
  const defaultSocialMessage = formData.SocialMessage || formData.message

  const handleConnectEmail = async () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        WIZARD_STATE_KEY,
        JSON.stringify({ currentStep, formData, leadPool })
      )
    }
    try {
      const API = ""
      const returnPath = "/campaigns/new"
      const res = await fetch(
        `${API}/api/v1/campaigns/Email/auth-url?return_to=${encodeURIComponent(returnPath)}`
      )
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (error) {
      toast({
        title: "Email connection failed",
        description: "Unable to start Email OAuth flow.",
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
    // Get user name from localStorage or use placeholder
    const userName = typeof window !== 'undefined' ? (localStorage.getItem('user_name') || 'Your Name') : 'Your Name'
    return template
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{firstName\}/g, firstName)
      .replace(/\[firstName\]/g, firstName)
      .replace(/\{\{companyName\}\}/g, companyName)
      .replace(/\{companyName\}/g, companyName)
      .replace(/\[companyName\]/g, companyName)
      .replace(/\{\{userName\}\}/g, userName)
      .replace(/\{userName\}/g, userName)
      .replace(/\[Your Name\]/g, userName)
      .replace(/\[userName\]/g, userName)
      // Remove brackets from any remaining bracketed text (e.g., [Product] -> Product)
      .replace(/\[([^\]]+)\]/g, '$1')
  }

  const handleSendEmail = async (recipientIdx: number, toEmail: string, subject: string, body: string) => {
    setSendingRecipients((prev) => ({ ...prev, [recipientIdx]: "email" }))
    setSendErrors((prev) => {
      const next = { ...prev }
      delete next[recipientIdx]
      return next
    })
    try {
      const API = ""
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
        [recipientIdx]: prev[recipientIdx] === "Social" ? "both" : "email",
      }))
      toast({
        title: "Email sent",
        description: "Message delivered via Email.",
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

  const handleSendSocial = async (recipientIdx: number, SocialUrl: string, message: string) => {
    setSendingRecipients((prev) => ({ ...prev, [recipientIdx]: "Social" }))
    setSendErrors((prev) => {
      const next = { ...prev }
      delete next[recipientIdx]
      return next
    })
    try {
      const API = ""
      const res = await fetch(`${API}/api/v1/campaigns/send-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: SocialUrl, message }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Send failed")
      }
      setSentRecipients((prev) => ({
        ...prev,
        [recipientIdx]: prev[recipientIdx] === "email" ? "both" : "Social",
      }))
      toast({
        title: "Social message sent",
        description: "Message delivered via Messaging provider.",
      })
    } catch (error: any) {
      setSendErrors((prev) => ({ ...prev, [recipientIdx]: error.message || "Social send failed" }))
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
                <Label htmlFor="SocialMessage">Social Message</Label>
                <Textarea
                  id="SocialMessage"
                  placeholder="Social touch copy..."
                  value={formData.SocialMessage}
                  onChange={(e) => setFormData({ ...formData, SocialMessage: e.target.value })}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  If blank, the email body will be reused for Social outreach.
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
                    <p className="font-semibold">Send via Email / Social</p>
                    <p className="text-xs text-muted-foreground">
                      Connect Email to send email and Messaging provider for Social outreach.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={EmailConnected ? "secondary" : "outline"}>
                      <Mail className="mr-1 h-3 w-3" />
                      {EmailConnected ? `Email ready (${EmailEmail || "connected"})` : "Email not connected"}
                    </Badge>
                    <Badge variant={SocialConnected ? "secondary" : "outline"}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {SocialConnected ? "Social ready" : "Social unavailable"}
                    </Badge>
                    {!EmailConnected && (
                      <Button size="xs" variant="outline" onClick={handleConnectEmail}>
                        Connect Email
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
                        const personalizedSocial = personalizetext(defaultSocialMessage, lead)
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
                                    {sent === "both" ? "Email + Social sent" : `${sent} sent`}
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
                                disabled={!EmailConnected || !lead.email || !!sending}
                                onClick={() => handleSendEmail(idx, lead.email, personalizedSubject, personalizedBody)}
                                title={
                                  !EmailConnected ? "Connect Email first" : !lead.email ? "No email available" : "Send email"
                                }
                                className="gap-1"
                              >
                                <Mail className="h-3 w-3" /> Email
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!SocialConnected || !lead.Social}
                                onClick={() => handleSendSocial(idx, lead.Social || "", personalizedSocial)}
                                title={!SocialConnected ? "Social not connected" : !lead.Social ? "No Social URL" : "Send Social message"}
                                className="gap-1"
                              >
                                <ExternalLink className="h-3 w-3" /> Social
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
