import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { BarChart2, Users, Zap, Target } from "lucide-react"

const features = [
  { icon: Users, text: "Identify anonymous website visitors in real-time" },
  { icon: BarChart2, text: "AI-powered lead enrichment & intent signals" },
  { icon: Zap, text: "1-click personalised outreach sequences" },
  { icon: Target, text: "B2B pipeline from traffic — not cold lists" },
]

export default function LoginPage() {
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
        {/* Subtle grid overlay */}
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
            <h2 className="text-3xl font-bold leading-tight text-white">
              Turn anonymous visitors
              <br />
              into revenue-ready pipeline
            </h2>
            <p className="text-base text-white/60 leading-relaxed max-w-xs">
              Know who&apos;s on your site, enrich their profile with AI, and reach out — all in one platform.
            </p>
          </div>

          <ul className="space-y-3.5">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-white/80" />
                </div>
                <span className="text-sm text-white/70">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Social proof */}
        <div className="space-y-3">
          <div className="flex -space-x-2">
            {["JC", "MP", "SR", "AK"].map((initials) => (
              <div
                key={initials}
                className="w-8 h-8 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary"
              >
                {initials}
              </div>
            ))}
          </div>
          <p className="text-xs text-white/50">
            <span className="font-semibold text-white/80">500+ GTM teams</span> use Outmate.ai to build pipeline
          </p>
        </div>
      </div>

      {/* ── Right: Form panel ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12">
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

        <LoginForm />
      </div>
    </div>
  )
}
