"use client"

import { ListTree, Clock } from "lucide-react"

export default function SegmentsListsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <ListTree className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-3">Segments & Lists</h2>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
      </div>
      <p className="max-w-md text-sm text-muted-foreground/70 leading-relaxed">
        Organize your leads into smart segments and custom lists. Build dynamic audiences based on filters, intent signals, and enrichment data to power targeted outreach campaigns.
      </p>
    </div>
  )
}
