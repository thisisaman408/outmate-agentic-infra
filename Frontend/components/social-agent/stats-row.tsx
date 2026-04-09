"use client"

import { Activity, Mail, MessageSquare, Zap, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { SocialAgentRun } from "@/lib/social-agent"

interface Props {
  runs: SocialAgentRun[]
}

export function StatsRow({ runs }: Props) {
  const successful = runs.filter((r) => r.status === "success")
  const totalLeads = successful.reduce((acc, r) => acc + r.leads.length, 0)
  const totalEmails = successful.reduce(
    (acc, r) => acc + r.leads.filter((l) => l.email).length,
    0,
  )
  const totalMessages = successful.reduce(
    (acc, r) => acc + r.leads.filter((l) => l.message).length,
    0,
  )

  const stats: StatCardProps[] = [
    {
      title: "Total Runs",
      value: runs.length,
      icon: Zap,
      accent: "primary",
    },
    {
      title: "Leads Discovered",
      value: totalLeads,
      icon: Activity,
      accent: "info",
    },
    {
      title: "Emails Found",
      value: totalEmails,
      icon: Mail,
      accent: "success",
    },
    {
      title: "Messages Drafted",
      value: totalMessages,
      icon: MessageSquare,
      accent: "warning",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.title} {...s} />
      ))}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  accent: "primary" | "success" | "warning" | "info"
}

const ACCENT: Record<StatCardProps["accent"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
}

function StatCard({ title, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              "size-10 rounded-xl flex items-center justify-center shrink-0",
              ACCENT[accent],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
