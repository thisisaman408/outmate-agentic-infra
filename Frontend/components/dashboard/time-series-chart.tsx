"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { TimeSeriesData } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface TimeSeriesChartProps {
  data: TimeSeriesData[]
  isLoading?: boolean
}

export function TimeSeriesChart({ data, isLoading }: TimeSeriesChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="leads" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Leads" />
            <Line type="monotone" dataKey="signals" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Signals" />
            <Line type="monotone" dataKey="campaigns" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Campaigns" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
