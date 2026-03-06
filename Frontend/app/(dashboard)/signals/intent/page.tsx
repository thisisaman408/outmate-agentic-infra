"use client"

import { useEffect, useState } from "react"
import { SignalsList } from "@/components/signals/signals-list"
import { signalsApi, type Signal } from "@/lib/api/signals"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export default function IntentPage() {
    const [signals, setSignals] = useState<Signal[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchSignals = async () => {
        try {
            setIsLoading(true)
            const data = await signalsApi.getSignals()
            const filtered = data.filter(s => s.category === 'intent')
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
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Intent Signals</h1>
                    <p className="text-muted-foreground">Track high-intent purchase signals from across the web.</p>
                </div>
                <Link href="/signals/new/custom?category=intent">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" /> New Signal
                    </Button>
                </Link>
            </div>

            <SignalsList
                signals={signals}
                isLoading={isLoading}
                onRunSignal={handleRunSignal}
            />
        </div>
    )
}
