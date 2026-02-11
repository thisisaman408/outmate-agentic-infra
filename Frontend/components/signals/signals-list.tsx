"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Briefcase, Code, Users, Rocket, Building2 } from "lucide-react"
import type { Signal } from "@/lib/api/signals"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface SignalsListProps {
  signals: Signal[]
  isLoading?: boolean
}

const signalIcons = {
  job_posting: Briefcase,
  funding: TrendingUp,
  tech_stack: Code,
  leadership_change: Users,
  product_launch: Rocket,
  expansion: Building2,
}

const signalColors = {
  job_posting: "text-blue-500",
  funding: "text-green-500",
  tech_stack: "text-purple-500",
  leadership_change: "text-orange-500",
  product_launch: "text-pink-500",
  expansion: "text-cyan-500",
}

export function SignalsList({ signals, isLoading }: SignalsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all")

  const filteredSignals = signals.filter((signal) => {
    const matchesSearch =
      signal.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.title.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === "all" || signal.type === typeFilter

    const matchesConfidence =
      confidenceFilter === "all" ||
      (confidenceFilter === "high" && signal.confidence >= 85) ||
      (confidenceFilter === "medium" && signal.confidence >= 70 && signal.confidence < 85) ||
      (confidenceFilter === "low" && signal.confidence < 70)

    return matchesSearch && matchesType && matchesConfidence
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Signals ({filteredSignals.length})</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="job_posting">Job Posting</SelectItem>
                <SelectItem value="funding">Funding</SelectItem>
                <SelectItem value="tech_stack">Tech Stack</SelectItem>
                <SelectItem value="leadership_change">Leadership</SelectItem>
                <SelectItem value="product_launch">Product Launch</SelectItem>
                <SelectItem value="expansion">Expansion</SelectItem>
              </SelectContent>
            </Select>
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High (85%+)</SelectItem>
                <SelectItem value="medium">Medium (70-84%)</SelectItem>
                <SelectItem value="low">Low (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">No signals found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSignals.map((signal) => {
              const Icon = signalIcons[signal.type]
              const iconColor = signalColors[signal.type]

              return (
                <div key={signal.id} className="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className={cn("mt-1", iconColor)}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{signal.companyName}</h3>
                          <Badge variant="outline" className="text-xs">
                            {signal.confidence}% confidence
                          </Badge>
                          <Badge
                            variant={signal.impact === "high" ? "default" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {signal.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{signal.title}</p>
                        <p className="text-sm text-muted-foreground">{signal.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="capitalize">{signal.type.replace("_", " ")}</span>
                          <span>•</span>
                          <span>Source: {signal.source}</span>
                          <span>•</span>
                          <span>{signal.timestamp}</span>
                        </div>
                        {signal.metadata && Object.keys(signal.metadata).length > 0 && (
                          <div className="flex gap-2">
                            {Object.entries(signal.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
