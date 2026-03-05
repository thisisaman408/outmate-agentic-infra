"use client"

import { useEffect, useState } from "react"
import { SignalsList } from "@/components/signals/signals-list"
import { CreateSignalDialog } from "@/components/signals/create-signal-dialog"
import { signalsApi, type Signal } from "@/lib/api/signals"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export default function FormcompletePage() {
    const [signals, setSignals] = useState<Signal[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const fetchSignals = async () => {
        try {
            setIsLoading(true)
            const data = await signalsApi.getSignals()
            // Filter for Formcomplete signals (Custom for now)
            const filtered = data.filter(s => s.type === 'custom')
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

    const handleCreateSignal = async (data: { name: string; type: string; target: string }) => {
        try {
            await signalsApi.createSignal({
                name: data.name,
                type: data.type as any,
                configuration: { target: data.target },
                status: 'active'
            })
            toast.success("Signal created successfully")
            fetchSignals()
        } catch (error) {
            console.error("Failed to create signal:", error)
            toast.error("Failed to create signal")
        }
    }

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
                    <h1 className="text-3xl font-bold tracking-tight">Form Complete</h1>
                    <p className="text-muted-foreground">Enrich partial form submissions automatically.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> New Signal
                </Button>
            </div>

            <SignalsList
                signals={signals}
                isLoading={isLoading}
                onRunSignal={handleRunSignal}
            />

            <CreateSignalDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={handleCreateSignal}
            />
        </div>
    )
}