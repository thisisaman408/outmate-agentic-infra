"use client"

import { Radar, Clock } from "lucide-react"

export default function SignalsOverviewPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Radar className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-3">Intent Signals Overview</h2>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
      </div>
      <p className="max-w-md text-sm text-muted-foreground/70 leading-relaxed">
        We are building a powerful intent signals engine that will surface real-time buying signals, job changes, funding events, and tech stack shifts to help you reach prospects at the right moment. Stay tuned!
      </p>
    </div>
  )
}
