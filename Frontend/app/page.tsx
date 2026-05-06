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

export default function HomePage() {
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
