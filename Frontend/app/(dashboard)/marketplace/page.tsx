"use client"

import { Target } from "lucide-react"

export default function MarketplacePage() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Header */}
      <div className="px-8 py-6 bg-card border-b border-border">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Marketplace</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Agent marketplace</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/5">
        <div className="h-full flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Target className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground mb-2">Coming Soon</h2>
              <p className="text-sm text-muted-foreground">
                The Agent Marketplace is currently under development. We're building a curated collection of pre-configured autonomous agents for every stage of your GTM funnel.
              </p>
            </div>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground/60">
                Stay tuned for updates on this exciting feature.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
