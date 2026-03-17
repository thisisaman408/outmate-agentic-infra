import Link from "next/link"
import { SignupForm } from "@/components/auth/signup-form"
import { BarChart2, Users, Zap, Target, CheckCircle2 } from "lucide-react"

const benefits = [
  "100 free credits on sign-up",
  "No credit card required",
  "Real-time visitor identification",
  "AI-powered lead enrichment",
  "1-click outreach sequences",
]

export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left: Brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, oklch(0.45 0.2 264 / 0.35) 0%, transparent 60%), " +
              "radial-gradient(ellipse at 80% 20%, oklch(0.55 0.18 290 / 0.25) 0%, transparent 50%), " +
              "oklch(0.12 0.02 264)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Logo */}
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Outmate<span className="text-primary">.ai</span>
            </span>
          </Link>
        </div>

        {/* Main copy */}
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-success/15 border border-success/25 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success">Free forever — no credit card</span>
            </div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Start turning traffic
              <br />
              into customers today
            </h2>
            <p className="text-base text-white/60 leading-relaxed max-w-xs">
              Join hundreds of GTM teams who use Outmate.ai to identify, enrich, and convert B2B prospects.
            </p>
          </div>

          <ul className="space-y-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-sm text-white/70">{b}</span>
              </li>
            ))}
          </ul>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { value: "500+", label: "GTM teams" },
              { value: "12M+", label: "Leads enriched" },
              { value: "3.4x", label: "Avg. pipeline lift" },
            ].map(({ value, label }) => (
              <div key={label} className="space-y-0.5">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-sm text-white/70 leading-relaxed">
            &ldquo;We went from 0 to 150 qualified demos in 90 days. Outmate identified site visitors our CRM had never seen.&rdquo;
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
              SC
            </div>
            <div>
              <div className="text-xs font-medium text-white">Sarah Chen</div>
              <div className="text-[10px] text-white/40">VP Sales, NexusTech</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Form panel ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight">
              Outmate<span className="text-primary">.ai</span>
            </span>
          </Link>
        </div>

        <SignupForm />
      </div>
    </div>
  )
}
