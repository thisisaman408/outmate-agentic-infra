"use client"

import { useState, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Eye, Clock, AlertCircle } from "lucide-react"
import type { Signal, SignalResult } from "@/lib/api/signals"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { signalsApi } from "@/lib/api/signals"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDistanceToNow } from "date-fns"

interface SignalsListProps {
  signals: Signal[]
  isLoading?: boolean
  onRunSignal: (id: string) => void
}

export function SignalsList({ signals, isLoading, onRunSignal }: SignalsListProps) {
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null)
  const [results, setResults] = useState<SignalResult[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const handleViewResults = async (signalId: string) => {
    if (expandedSignal === signalId) {
      setExpandedSignal(null)
      return
    }

    setExpandedSignal(signalId)
    setLoadingResults(true)
    try {
      const data = await signalsApi.getSignalResults(signalId)
      setResults(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingResults(false)
    }
  }

  const getSignalTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      'x_mentions': 'X Mentions',
      'x_profiles': 'X Profiles',
      'x_hashtags': 'X Hashtags',
      'x_trends': 'X Trends'
    }
    return typeMap[type] || type
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signal Workflows</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signal Workflows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <AlertCircle className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No signals configured</p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Create your first signal to start tracking buying intent and company activity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Signal Workflows</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-b-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-xs font-medium text-muted-foreground pl-6">Name</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Target</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Last Run</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.map((signal) => (
                <Fragment key={signal._id}>
                  <TableRow className="hover:bg-muted/30 border-border/40 transition-colors">
                    <TableCell className="font-medium text-sm pl-6">{signal.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize h-5 px-1.5">
                        {getSignalTypeName(signal.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {signal.configuration?.target || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {signal.last_run_at
                        ? formatDistanceToNow(new Date(signal.last_run_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={signal.status === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          "text-[10px] h-5 px-1.5 capitalize",
                          signal.status === 'active' && "bg-success/10 text-success border-success/20 hover:bg-success/20"
                        )}
                      >
                        {signal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => onRunSignal(signal._id)}>
                          <Play className="h-3 w-3" /> Run
                        </Button>
                        <Button
                          size="sm"
                          variant={expandedSignal === signal._id ? "secondary" : "ghost"}
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleViewResults(signal._id)}
                        >
                          <Eye className="h-3 w-3" /> Results
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedSignal === signal._id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="bg-muted/20 border-t border-border/40 px-6 py-4">
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            Latest Results
                            {loadingResults && <Clock className="h-3 w-3 animate-spin text-muted-foreground" />}
                          </h4>
                          {!loadingResults && results.length === 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              No results yet. Run the signal to fetch data.
                            </p>
                          )}
                          {!loadingResults && results.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {results.map(r => (
                                <div key={r._id} className="rounded-lg border border-border/60 bg-card p-3 space-y-1">
                                  <a
                                    href={r.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-primary hover:underline block truncate"
                                  >
                                    {r.title}
                                  </a>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {formatDistanceToNow(new Date(r.found_at), { addSuffix: true })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
