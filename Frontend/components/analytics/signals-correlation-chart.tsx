"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { SignalsCorrelation } from "@/lib/api/analytics"
import { Skeleton } from "@/components/ui/skeleton"

interface SignalsCorrelationChartProps {
  data: SignalsCorrelation[]
  isLoading?: boolean
}

export function SignalsCorrelationChart({ data, isLoading }: SignalsCorrelationChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signals vs Conversion</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signals vs Conversion</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="signalType" className="text-xs" angle={-45} textAnchor="end" height={100} />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="conversions" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Conversions" />
            <Bar dataKey="conversionRate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Rate %" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
