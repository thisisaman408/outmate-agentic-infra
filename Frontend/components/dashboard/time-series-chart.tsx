"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts"
import type { TimeSeriesData } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

// Concrete color values — recharts renders inside SVG and cannot resolve CSS oklch variables
const CHART_COLORS = {
  leads: "#818cf8",     // indigo-400
  signals: "#34d399",   // emerald-400
  campaigns: "#fb923c", // orange-400
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground ml-1">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

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
          <CardDescription>Leads, signals &amp; campaigns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
        <CardDescription>Leads, signals &amp; campaigns over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
            <Line type="monotone" dataKey="leads" stroke={CHART_COLORS.leads} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Leads" />
            <Line type="monotone" dataKey="signals" stroke={CHART_COLORS.signals} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Signals" />
            <Line type="monotone" dataKey="campaigns" stroke={CHART_COLORS.campaigns} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Campaigns" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
