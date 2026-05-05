import { Navbar } from "@/components/website/navbar"
import { Hero } from "@/components/website/hero"
import { HowItWorks } from "@/components/website/how-it-works"
import { Features } from "@/components/website/features"
import { SignalEngine } from "@/components/website/signal-engine"
import { Enrichment } from "@/components/website/enrichment"
import { Copilot } from "@/components/website/copilot"
import { Workflow } from "@/components/website/workflow"
import { AIAgentsShowcase } from "@/components/website/ai-agents-showcase"
import { Stats } from "@/components/website/stats"
import { Integrations } from "@/components/website/integrations"
import { Comparison } from "@/components/website/comparison"
import { Testimonials } from "@/components/website/testimonials"
import { CTA } from "@/components/website/cta"
import { Footer } from "@/components/website/footer"

// Toggle the public website on/off without a redeploy by flipping
// NEXT_PUBLIC_SITE_OFFLINE in the production env. Defaults to "on" in
// production so the live domain shows the offline screen until traffic
// is re-enabled.
const isOffline =
  process.env.NEXT_PUBLIC_SITE_OFFLINE === "true" ||
  (process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SITE_OFFLINE !== "false")

function OfflineScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A1A",
        color: "#E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(239, 68, 68, 0.12)",
            color: "#FCA5A5",
            fontSize: 12,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#EF4444",
            }}
          />
          Site offline
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          Outmate.ai is temporarily offline
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#9CA3AF" }}>
          The site is currently unavailable. We&rsquo;re working on it and will
          be back shortly. Thanks for your patience.
        </p>
        <p
          style={{
            marginTop: 24,
            fontSize: 14,
            color: "#6B7280",
          }}
        >
          For urgent inquiries, please contact{" "}
          <a
            href="mailto:hello@outmate.ai"
            style={{ color: "#A78BFA", textDecoration: "none" }}
          >
            hello@outmate.ai
          </a>
          .
        </p>
      </div>
    </main>
  )
}

export default function HomePage() {
  if (isOffline) {
    return <OfflineScreen />
  }

  return (
    <div className="bg-[#0A0A1A] min-h-screen">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <SignalEngine />
      <Enrichment />
      <Copilot />
      <Workflow />
      <AIAgentsShowcase />
      <Stats />
      <Integrations />
      <Comparison />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  )
}
