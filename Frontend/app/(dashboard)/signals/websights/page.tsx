"use client"

import { useEffect, useState } from "react"
import { SignalsList } from "@/components/signals/signals-list"
import { signalsApi, type Signal } from "@/lib/api/signals"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { useAgentHighlight } from "@/hooks/use-agent-highlight"
import { cn } from "@/lib/utils"

export default function WebsightsPage() {
    const [signals, setSignals] = useState<Signal[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showCopilotResults, setShowCopilotResults] = useState(true)

    // Copilot automation agent results — last execute_search for 'websights'
    const copilotResult = useCoPilotAgentStore(s =>
        [...s.executionResults].reverse().find(r => r.module === 'websights' && r.status === 'success')
    )
    const copilotFilters = useCoPilotAgentStore(s => s.appliedFilters?.['websights'])
    const isHighlighted = useAgentHighlight('websights-filters-panel')

    const fetchSignals = async () => {
        try {
            setIsLoading(true)
            const data = await signalsApi.getSignals()
            const filtered = data.filter(s => s.category === 'websights')
            setSignals(filtered)
        } catch (error) {
            console.error("Failed to fetch signals:", error)
            toast.error("Failed to load signals. Is the backend running?")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSignals()
    }, [])

    const handleRunSignal = async (id: string) => {
        try {
            toast.info("Starting signal run...")
            await signalsApi.runSignal(id)
            toast.success("Signal run triggered")
            setTimeout(fetchSignals, 1000)
        } catch (error) {
            console.error("Failed to run signal:", error)
            toast.error("Failed to run signal")
        }
    }

    return (
        <div id="websights-filters-panel" className={cn('space-y-6 p-6 transition-all duration-300', isHighlighted && 'ring-2 ring-primary ring-offset-2 rounded-xl')}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Websights</h1>
                    <p className="text-muted-foreground">Identify companies visiting your website and brand mentions.</p>
                </div>
                <Link href="/signals/new/custom?category=websights">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" /> New Signal
                    </Button>
                </Link>
            </div>

            {/* Copilot automation agent results banner */}
            {copilotResult && (copilotResult.resultCount ?? 0) > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">
                                Automation Agent found {copilotResult.resultCount} visitor record{copilotResult.resultCount !== 1 ? 's' : ''}
                                {copilotFilters?.domain ? ` for "${copilotFilters.domain}"` : ''}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowCopilotResults(v => !v)}
                        >
                            {showCopilotResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                    {showCopilotResults && Array.isArray(copilotResult.results) && copilotResult.results.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {(copilotResult.results as any[]).slice(0, 10).map((item: any, i: number) => (
                                <div key={i} className="rounded-md bg-background border border-border/50 p-3 text-sm">
                                    <div className="font-medium">{item.company_name || item.domain || item.ip || `Visitor ${i + 1}`}</div>
                                    {item.country && <div className="text-muted-foreground text-xs mt-0.5">Country: {item.country}</div>}
                                    {item.visit_date && <div className="text-muted-foreground text-xs">Visited: {item.visit_date}</div>}
                                </div>
                            ))}
                            {copilotResult.results.length > 10 && (
                                <p className="text-xs text-muted-foreground pl-1">
                                    +{copilotResult.results.length - 10} more results — view all in the Automation Panel
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            <SignalsList
                signals={signals}
                isLoading={isLoading}
                onRunSignal={handleRunSignal}
            />
        </div>
    )
}
