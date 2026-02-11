"use client"

import { useEffect, useState } from "react"
import { SignalsList } from "@/components/signals/signals-list"
import { signalsApi, type Signal } from "@/lib/api/signals"

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const data = await signalsApi.getSignals()
        setSignals(data)
      } catch (error) {
        console.error("Failed to fetch signals:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSignals()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Signals</h1>
        <p className="text-muted-foreground">Track buying intent and company signals to identify opportunities</p>
      </div>

      <SignalsList signals={signals} isLoading={isLoading} />
    </div>
  )
}
