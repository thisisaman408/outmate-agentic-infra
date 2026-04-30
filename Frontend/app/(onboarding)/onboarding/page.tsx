"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Circle,
  Loader2,
  Copy,
  Link,
  ArrowRight,
  Plus,
  Phone,
  MessageSquare,
  UserPlus,
  HelpCircle,
  Mail as MailIcon,
  MessageCircle,
  Trophy,
  ExternalLink,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

// ── Steps ────────────────────────────────────────────────────────────
const STEPS = [
  { id: "setup", label: "Set up your workspace" },
  { id: "tracking", label: "Add tracking script" },
  { id: "icp", label: "Define your ICP" },
  { id: "crm", label: "Connect your CRM" },
  { id: "teammates", label: "Invite teammates" },
  { id: "about", label: "Tell us about you" },
  { id: "prospects", label: "Save your first prospects" },
]

// ── ICP State ────────────────────────────────────────────────────────
interface ICPState {
  industries: string
  job_titles: string
  company_size: string
  geography: string
  funding_stage: string
}

const EMPTY_ICP: ICPState = {
  industries: "",
  job_titles: "",
  company_size: "",
  geography: "",
  funding_stage: "",
}

const INDUSTRIES = [
  "Software & SaaS", "Financial Services", "Healthcare", "E-commerce",
  "Manufacturing", "Real Estate", "Education", "Marketing & Advertising",
  "Professional Services", "Retail", "Human Resources", "Legal Services"
]

const JOB_TITLES = [
  "CEO / Founder", "VP of Sales", "Sales Manager", "Head of Growth",
  "Marketing Director", "Operations Manager", "Account Executive",
  "Business Development Manager", "Product Manager", "CTO"
]

// ── "Tell us about you" State ─────────────────────────────────────────
interface AboutState {
  movie_genre: string
  outbound_reason: string
  heard_from: string
}

const EMPTY_ABOUT: AboutState = {
  movie_genre: "",
  outbound_reason: "",
  heard_from: "",
}

// ── Teammate row ──────────────────────────────────────────────────────
interface TeammateRow {
  email: string
  role: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [activeModal, setActiveModal] = useState<"none" | "dev" | "trouble" | "chat" | "call">("none")
  const [devEmail, setDevEmail] = useState("")
  const [supportMessage, setSupportMessage] = useState("")
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false)

  // Step 0: Workspace
  const [formData, setFormData] = useState({
    website: "",
    companyName: user?.workspace || "",
    workspaceTitle: "",
    userName: user?.name || "",
    role: "",
    workEmail: user?.email || "",
  })

  // Step 1: Tracking
  const [trackingPlatform, setTrackingPlatform] = useState("")
  const [verifyUrl, setVerifyUrl] = useState("")
  const [pixelKey, setPixelKey] = useState<string>("")
  const [visitorState, setVisitorState] = useState<'idle' | 'monitoring' | 'found' | 'demo'>('idle')
  const [firstVisitor, setFirstVisitor] = useState<any>(null)

  // Step 2: ICP
  const [icp, setIcp] = useState<ICPState>({ ...EMPTY_ICP })

  // Step 3: CRM
  const [selectedCRM, setSelectedCRM] = useState("")
  const [crmValue, setCrmValue] = useState("")
  const [connectedCRMs, setConnectedCRMs] = useState<string[]>([])
  const [isConnectingCRM, setIsConnectingCRM] = useState(false)
  const [slackConnected, setSlackConnected] = useState(false)
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("")
  const [isConnectingSlack, setIsConnectingSlack] = useState(false)
  const [selectedOutreachTools, setSelectedOutreachTools] = useState<string[]>([])

  // Step 4: Teammates
  const [teammates, setTeammates] = useState<TeammateRow[]>([{ email: "", role: "Member" }])
  const [inviteLink, setInviteLink] = useState("")

  // Step 5: About
  const [about, setAbout] = useState<AboutState>({ ...EMPTY_ABOUT })

  // Step 6: Prospects signals
  const [signals, setSignals] = useState<string[]>([])

  // Fetch Site Config (Pixel Key)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await authService.getSiteConfig()
        if (config.pixel_key) setPixelKey(config.pixel_key)
      } catch (err) {
        console.error("Failed to fetch site config:", err)
      }
    }
    fetchConfig()
  }, [])

  // Polling for first visitor
  useEffect(() => {
    let interval: any
    if (currentStep === 1 && visitorState === 'monitoring') {
      const checkVisitor = async () => {
        try {
          const resp = await fetch("/api/v1/visitors/first-success", {
            headers: authService.getAuthHeaders()
          })
          const data = await resp.json()
          if (data.status === 'success') {
            setFirstVisitor(data.visitor)
            setVisitorState('found')
          } else if (data.status === 'demo') {
            setFirstVisitor(data.visitor)
            setVisitorState('demo')
          }
        } catch (err) {
          console.error("Polling error:", err)
        }
      }
      checkVisitor()
      interval = setInterval(checkVisitor, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentStep, visitorState])

  const progress = ((currentStep) / STEPS.length) * 100

  useEffect(() => {
    const returnStep = localStorage.getItem("onboarding_return_step")
    if (returnStep) {
      localStorage.removeItem("onboarding_return_step")
      const stepIdx = STEPS.findIndex((s) => s.id === returnStep)
      if (stepIdx !== -1) setCurrentStep(stepIdx)
    }
  }, [])

  const handleNext = async () => {
    setIsSaving(true)
    try {
      if (currentStep === 0) {
        await authService.updateOnboarding({
          step: 2,
          website_url: formData.website,
          user_role: formData.role,
          onboarding_data: {
            company_name: formData.companyName,
            workspace_title: formData.workspaceTitle,
            user_name: formData.userName,
          },
        })
      }
      if (currentStep === 1) {
        await authService.updateOnboarding({ step: 3 })
      }
      if (currentStep === 2) {
        await authService.updateOnboarding({
          step: 4,
          icp_config: {
            industries: icp.industries ? [icp.industries] : [],
            job_titles: icp.job_titles ? [icp.job_titles] : [],
            company_sizes: icp.company_size ? [icp.company_size] : [],
            geographies: icp.geography ? [icp.geography] : [],
            funding_stages: icp.funding_stage ? [icp.funding_stage] : [],
          },
        })
      }
      if (currentStep === 3) {
        await authService.updateOnboarding({ step: 5 })
      }
      if (currentStep === 4) {
        await authService.updateOnboarding({ step: 6 })
      }
      if (currentStep === 5) {
        await authService.updateOnboarding({ step: 7 })
      }
      if (currentStep === 6) {
        await authService.updateOnboarding({ completed: true })
        router.push("/dashboard")
        return
      }
      if (currentStep < STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1)
      }
    } catch (err) {
      console.error("Failed to update onboarding:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const connectIntegration = async (slug: string) => {
    const val = crmValue
    if (!val && slug !== 'gmail') {
      toast.error(`Please provide a value for ${slug}`)
      return
    }

    if (slug === "slack") setIsConnectingSlack(true)
    else setIsConnectingCRM(true)

    try {
      if (slug === "gmail") {
        const { auth_url } = await authService.getIntegrationAuthUrl(slug)
        if (auth_url) window.location.href = auth_url
        return
      }

      await authService.connectIntegration(slug, val)
      toast.success(`${slug.charAt(0).toUpperCase() + slug.slice(1)} connected!`)
      setConnectedCRMs(prev => [...prev, slug])
      if (slug === "slack") setSlackConnected(true)
      setSelectedCRM("")
      setCrmValue("")
    } catch (err) {
      console.error(`Failed to connect ${slug}:`, err)
      toast.error(`Failed to connect ${slug}`)
    } finally {
      if (slug === "slack") setIsConnectingSlack(false)
      else setIsConnectingCRM(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1)
  }

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((prev) => prev + 1)
    else router.push("/dashboard")
  }

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = { credits: 0, available: 500, done: `${currentStep}/${STEPS.length}` }

  // ── Step content ──────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      // ── Step 0: Workspace ──
      case 0:
        return (
          <StepShell title="Set up your workspace" duration="1 min">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Website URL</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://yourcompany.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="h-10 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30"
                  />
                  <Button className="bg-[#b4b7e4] hover:bg-[#a1a5db] text-white font-bold h-10 px-5 shrink-0 transition-colors">
                    Scan website
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Company name</label>
                  <Input
                    placeholder="Acme Inc."
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="h-10 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Workspace title</label>
                  <Input
                    placeholder="My Workspace"
                    value={formData.workspaceTitle}
                    onChange={(e) => setFormData({ ...formData, workspaceTitle: e.target.value })}
                    className="h-10 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Your name</label>
                  <Input
                    placeholder="Jane Doe"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    className="h-10 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Role</label>
                  <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                    <SelectTrigger className="h-10 border-gray-200 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceo">CEO / Founder</SelectItem>
                      <SelectItem value="sales">Sales Leader</SelectItem>
                      <SelectItem value="marketing">Marketing Leader</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Work email</label>
                <Input
                  placeholder="jane@company.com"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  className="h-10 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30"
                />
              </div>
              <SaveBtn onClick={handleNext} isSaving={isSaving} />
            </div>
          </StepShell>
        )

      // ── Step 1: Tracking ──
      case 1:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 max-w-2xl mx-auto w-full space-y-6">
            <StepShell title="Install Tracking" duration="2 min">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-gray-700">1. Install this snippet</label>
                  <div className="bg-slate-900 rounded-xl p-5 font-mono text-[11px] text-indigo-300 relative group border border-slate-800 shadow-2xl">
                    <code className="block whitespace-pre-wrap leading-relaxed">
                      {`<!-- Outmate.ai Tracking -->\n<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/visitors/pixel.js"\n  data-pixel-key="${pixelKey || 'pk_loading...'}"\n  async></script>`}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 text-indigo-400 hover:text-white hover:bg-white/10 h-8 font-bold text-[10px]"
                      onClick={() => navigator.clipboard.writeText(`<script src="${window.location.origin}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey || 'pk_loading...'}" async></script>`)}
                    >
                      Copy Snippet
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Where are you adding this?</label>
                  <div className="flex flex-wrap gap-2">
                    {["manual", "gtm", "webflow", "wordpress", "framer", "shopify"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setTrackingPlatform(p)}
                        className={`px-4 py-1.5 rounded-full border text-[12px] font-bold transition-all ${trackingPlatform === p ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"}`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-[13px] font-semibold text-gray-700">2. URL to verify</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://yourcompany.com"
                      value={verifyUrl}
                      onChange={(e) => setVerifyUrl(e.target.value)}
                      className="h-11 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30 font-bold"
                    />
                    <Button
                      onClick={() => setVisitorState('monitoring')}
                      disabled={!verifyUrl || visitorState === 'monitoring'}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl transition-all shadow-lg shadow-indigo-100"
                    >
                      Verify
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-100">
                  <Button variant="outline" onClick={handleBack} className="h-11 px-8 font-bold border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl">
                    ← Back
                  </Button>
                  <SaveBtn
                    onClick={handleNext}
                    isSaving={isSaving}
                    label={visitorState === 'monitoring' ? "Continue anyway" : "Save & continue"}
                  />
                </div>
              </div>
            </StepShell>

            {visitorState === 'monitoring' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-indigo-100 rounded-[2rem] bg-white shadow-xl shadow-indigo-50/50"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20" />
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 className="h-12 w-12 text-indigo-500" />
                  </motion.div>
                </div>
                <h4 className="font-black text-[#111827] text-xl mb-2">Monitoring your website...</h4>
                <p className="text-sm text-slate-500 font-bold text-center max-w-[340px] leading-relaxed">
                  The pixel is waiting for a visitor. Once someone lands on your site, we'll reveal their identity here in real-time.
                </p>

                <div className="flex flex-col items-center gap-4 mt-8">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Live Listener Active</span>
                  </div>
                </div>
              </motion.div>
            )}

            {visitorState === 'found' && firstVisitor && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-full">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-black text-green-700 uppercase tracking-wider">First Lead Captured</span>
                  </div>
                  <h3 className="text-2xl font-black text-[#111827]">Boom! We caught someone.</h3>
                </div>

                <div className="bg-white border-2 border-indigo-50 rounded-[2rem] p-8 shadow-2xl shadow-indigo-100/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-lg shadow-indigo-200">
                      High Intent
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-200">
                      {firstVisitor.company?.[0] || 'V'}
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <h5 className="font-black text-[#111827] text-3xl leading-none mb-1">{firstVisitor.company}</h5>
                        <p className="text-sm font-bold text-slate-400">{firstVisitor.domain}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-black text-slate-600 rounded-xl border border-slate-100 uppercase tracking-wider">
                          {firstVisitor.industry || 'Technology'}
                        </div>
                        <div className="px-3 py-1.5 bg-indigo-50 text-[11px] font-black text-indigo-700 rounded-xl border border-indigo-100 uppercase tracking-wider">
                          {Math.round(firstVisitor.intent_score * 100)}% Match
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col md:flex-row gap-6 justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-md flex items-center justify-center text-lg font-black text-slate-600">
                        {firstVisitor.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 leading-none">{firstVisitor.full_name}</p>
                        <p className="text-sm font-bold text-slate-500">{firstVisitor.job_title || 'Decision Maker'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="h-12 px-6 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                        View Profile <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button className="h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200" onClick={handleNext}>
                        Continue →
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )

      // ── Step 2: ICP ──
      case 2:
        return (
          <StepShell title="Define your ICP" duration="2 min">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Target industries</label>
                <Select value={icp.industries} onValueChange={(val) => setIcp({ ...icp, industries: val })}>
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30">
                    <SelectValue placeholder="Select target industries..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Decision-maker titles</label>
                <Select value={icp.job_titles} onValueChange={(val) => setIcp({ ...icp, job_titles: val })}>
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30">
                    <SelectValue placeholder="Select decision-maker titles..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TITLES.map((title) => (
                      <SelectItem key={title} value={title}>{title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Company size</label>
                <Select value={icp.company_size} onValueChange={(val) => setIcp({ ...icp, company_size: val })}>
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30">
                    <SelectValue placeholder="Select company size..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10000+"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Geography</label>
                <Select value={icp.geography} onValueChange={(val) => setIcp({ ...icp, geography: val })}>
                  <SelectTrigger className="h-10 border-gray-200 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30">
                    <SelectValue placeholder="Select geography..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["United States", "Europe", "United Kingdom", "Canada", "Australia", "Global"].map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleBack} className="h-11 px-8 font-bold border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl">
                  ← Back
                </Button>
                <SaveBtn onClick={handleNext} isSaving={isSaving} />
              </div>
            </div>
          </StepShell>
        )

      // ── Step 3: CRM ──
      case 3:
        const crms = [
          { id: "hubspot", label: "HubSpot", emoji: "🟠" },
          { id: "salesforce", label: "Salesforce", emoji: "☁️" },
          { id: "pipedrive", label: "Pipedrive", emoji: "🟢" },
          { id: "zoho-crm", label: "Zoho", emoji: "🔴" },
          { id: "close", label: "Close", emoji: "🔵" },
          { id: "slack", label: "Slack", emoji: "💬" },
          { id: "gmail", label: "Gmail", emoji: "📧" },
          { id: "none", label: "No CRM yet", emoji: "—" },
        ]

        const outreachTools = ["Smartlead", "Instantly", "Apollo", "Clay", "Lemlist", "LinkedIn Sales Nav", "None yet"]

        return (
          <StepShell title="Connect your CRM" duration="1 min">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Select your CRM</label>
                <div className="grid grid-cols-3 gap-4">
                  {crms.map((crm) => (
                    <button
                      key={crm.id}
                      onClick={() => {
                        if (connectedCRMs.includes(crm.id)) return
                        setSelectedCRM(crm.id)
                        setCrmValue("")
                      }}
                      className={`flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${selectedCRM === crm.id
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100"
                        : connectedCRMs.includes(crm.id)
                          ? "border-green-200 bg-green-50/30 opacity-80"
                          : "border-gray-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50"
                        }`}
                    >
                      <span className="text-3xl">{crm.emoji}</span>
                      <span className={`text-xs font-black ${selectedCRM === crm.id ? "text-indigo-700" : "text-gray-600"}`}>
                        {connectedCRMs.includes(crm.id) ? "Connected ✅" : crm.label}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedCRM && !connectedCRMs.includes(selectedCRM) && selectedCRM !== "none" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-800 text-sm">Connect {selectedCRM.charAt(0).toUpperCase() + selectedCRM.slice(1)}</h4>
                      <button onClick={() => setSelectedCRM("")} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancel</button>
                    </div>

                    {selectedCRM === 'gmail' ? (
                      <div className="space-y-4 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl mx-auto">📧</div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-gray-900">Connect your Gmail Account</h4>
                          <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-[240px] mx-auto">
                            We'll securely connect to your Gmail to sync your conversations and contacts automatically.
                          </p>
                        </div>
                        <Button onClick={() => connectIntegration('gmail')} disabled={isConnectingCRM} className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 h-12 rounded-xl font-bold flex items-center justify-center gap-3 shadow-sm">
                          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" />
                          {isConnectingCRM ? "Connecting..." : "Sign in with Google"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {selectedCRM === 'slack' ? 'Webhook URL' : 'API Key / Access Token'}
                          </label>
                          <Input
                            placeholder={selectedCRM === 'slack' ? "https://hooks.slack.com/services/..." : "Enter your key..."}
                            type={selectedCRM === 'slack' ? "text" : "password"}
                            value={crmValue}
                            onChange={(e) => setCrmValue(e.target.value)}
                            className="h-11 border-gray-200 bg-white font-bold text-sm"
                          />
                        </div>
                        <Button
                          onClick={() => connectIntegration(selectedCRM)}
                          disabled={isConnectingCRM || !crmValue}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl font-black shadow-lg shadow-indigo-100"
                        >
                          {isConnectingCRM ? <Loader2 className="h-4 w-4 animate-spin" /> : `Connect ${selectedCRM.charAt(0).toUpperCase() + selectedCRM.slice(1)}`}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Outreach Tools</label>
                <div className="flex flex-wrap gap-2">
                  {outreachTools.map((tool) => (
                    <ChipButton
                      key={tool}
                      label={tool}
                      selected={selectedOutreachTools.includes(tool)}
                      onClick={() => {
                        if (selectedOutreachTools.includes(tool)) {
                          setSelectedOutreachTools(selectedOutreachTools.filter(t => t !== tool))
                        } else {
                          setSelectedOutreachTools([...selectedOutreachTools, tool])
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <Button variant="outline" onClick={handleBack} className="h-11 px-8 font-bold border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl">← Back</Button>
                <SaveBtn onClick={handleNext} isSaving={isSaving} />
              </div>
            </div>
          </StepShell>
        )

      // ── Step 4: Teammates ──
      case 4:
        return (
          <StepShell title="Invite teammates" duration="1 min">
            <div className="space-y-6">
              <div className="bg-[#f0f1ff] border border-[#d6d8ff] rounded-2xl px-6 py-4 text-[13px] font-medium text-[#4a4d9c] leading-relaxed">
                Teammates can view prospects, manage sequences, and collaborate on outreach. Admins can also change settings.
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr,140px] gap-3">
                  <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Email</label>
                  <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Role</label>
                </div>
                {teammates.map((tm, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr,140px] gap-3">
                    <Input
                      placeholder="colleague@company.com"
                      value={tm.email}
                      onChange={(e) => {
                        const updated = [...teammates]
                        updated[idx].email = e.target.value
                        setTeammates(updated)
                      }}
                      className="h-11 border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-gray-900 bg-gray-50/30 rounded-xl"
                    />
                    <Select
                      value={tm.role}
                      onValueChange={(val) => {
                        const updated = [...teammates]
                        updated[idx].role = val
                        setTeammates(updated)
                      }}
                    >
                      <SelectTrigger className="h-11 border-gray-200 text-gray-900 bg-gray-50/30 rounded-xl font-bold text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <button
                  className="text-[13px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1.5 transition-all w-fit px-1 mt-1"
                  onClick={() => setTeammates([...teammates, { email: "", role: "Member" }])}
                >
                  <Plus className="h-4 w-4" /> Add another
                </button>
              </div>

              <div className="border-t border-gray-100 pt-6 space-y-3">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Or share an invite link</p>
                {inviteLink ? (
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 group">
                    <Link className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-[13px] font-medium text-gray-600 truncate flex-1">{inviteLink}</span>
                    <button
                      className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-all"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink)
                        toast.success("Link copied!")
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-2.5 px-5 py-2.5 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    onClick={() => {
                      const link = `https://app.outmate.io/invite/${Math.random().toString(36).slice(2)}`
                      setInviteLink(link)
                    }}
                  >
                    <Link className="h-4 w-4" /> Generate invite link
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <SaveBtn onClick={handleNext} isSaving={isSaving} label="Send invites & continue" />
                <Button variant="ghost" onClick={handleSkip} className="h-11 px-6 text-gray-400 font-bold text-[13px] hover:text-gray-600 rounded-xl">
                  Skip for now
                </Button>
              </div>
            </div>
          </StepShell>
        )

      // ── Step 5: Tell us about you ──
      case 5:
        const movieGenres = ["Horror", "Groundhog Day", "Action", "Coming-of-age"]
        const outboundReasons = [
          "We don't do outbound yet",
          "No one has time to do it properly",
          "Our data is terrible",
          "We tried but couldn't get replies",
          "Honestly it has — I just want more volume",
        ]
        const heardFrom = [
          "LinkedIn post",
          "Friend / colleague",
          "Cold email (meta, right?)",
          "Twitter / X",
          "Google search",
          "Newsletter",
          "Product Hunt",
          "YC community",
        ]

        return (
          <StepShell title="Tell us about you" duration="1 min">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-[15px] font-bold text-gray-900">🎬 If your outbound were a movie genre right now...</p>
                <div className="flex flex-wrap gap-2.5">
                  {movieGenres.map((g) => (
                    <ChipButton
                      key={g}
                      label={g}
                      selected={about.movie_genre === g}
                      onClick={() => setAbout({ ...about, movie_genre: g })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[15px] font-bold text-gray-900">🎯 The honest reason outbound hasn't worked yet...</p>
                <div className="flex flex-wrap gap-2.5">
                  {outboundReasons.map((r) => (
                    <ChipButton
                      key={r}
                      label={r}
                      selected={about.outbound_reason === r}
                      onClick={() => setAbout({ ...about, outbound_reason: r })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[15px] font-bold text-gray-900">🔔 How did you hear about Outmate?</p>
                <div className="flex flex-wrap gap-2.5">
                  {heardFrom.map((h) => (
                    <ChipButton
                      key={h}
                      label={h}
                      selected={about.heard_from === h}
                      onClick={() => setAbout({ ...about, heard_from: h })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <Button variant="outline" onClick={handleBack} className="h-11 px-8 font-bold border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl">
                  ← Back
                </Button>
                <SaveBtn onClick={handleNext} isSaving={isSaving} />
              </div>
            </div>
          </StepShell>
        )

      // ── Step 6: Save first prospects ──
      case 6:
        const signalOptions = [
          "Recently hired",
          "Raised funding",
          "Actively hiring engineers",
          "Changed tech stack",
          "Visiting my website",
          "No preference",
        ]

        return (
          <StepShell title="Save your first prospects" duration="2 min">
            <div className="space-y-6">
              <div className="bg-[#f0f1ff] border border-[#d6d8ff] rounded-2xl px-6 py-4 text-[13px] font-medium text-[#4a4d9c] leading-relaxed">
                Search Outmate's 265M+ contact database, filter by your ICP, and save at least 5 prospects to create your first sequence-ready list.
              </div>

              <div className="space-y-3">
                <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">What signals matter most?</label>
                <div className="flex flex-wrap gap-2.5">
                  {signalOptions.map((s) => (
                    <ChipButton
                      key={s}
                      label={s}
                      selected={signals.includes(s)}
                      onClick={() =>
                        setSignals((prev) =>
                          prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <Button variant="outline" onClick={handleBack} className="h-11 px-8 font-bold border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl">
                  ← Back
                </Button>
                <SaveBtn onClick={handleNext} isSaving={isSaving} />
              </div>
            </div>
          </StepShell>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex w-full h-full overflow-hidden font-sans bg-white">
      {/* ═════════ Sidebar ═════════ */}
      <div className="w-[260px] bg-[#1a1c4b] text-white flex flex-col shrink-0">
        {/* Logo + Title */}
        <div className="px-6 py-6 border-b border-indigo-900/40">
          <h1 className="text-xl font-bold text-white">Onboarding</h1>
          <p className="text-xs text-indigo-300 mt-1 font-medium opacity-80">
            Complete {Math.max(0, STEPS.length - currentStep)} more steps to get started
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 border-b border-indigo-900/40">
          <div className="flex justify-between text-[10px] text-indigo-400 mb-1.5 font-bold">
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-indigo-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="flex-1 py-4 px-4 space-y-1 overflow-y-auto no-scrollbar">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isActive = idx === currentStep

            return (
              <button
                key={step.id}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive
                  ? "bg-indigo-600/30 text-white font-semibold"
                  : isCompleted
                    ? "text-indigo-300 hover:bg-indigo-900/30 font-medium"
                    : "text-indigo-400/60 hover:text-indigo-300 font-medium"
                  }`}
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
              >
                <span className="shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 fill-indigo-400/20" />
                  ) : (
                    <Circle className={`h-4 w-4 ${isActive ? "text-white" : "text-indigo-700"}`} />
                  )}
                </span>
                <span className="text-sm">{step.label}</span>
              </button>
            )
          })}
        </div>

        {/* Brand footer */}
        <div className="px-6 py-4 border-t border-indigo-900/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              O
            </div>
            <span className="text-sm font-semibold text-white">Outmate</span>
          </div>
        </div>
      </div>

      {/* ═════════ MAIN CONTENT ═════════ */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#fafafa]">
        {/* Top header bar */}
        <div className="flex items-center justify-between px-10 py-5 bg-white border-b border-gray-100 shrink-0">
          <div className="text-center flex-1 ml-40">
            <p className="text-base font-bold text-gray-900">Get Outmate working in under 2 minutes</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Complete each task to unlock your first AI prospect list</p>
          </div>
          <div className="flex items-center gap-8 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏅</span>
              <div>
                <p className="text-base font-black text-gray-900 leading-none">{stats.credits}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Credits earned</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <div>
                <p className="text-base font-black text-gray-900 leading-none">{stats.available}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Available</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-base font-black text-gray-900 leading-none">{stats.done}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Tasks done</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 flex justify-center py-12 px-10">
          <div className="max-w-2xl w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 py-3 px-10 flex justify-center gap-3 bg-white">
          <FooterBtn
            onClick={() => setActiveModal("trouble")}
            icon="✅"
            label="Troubleshoot Installation"
          />
          <FooterBtn
            onClick={() => setActiveModal("dev")}
            icon="⭐"
            label="Invite a Software Developer"
          />
          <FooterBtn
            onClick={() => setActiveModal("chat")}
            icon="💬"
            label="Get Support via Chat"
          />
          <FooterBtn
            onClick={() => setActiveModal("call")}
            icon="📞"
            label="Book a Call"
          />
        </div>
      </div>

      {/* ═════════ Modals ═════════ */}
      <AnimatePresence>
        {activeModal !== "none" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
            onClick={() => setActiveModal("none")}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 rounded-t-2xl" />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 text-muted-foreground"
                onClick={() => setActiveModal("none")}
              >
                ✕
              </Button>

              {activeModal === "dev" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                    <MailIcon className="h-6 w-6 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Invite your Developer</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    We'll send them the installation snippet and technical documentation for the pixel.
                  </p>
                  <div className="space-y-4">
                    <Input
                      placeholder="developer@company.com"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      className="h-10"
                    />
                    <Button
                      className="w-full bg-[#4f46e5] h-10 font-bold"
                      disabled={isSubmittingSupport}
                      onClick={async () => {
                        setIsSubmittingSupport(true)
                        try {
                          await authService.inviteDeveloper(devEmail)
                          alert(`Installation kit sent to ${devEmail}!`)
                          setActiveModal("none")
                          setDevEmail("")
                        } catch {
                          alert("Failed to send invite. Please try again.")
                        } finally {
                          setIsSubmittingSupport(false)
                        }
                      }}
                    >
                      {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send Installation Kit
                    </Button>
                  </div>
                </>
              )}

              {activeModal === "chat" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                    <MessageCircle className="h-6 w-6 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Chat with GTM Support</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Our experts are online. How can we help you reach your first visitor?
                  </p>
                  <div className="space-y-4">
                    <textarea
                      className="w-full min-h-[120px] rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50"
                      placeholder="I'm having trouble with the tracking pixel..."
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                    />
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white h-10 font-bold"
                      disabled={isSubmittingSupport || !supportMessage}
                      onClick={async () => {
                        setIsSubmittingSupport(true)
                        try {
                          await authService.sendSupportMessage(supportMessage)
                          alert("Message received!")
                          setActiveModal("none")
                          setSupportMessage("")
                        } catch {
                          alert("Failed to send message.")
                        } finally {
                          setIsSubmittingSupport(false)
                        }
                      }}
                    >
                      {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send Message
                    </Button>
                  </div>
                </>
              )}

              {activeModal === "trouble" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                    <HelpCircle className="h-6 w-6 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Pixel Troubleshooting</h3>
                  <p className="text-sm text-muted-foreground mb-4">Not seeing your first visitor yet? Try these steps:</p>
                  <div className="space-y-3 mb-6">
                    {[
                      "Verify code is inside the <head> tag.",
                      "Ensure you've published your site changes.",
                      "Check browser console for 403 or 401 errors.",
                    ].map((tip) => (
                      <div key={tip} className="flex gap-2 text-xs text-gray-700 items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: tip }} />
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full h-10 text-xs font-bold" onClick={() => setActiveModal("chat")}>
                    Still not working? Talk to us
                  </Button>
                </>
              )}

              {activeModal === "call" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                    <Phone className="h-6 w-6 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Book a 1:1 GTM Session</h3>
                  <p className="text-sm text-muted-foreground mb-6">Get a personalized walkthrough for your outreach strategy.</p>
                  <div className="grid gap-3">
                    {["Tomorrow at 10:00 AM", "Monday at 2:00 PM"].map((slot) => (
                      <Button
                        key={slot}
                        variant="outline"
                        className="justify-between h-12 text-sm font-bold text-slate-800"
                        disabled={isSubmittingSupport}
                        onClick={async () => {
                          setIsSubmittingSupport(true)
                          try {
                            const result = await authService.bookSupportCall(slot)
                            if (result.meet_link) {
                              alert(`Session confirmed for ${slot}!\n\nGoogle Meet: ${result.meet_link}`)
                            } else {
                              alert(`Session confirmed for ${slot}! Check your email.`)
                            }
                            setActiveModal("none")
                          } catch {
                            alert("Failed to book session.")
                          } finally {
                            setIsSubmittingSupport(false)
                          }
                        }}
                      >
                        <span>{slot}</span>
                        {isSubmittingSupport ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-indigo-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function StepShell({
  title,
  duration,
  children,
}: {
  title: string
  duration?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl p-0">
      <div className="mb-8">
        <h2 className="text-[32px] font-black text-gray-900 tracking-tight">{title}</h2>
        {duration && <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">{duration}</p>}
        <div className="border-b border-gray-100 mt-6" />
      </div>
      {children}
    </div>
  )
}

function SaveBtn({
  onClick,
  isSaving,
  label = "Save & continue",
}: {
  onClick: () => void
  isSaving: boolean
  label?: string
}) {
  return (
    <Button
      className="bg-[#5c5fbc] hover:bg-[#4e51a9] text-white h-11 px-8 font-black uppercase tracking-widest text-[11px] rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
      onClick={onClick}
      disabled={isSaving}
    >
      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  )
}

function ChipButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full border text-sm transition-all ${selected
        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        }`}
    >
      {label}
    </button>
  )
}

function FooterBtn({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all text-[11px] font-medium text-gray-700"
    >
      <span className="text-sm">{icon}</span>
      {label}
    </button>
  )
}