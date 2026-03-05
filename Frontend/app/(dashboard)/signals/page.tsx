"use client"

import { useEffect, useState } from "react"
import { SignalsList } from "@/components/signals/signals-list"
import Link from "next/link"
import { signalsApi, type Signal } from "@/lib/api/signals"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchSignals = async () => {
    try {
      setIsLoading(true)
      const data = await signalsApi.getSignals()
      setSignals(data)
    } catch (error) {
      console.error("Failed to fetch signals:", error)
      toast.error("Failed to load signals")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSignals()
  }, [])

  const handleRunSignal = async (id: string) => {
    try {
      toast.info("Running signal...")
      await signalsApi.runSignal(id)
      toast.success("Signal executed successfully")
      await fetchSignals()
    } catch (error) {
      console.error("Failed to run signal:", error)
      toast.error("Failed to run signal")
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signals</h1>
          <p className="text-muted-foreground">
            Define and run new signals when you are ready. Click the button below to start building your first
            workflow.
          </p>
        </div>
        <Link href="/signals/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Signal
          </Button>
        </Link>
      </div>

      <SignalsList signals={signals} isLoading={isLoading} onRunSignal={handleRunSignal} />
    </div>
  )
}
