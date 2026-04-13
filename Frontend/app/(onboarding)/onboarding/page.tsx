"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
  MessageSquare,
  Phone,
  UserPlus,
  Sparkles,
  Building2,
  Target,
  MapPin,
  Briefcase,
  TrendingUp,
  ClipboardCheck,
  Rocket,
  Loader2,
  Users,
  SkipForward,
  Code,
  Link,
  Zap,
  HelpCircle,
  Mail as MailIcon,
  MessageCircle,
  Calendar,
  Trophy,
  ArrowRight,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth"
import { copilotApi } from "@/lib/api/copilot"
import { ICPStep } from "@/components/onboarding/icp-step"
import { IntegrationsStep } from "@/components/onboarding/integrations-step"
import { VisitorSuccessCard } from "@/components/onboarding/visitor-success-card"
import { ScorePreview } from "@/components/onboarding/score-preview"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

// ── Static data imports ──────────────────────────────────────────────
import industriesData from "@/input_data/linkdin_industry.json"
import titlesData from "@/input_data/title.json"
import countriesData from "@/input_data/HQ_Country.json"

const INDUSTRIES: string[] = industriesData as string[]
const JOB_TITLES: string[] = Object.keys(titlesData)
const COUNTRIES: string[] = (countriesData as { name: string }[]).map((c) => c.name)

const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10000+",
]

const FUNDING_STAGES = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Series D+",
  "IPO/Public",
  "Bootstrapped",
  "Any",
]

// ── Steps ────────────────────────────────────────────────────────────
const STEPS = [
  { id: "setup", label: "Set up your workspace", icon: Building2 },
  { id: "tracking", label: "Tracking Pixel", icon: Code },
  { id: "integrations", label: "Connect Integrations", icon: Zap },
  { id: "industries", label: "Target industries", icon: Target },
  { id: "sizes", label: "Company sizes", icon: Users },
  { id: "geographies", label: "Geographies", icon: MapPin },
  { id: "titles", label: "Job titles", icon: Briefcase },
  { id: "funding", label: "Funding stage", icon: TrendingUp },
  { id: "review", label: "Review your ICP", icon: ClipboardCheck },
  { id: "complete", label: "You're all set!", icon: Rocket },
]

// ── ICP State ────────────────────────────────────────────────────────
interface ICPState {
  industries: string[]
  company_sizes: string[]
  geographies: string[]
  job_titles: string[]
  funding_stages: string[]
}

const EMPTY_ICP: ICPState = {
  industries: [],
  company_sizes: [],
  geographies: [],
  job_titles: [],
  funding_stages: [],
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    website: "",
    companyName: user?.workspace || "",
    workspaceTitle: "",
    userName: user?.name || "",
    role: "",
    workEmail: user?.email || "",
  })
  const [icp, setIcp] = useState<ICPState>({ ...EMPTY_ICP })
  const [isSaving, setIsSaving] = useState(false)
  const [visitorState, setVisitorState] = useState<'monitoring' | 'found' | 'demo'>('monitoring')
  const [firstVisitor, setFirstVisitor] = useState<any>(null)
  const [stats, setStats] = useState({ credits: 0, available: 500 })
  const [activeModal, setActiveModal] = useState<'none' | 'dev' | 'trouble' | 'chat' | 'call'>('none')
  const [devEmail, setDevEmail] = useState("")
  const [supportMessage, setSupportMessage] = useState("")
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false)

  const progress = (currentStep / STEPS.length) * 100

  // Redirect on completion step & handle return from OAuth
  useEffect(() => {
    // Check if returning from OAuth
    const returnStep = localStorage.getItem("onboarding_return_step")
    if (returnStep) {
        localStorage.removeItem("onboarding_return_step")
        const stepIdx = STEPS.findIndex(s => s.id === returnStep)
        if (stepIdx !== -1) setCurrentStep(stepIdx)
    }

    if (currentStep === STEPS.length - 1) {
      const timer = setTimeout(() => router.push("/dashboard"), 2500)
      return () => clearTimeout(timer)
    }

    // Polling for first visitor in Step 1
    let interval: any
    if (currentStep === 1 && visitorState === 'monitoring') {
        const checkVisitor = async () => {
            try {
                const resp = await fetch("/api/v1/visitors/first-success", {
                    headers: authService.getAuthHeaders()
                })
                const data = await resp.json()
                if (data.status === 'success') {
                    if (visitorState === 'monitoring') {
                        setStats(prev => ({ ...prev, credits: prev.credits + 100, available: prev.available + 100 }))
                    }
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
        
        // Check immediately
        checkVisitor()
        // Poll every 5s
        interval = setInterval(checkVisitor, 5000)
    }

    return () => {
        if (interval) clearInterval(interval)
    }
  }, [currentStep, visitorState, router])

  const handleNext = async () => {
    setIsSaving(true)
    try {
      if (currentStep === 0) {
        await authService.updateOnboarding({
          step: 2,
          website_url: formData.website,
          user_role: formData.role,
          onboarding_data: JSON.stringify({
            company_name: formData.companyName,
            workspace_title: formData.workspaceTitle,
            user_name: formData.userName,
          }),
        })
      }

      // Tracking step (new)
      if (currentStep === 1) {
          // Typically we just verify if the script was detected, but for onboarding we allow next
          await authService.updateOnboarding({ step: 3 })
      }

      // Integrations step (new)
      if (currentStep === 2) {
          await authService.updateOnboarding({ step: 4 })
      }

      // On review step → save ICP and complete
      if (currentStep === STEPS.length - 2) {
        await authService.updateOnboarding({
          completed: true,
          icp_config: {
            industries: icp.industries,
            company_sizes: icp.company_sizes,
            geographies: icp.geographies,
            job_titles: icp.job_titles,
            funding_stages: icp.funding_stages,
          },
        })
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

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1)
  }

  const handleSkip = () => {
    // Skip just advances without selecting anything
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  // ── Render step content ──────────────────────────────────────────
  const renderStepContent = () => {
    switch (currentStep) {
      // ── Step 0: Workspace setup ──
      case 0:
        return (
          <div className="bg-white rounded-xl border p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-6">
              <h3 className="text-2xl font-extrabold text-[#111827]">Set up your workspace</h3>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded uppercase font-bold border border-indigo-100">
                1 min
              </span>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Website URL</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://acme.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                  <Button className="bg-[#a5b4fc] hover:bg-[#818cf8] text-[#1e1b4b] font-semibold h-12 px-6 shrink-0">
                    Scan website
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Company name</label>
                  <Input
                    placeholder="Acme Inc."
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Workspace title</label>
                  <Input
                    placeholder="My Workspace"
                    value={formData.workspaceTitle}
                    onChange={(e) => setFormData({ ...formData, workspaceTitle: e.target.value })}
                    className="h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Your name</label>
                  <Input
                    placeholder="Jane Doe"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    className="h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Role</label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                  >
                    <SelectTrigger className="h-12 text-base font-bold text-slate-900 border-slate-200">
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
              <div className="space-y-2 pb-2">
                <label className="text-sm font-bold text-slate-800">Work email</label>
                <Input
                  placeholder="jane@company.com"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  className="h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>
              <Button
                className="w-fit bg-[#4f46e5] hover:bg-[#4338ca] text-white px-8 h-10 font-bold"
                onClick={handleNext}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & continue
              </Button>
            </div>
          </div>
        )
      
      // ── Step 1: Tracking Pixel ──
      case 1:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 max-w-2xl mx-auto w-full space-y-6">
            {/* Always show the script box */}
            <div className="bg-white rounded-xl border p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold text-[#111827]">Install the Tracking Pixel</h3>
                  <p className="text-sm font-semibold text-slate-600">Put this code in your &lt;head&gt; tag.</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Time to first lead</span>
                  <span className="text-2xl font-black text-indigo-600 tracking-tighter">&lt;5m</span>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-indigo-300 mb-6 relative group">
                  <code className="block whitespace-pre-wrap leading-relaxed">
                      {`<!-- Outmate.ai Tracking -->\n<script src="${window.location.host === 'localhost:3000' ? "" : window.location.origin}/api/v1/visitors/pixel.js"\n  data-pixel-key="${user?.id || 'YOUR_KEY'}"\n  async></script>`}
                  </code>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="absolute top-2 right-2 text-indigo-400 hover:text-white hover:bg-white/10" 
                    onClick={() => navigator.clipboard.writeText(`<script src="${window.location.host === 'localhost:3000' ? "" : window.location.origin}/api/v1/visitors/pixel.js" data-pixel-key="${user?.id || 'YOUR_KEY'}" async></script>`)}
                  >
                      Copy Snippet
                  </Button>
              </div>

              {visitorState === 'monitoring' && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-100 rounded-xl bg-indigo-50/20">
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="mb-4"
                    >
                        <Loader2 className="h-8 w-8 text-indigo-500" />
                    </motion.div>
                    <h4 className="font-bold text-[#111827] mb-1">Waiting for first visitor...</h4>
                    <p className="text-[11px] text-slate-700 font-medium text-center">Once your pixel is live, we'll reveal the first corporate visitor here in real-time.</p>
                    <Button variant="link" className="text-indigo-700 font-black mt-4" onClick={() => handleNext()}>
                        I'll install it later →
                    </Button>
                </div>
              )}
            </div>

            {/* Success state - shown below script box once visitor is caught */}
            {visitorState !== 'monitoring' && (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-4">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-100"
                        >
                            <Trophy className="h-6 w-6 text-white" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-[#1e1b4b]">Success! We caught someone.</h3>
                        <p className="text-sm text-muted-foreground">Your pixel is working perfectly. Here is your first identified visitor.</p>
                    </div>
                    
                    <VisitorSuccessCard
                        visitor={firstVisitor}
                        isDemo={visitorState === 'demo'}
                        onOutreach={async () => {
                            await copilotApi.executeLeadAction({
                                action_type: "draft_email",
                                prospect_id: firstVisitor.id,
                                context: `First visitor from onboarding. Company: ${firstVisitor.company}, Domain: ${firstVisitor.domain}`,
                            })
                        }}
                        onViewProfile={() => {
                            window.open(`/visitors/${firstVisitor.id}`, '_blank')
                        }}
                    />

                    <div className="flex justify-center pt-4">
                        <Button 
                            className="bg-[#4f46e5] text-white px-12 h-12 rounded-full font-bold shadow-xl shadow-indigo-100"
                            onClick={handleNext}
                        >
                            Everything looks good, continue →
                        </Button>
                    </div>
                </div>
            )}
          </div>
        )
      
      // ── Step 2: Integrations ──
      case 2:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <IntegrationsStep onStatusChange={() => {}} />
            <div className="flex justify-between mt-6 max-w-2xl mx-auto">
                <Button variant="outline" onClick={handleBack}>Back</Button>
                <Button className="bg-[#4f46e5]" onClick={handleNext} disabled={isSaving}>Next</Button>
            </div>
          </div>
        )

      // ── Step 3: Industries ──
      case 3:
        return (
          <>
            <ICPStep
              title="What industries do your ideal customers operate in?"
              description="Select the industries that best describe your target market."
              options={INDUSTRIES}
              selected={icp.industries}
              onSelect={(v) => setIcp({ ...icp, industries: v })}
              suggestions={[
                "Software Development",
                "SaaS",
                "Technology, Information and Internet",
                "Financial Services",
                "Business Consulting and Services",
              ]}
              searchPlaceholder="Search industries..."
            />
            <ScorePreview selections={icp} />
            <StepNav
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isSaving={isSaving}
            />
          </>
        )

      // ── Step 4: Company sizes ──
      case 4:
        return (
          <>
            <ICPStep
              title="What companies sizes are you targeting?"
              description="Select the employee count ranges that fit your ideal customer."
              options={COMPANY_SIZES}
              selected={icp.company_sizes}
              onSelect={(v) => setIcp({ ...icp, company_sizes: v })}
              suggestions={["11-50", "51-200", "201-500"]}
              searchPlaceholder="Search company sizes..."
            />
            <ScorePreview selections={icp} />
            <StepNav
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isSaving={isSaving}
            />
          </>
        )

      // ── Step 5: Geographies ──
      case 5:
        return (
          <>
            <ICPStep
              title="Where are your target customers located?"
              description="Select the countries or regions you want to focus on."
              options={COUNTRIES}
              selected={icp.geographies}
              onSelect={(v) => setIcp({ ...icp, geographies: v })}
              suggestions={["United States", "United Kingdom", "Canada", "Germany", "Australia"]}
              searchPlaceholder="Search countries..."
            />
            <ScorePreview selections={icp} />
            <StepNav
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isSaving={isSaving}
            />
          </>
        )

      // ── Step 6: Job titles ──
      case 6:
        return (
          <>
            <ICPStep
              title="What roles do you sell to?"
              description="Select the job titles of people you typically engage with."
              options={JOB_TITLES}
              selected={icp.job_titles}
              onSelect={(v) => setIcp({ ...icp, job_titles: v })}
              suggestions={["CEO", "CTO", "VP Sales", "VP Marketing", "Head of Engineering"]}
              searchPlaceholder="Search job titles..."
            />
            <ScorePreview selections={icp} />
            <StepNav
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isSaving={isSaving}
            />
          </>
        )

      // ── Step 7: Funding stages ──
      case 7:
        return (
          <>
            <ICPStep
              title="What funding stage are your ideal customers?"
              description="Select the funding stages that best match your target companies."
              options={FUNDING_STAGES}
              selected={icp.funding_stages}
              onSelect={(v) => setIcp({ ...icp, funding_stages: v })}
              suggestions={["Series A", "Series B", "Series C"]}
              searchPlaceholder="Search funding stages..."
            />
            <ScorePreview selections={icp} />
            <StepNav
              onBack={handleBack}
              onNext={handleNext}
              onSkip={handleSkip}
              isSaving={isSaving}
            />
          </>
        )

      // ── Step 8: Review ──
      case 8:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white rounded-xl border p-8 shadow-sm">
              <h3 className="text-xl font-bold text-[#1e1b4b] mb-1">Review your ICP</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Confirm your Ideal Customer Profile. You can edit this later in Settings.
              </p>

              <div className="space-y-4">
                <ReviewSection label="Industries" items={icp.industries} onEdit={() => setCurrentStep(3)} />
                <ReviewSection label="Company sizes" items={icp.company_sizes} onEdit={() => setCurrentStep(4)} />
                <ReviewSection label="Geographies" items={icp.geographies} onEdit={() => setCurrentStep(5)} />
                <ReviewSection label="Job titles" items={icp.job_titles} onEdit={() => setCurrentStep(6)} />
                <ReviewSection label="Funding stages" items={icp.funding_stages} onEdit={() => setCurrentStep(7)} />
              </div>
            </div>
            <ScorePreview selections={icp} />
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button className="bg-[#4f46e5] text-white px-8 font-bold" onClick={handleNext} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Looks good — finish setup
              </Button>
            </div>
          </div>
        )

      // ── Step 9: Complete ──
      case 9:
        return (
          <div className="bg-white rounded-xl border p-12 shadow-sm text-center animate-in fade-in slide-in-from-bottom-2">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-[#1e1b4b] mb-2">Your ICP is configured!</h3>
            <p className="text-muted-foreground mb-2">
              Outmate will now score every lead against your Ideal Customer Profile.
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            <div className="mt-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mx-auto" />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex w-full h-full overflow-hidden font-sans">
      {/* ═════════ Sidebar ═════════ */}
      <div className="w-[300px] bg-[#1a1c4b] text-white flex flex-col p-6 shrink-0 relative">
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-1">Onboarding</h1>
          <p className="text-sm text-indigo-100 font-medium">
            Complete {Math.max(0, STEPS.length - 1 - currentStep)} more steps to get started
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-[10px] mb-2 text-indigo-300">
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 bg-indigo-900" />
        </div>

        <div className="space-y-4 flex-1">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isCompleted = idx < currentStep
            const isActive = idx === currentStep

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? "bg-indigo-500/20 text-white"
                    : "text-indigo-300/60 hover:text-indigo-100"
                }`}
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
              >
                <div
                  className={`shrink-0 ${
                    isActive
                      ? "text-white"
                      : isCompleted
                        ? "text-indigo-400"
                        : "text-indigo-700"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 fill-indigo-500 text-[#1a1c4b]" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${isActive ? "text-white" : "text-inherit"}`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-indigo-900/40">
          <div className="flex items-center gap-2">
            <img src="/image.png" alt="Outmate" className="h-7 rounded" />
          </div>
        </div>
      </div>

      {/* ═════════ MAIN CONTENT ═════════ */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50/30">
        {/* Header Stats */}
        <div className="flex justify-end items-center gap-4 p-4 px-12">
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center shadow-md shadow-orange-200">
                <Trophy className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-orange-700 leading-none">{stats.credits}</span>
              <span className="text-[10px] text-orange-600 uppercase font-bold tracking-tight">Credits earned</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-indigo-600 fill-indigo-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-indigo-700 leading-none">{stats.available}</span>
              <span className="text-[10px] text-indigo-600 uppercase font-bold tracking-tight">Available</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-green-700 leading-none">
                {currentStep}/{STEPS.length}
              </span>
              <span className="text-[10px] text-green-600 uppercase font-bold tracking-tight">Tasks done</span>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="max-w-3xl mx-auto w-full px-6 py-12 flex flex-col">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-[#111827] tracking-tight">
              Get Outmate working in under 2 minutes
            </h2>
            <p className="text-slate-600 text-base mt-2 font-medium">
              Complete each task to unlock your first AI prospect list
            </p>
          </div>

          {renderStepContent()}
        </div>

        {/* Footer actions */}
        <div className="mt-auto p-6 flex justify-center gap-3 bg-white/50 border-t">
          <FooterBtn
            onClick={() => setActiveModal('trouble')}
            icon={<CheckCircle2 className="h-3.5 w-3.5" color="#10b981" />}
            label="Troubleshoot Installation"
          />
          <FooterBtn
            onClick={() => setActiveModal('dev')}
            icon={<UserPlus className="h-3.5 w-3.5" color="#f59e0b" />}
            label="Invite a Software Developer"
          />
          <FooterBtn
            onClick={() => setActiveModal('chat')}
            icon={<MessageSquare className="h-3.5 w-3.5" color="#8b5cf6" />}
            label="Get Support via Chat"
          />
          <FooterBtn
            onClick={() => setActiveModal('call')}
            icon={<Phone className="h-3.5 w-3.5" color="#ec4899" />}
            label="Book a Call"
          />
        </div>
      </div>

      {/* ═════════ Modals ═════════ */}
      <AnimatePresence>
        {activeModal !== 'none' && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
                onClick={() => setActiveModal('none')}
            >
                <motion.div 
                    initial={{ scale: 0.95, y: 20 }} 
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-4 right-4 text-muted-foreground" 
                        onClick={() => setActiveModal('none')}
                    >
                        ✕
                    </Button>
                    
                    {activeModal === 'dev' && (
                        <>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                                <MailIcon className="h-6 w-6 text-indigo-500" />
                            </div>
                            <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Invite your Developer</h3>
                            <p className="text-sm text-muted-foreground mb-6">We'll send them the installation snippet and technical documentation for the pixel.</p>
                            
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Dev Email Address</label>
                                    <Input 
                                        placeholder="developer@company.com" 
                                        value={devEmail}
                                        onChange={(e) => setDevEmail(e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <Button 
                                    className="w-full bg-[#4f46e5] h-10 font-bold" 
                                    disabled={isSubmittingSupport}
                                    onClick={async () => {
                                        setIsSubmittingSupport(true);
                                        try {
                                            await authService.inviteDeveloper(devEmail);
                                            alert(`Installation kit sent to ${devEmail}!`);
                                            setActiveModal('none');
                                            setDevEmail("");
                                        } catch (e) {
                                            alert("Failed to send invite. Please try again.");
                                        } finally {
                                            setIsSubmittingSupport(false);
                                        }
                                    }}
                                >
                                    {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Send Installation Kit
                                </Button>
                            </div>
                        </>
                    )}

                    {activeModal === 'chat' && (
                        <>
                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                                <MessageCircle className="h-6 w-6 text-purple-500" />
                            </div>
                            <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Chat with GTM Support</h3>
                            <p className="text-sm text-muted-foreground mb-6">Our experts are online. How can we help you reach your first visitor?</p>
                            
                            <div className="space-y-4">
                                <textarea 
                                    className="w-full min-h-[140px] rounded-xl border border-slate-200 p-4 text-base font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50 placeholder:text-slate-400 placeholder:font-normal"
                                    placeholder="I'm having trouble with the tracking pixel..."
                                    value={supportMessage}
                                    onChange={(e) => setSupportMessage(e.target.value)}
                                />
                                <Button 
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 font-bold shadow-lg shadow-purple-100" 
                                    disabled={isSubmittingSupport || !supportMessage}
                                    onClick={async () => {
                                        setIsSubmittingSupport(true);
                                        try {
                                            await authService.sendSupportMessage(supportMessage);
                                            alert("Message received! Our team will get back to you shortly.");
                                            setActiveModal('none');
                                            setSupportMessage("");
                                        } catch (e) {
                                            alert("Failed to send message.");
                                        } finally {
                                            setIsSubmittingSupport(false);
                                        }
                                    }}
                                >
                                    {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Send Message
                                </Button>
                            </div>
                        </>
                    )}

                    {activeModal === 'trouble' && (
                        <>
                            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                <HelpCircle className="h-6 w-6 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Pixel Troubleshooting</h3>
                            <p className="text-sm text-muted-foreground mb-4">Not seeing your first visitor yet? Try these steps:</p>
                            
                            <div className="space-y-3 mb-6">
                                <div className="flex gap-2 text-xs text-gray-700 items-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    <span>Verify code is inside the <b>&lt;head&gt;</b> tag.</span>
                                </div>
                                <div className="flex gap-2 text-xs text-gray-700 items-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    <span>Ensure you've published your site changes.</span>
                                </div>
                                <div className="flex gap-2 text-xs text-gray-700 items-center">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    <span>Check browser console for 403 or 401 errors.</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full h-10 text-[11px] font-bold" onClick={() => setActiveModal('chat')}>
                                Still not working? Talk to us
                            </Button>
                        </>
                    )}

                    {activeModal === 'call' && (
                        <>
                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                                <Phone className="h-6 w-6 text-green-500" />
                            </div>
                            <h3 className="text-xl font-bold text-[#1e1b4b] mb-2">Book a 1:1 GTM Session</h3>
                            <p className="text-sm text-muted-foreground mb-6">Get a personalized walkthrough for your outreach strategy.</p>
                            
                            <div className="grid grid-cols-1 gap-3">
                                {["Tomorrow at 10:00 AM", "Monday at 2:00 PM"].map(slot => (
                                    <Button 
                                        key={slot}
                                        variant="outline" 
                                        className="justify-between h-12 text-sm font-bold text-slate-800" 
                                        disabled={isSubmittingSupport}
                                        onClick={async () => {
                                            setIsSubmittingSupport(true);
                                            try {
                                                const result = await authService.bookSupportCall(slot);
                                                if (result.meet_link) {
                                                    alert(`Session confirmed for ${slot}!\n\nGoogle Meet link: ${result.meet_link}\n\nA calendar invite has been added to your Google Calendar.`);
                                                } else {
                                                    alert(`Session confirmed for ${slot}! Check your email for the meeting link.`);
                                                }
                                                setActiveModal('none');
                                            } catch (e) {
                                                alert("Failed to book session.");
                                            } finally {
                                                setIsSubmittingSupport(false);
                                            }
                                        }}
                                    >
                                        <span>{slot}</span>
                                        {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-indigo-500" />}
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

// ── Sub-components ─────────────────────────────────────────────────

function StepNav({
  onBack,
  onNext,
  onSkip,
  isSaving,
}: {
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  isSaving: boolean
}) {
  return (
    <div className="flex justify-between mt-6">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
        <Button
          className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-8 font-bold"
          onClick={onNext}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Next
        </Button>
      </div>
    </div>
  )
}

function ReviewSection({
  label,
  items,
  onEdit,
}: {
  label: string
  items: string[]
  onEdit: () => void
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-extrabold text-[#111827]">{label}</span>
          <span className="text-xs font-bold text-slate-500 leading-none">({items.length})</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Not specified (targeted all)</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs font-bold text-slate-900 bg-slate-100 border-slate-200">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit} className="text-indigo-600 shrink-0">
        Edit
      </Button>
    </div>
  )
}

function FooterBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all shadow-sm active:scale-95"
    >
      {icon}
      <span className="text-[11px] font-bold text-gray-700">{label}</span>
    </button>
  )
}
