"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search as SearchIcon, Zap, Globe } from "lucide-react"
import { signalsApi, type Signal } from "@/lib/api/signals"

type SignalAction = {
  title: string
  summary: string
  badge: string
}

type JobSignal = {
  title: string
  description: string
}

type EnrichmentPillar = {
  title: string
  description: string
}

type SignalBuilder = {
  focus: string[]
  delivery: string[]
}

type SignalsOverview = {
  hero: {
    eyebrow: string
    title: string
    description: string
  }
  signalActions: SignalAction[]
  jobSignals: JobSignal[]
  enrichmentPillars: EnrichmentPillar[]
  signalBuilder: SignalBuilder
}

const initialOverview: SignalsOverview = {
  hero: {
    eyebrow: "Signals",
    title: "Signals you can define, tune, and act on in real time",
    description:
      "Build hiring, funding, tech, and growth signals across 4,000+ live sources—signal detection, decay logic, and enrichment keep the stories ready for you.",
  },
  signalActions: [],
  jobSignals: [],
  enrichmentPillars: [],
  signalBuilder: {
    focus: [],
    delivery: [],
  },
}

export default function SignalsPage() {
  const [overview, setOverview] = useState<SignalsOverview>(initialOverview)
  const [isLoading, setIsLoading] = useState(true)
  const [feed, setFeed] = useState<Signal[]>([])
  const [isFeedLoading, setIsFeedLoading] = useState(true)
  const [ctaMessage, setCtaMessage] = useState("Select any card to continue configuring that signal.")
  const feedRef = useRef<HTMLDivElement | null>(null)
  const handleCta = async (action: string) => {
    setCtaMessage(`Running ${action} now…`)
    try {
      const result = await signalsApi.runSignal(action)
      if (result.signals.length) {
        setFeed(result.signals)
        setCtaMessage(`Detected ${result.count} signals for "${action}".`)
      } else {
        setCtaMessage(`No signals found for "${action}" yet.`)
      }
    } catch (error) {
      console.error("Signal run failed:", error)
      setCtaMessage(`Signal run failed for "${action}".`)
    } finally {
      setIsFeedLoading(false)
      feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const [data, signalsFeed] = await Promise.all([
          signalsApi.getSignalsOverview(),
          signalsApi.getSignals(),
        ])
        setOverview(data)
        setFeed(signalsFeed)
      } catch (error) {
        console.error("Failed to load signals overview:", error)
      } finally {
        setIsLoading(false)
        setIsFeedLoading(false)
      }
    }
    loadOverview()
  }, [])

  const signalActions = useMemo(() => overview.signalActions, [overview])
  const jobSignals = useMemo(() => overview.jobSignals, [overview])
  const enrichmentPillars = useMemo(() => overview.enrichmentPillars, [overview])
  const builder = useMemo(() => overview.signalBuilder, [overview])

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.5em] text-primary">{overview.hero.eyebrow}</p>
        <h1 className="text-4xl font-bold leading-tight">{overview.hero.title}</h1>
        <p className="text-muted-foreground max-w-3xl">
          Build hiring, funding, tech, and growth signals across 4,000+ live sources—signal detection, decay logic, and enrichment keep the stories ready for you.
        </p>
        <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          {ctaMessage}
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {signalActions.map((signal) => (
          <Card key={signal.title} className="border border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{signal.title}</CardTitle>
                <span className="rounded-full border border-primary/50 px-3 py-0.5 text-xs font-semibold text-primary">
                  {signal.badge}
                </span>
              </div>
              <CardDescription className="text-sm text-muted-foreground">{signal.summary}</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-left text-xs text-primary"
                onClick={() => handleCta(signal.title)}
              >
                Create this signal
              </Button>
            </CardContent>
          </Card>
        ))}
        {!signalActions.length && !isLoading && (
          <Card className="border border-border/60">
            <CardContent>
              <p className="text-muted-foreground">No signal actions available yet.</p>
            </CardContent>
          </Card>
        )}
      </section>

  <section className="space-y-4">
    <div className="flex items-center gap-2 text-sm uppercase tracking-[0.4em] text-muted-foreground">
      <Zap className="h-4 w-4 text-secondary" />
      Job Signals
    </div>
    <div className="grid gap-4 md:grid-cols-3">
          {jobSignals.map((job) => (
            <Card key={job.title} className="border border-border/60">
              <CardHeader>
                <CardTitle>{job.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{job.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCta(job.title)}
                >
                  Set up feed
                </Button>
              </CardContent>
            </Card>
          ))}
          {!jobSignals.length && !isLoading && (
            <Card className="border border-border/60">
              <CardContent>
                <p className="text-muted-foreground">Job signal streams will appear here.</p>
              </CardContent>
            </Card>
          )}
    </div>
  </section>

      <section ref={feedRef} className="space-y-4">
        <div className="flex items-center gap-2 text-sm uppercase tracking-[0.4em] text-muted-foreground">
          <Globe className="h-4 w-4 text-secondary" />
          Live Signal Feed
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {feed.map((signal, index) => (
        <Card key={`${signal.id}-${index}`} className="border border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{signal.title}</CardTitle>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {signal.impact}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {signal.companyName} · {signal.source} · {signal.timestamp}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-sm">{signal.description}</CardContent>
        </Card>
      ))}
      {!feed.length && !isFeedLoading && (
        <Card className="border border-border/60">
          <CardContent>
            <p className="text-muted-foreground">Signal feed will appear as soon as data is available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  </section>

      <section className="grid gap-4 md:grid-cols-3">
        {enrichmentPillars.map((pillar) => (
          <Card key={pillar.title} className="border border-border/60 bg-background/70">
            <CardHeader>
              <CardTitle className="text-lg">{pillar.title}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">{pillar.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="ghost"
                className="px-0 text-xs text-primary"
                onClick={() => handleCta(pillar.title)}
              >
                Learn more
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section
        id="signalBuilder"
        className="rounded-2xl border border-border/40 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-primary">Signal Builder</p>
            <h2 className="text-3xl font-semibold">Pick your data, define the trigger, and let it run</h2>
            <p className="mt-2 text-base text-white/80">
              The intelligence engine orchestrates workflows, decay logic, and enrichment while you express the signal in human
              terms: industries, tech stacks, job families, and funding stages.
            </p>
          </div>
          <SearchIcon className="h-12 w-12 text-primary" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/20 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Signal focus</p>
            <div className="mt-2 space-y-1 text-sm">
              {builder.focus.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Delivery</p>
            <div className="mt-2 space-y-1 text-sm">
              {builder.delivery.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
          </div>
        </div>
          <div className="mt-4">
            <Button
              variant="outline"
              className="text-sm text-white"
              onClick={() => handleCta("Build a signal")}
            >
              Build a signal
            </Button>
          </div>
      </section>
    </div>
  )
}
