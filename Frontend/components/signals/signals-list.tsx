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
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Signal Workflows</CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No signals configured. Create one to start tracking.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <Fragment key={signal._id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{signal.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getSignalTypeName(signal.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{signal.configuration?.target || '-'}</TableCell>
                      <TableCell>
                        {signal.last_run_at
                          ? formatDistanceToNow(new Date(signal.last_run_at), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={signal.status === 'active' ? 'default' : 'secondary'}>
                          {signal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => onRunSignal(signal._id)}>
                            <Play className="h-4 w-4 mr-1" /> Run
                          </Button>
                          <Button
                            size="sm"
                            variant={expandedSignal === signal._id ? "secondary" : "ghost"}
                            onClick={() => handleViewResults(signal._id)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> Results
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedSignal === signal._id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              Latest Results
                              {loadingResults && <Clock className="h-3 w-3 animate-spin" />}
                            </h4>
                            {!loadingResults && results.length === 0 && (
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> No results found yet. Try running the signal.
                              </div>
                            )}
                            {!loadingResults && results.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {results.map(r => (
                                  <div key={r._id} className="border rounded-lg p-3 bg-card text-card-foreground text-sm shadow-sm">
                                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline text-primary block truncate">
                                      {r.title}
                                    </a>
                                    <p className="text-muted-foreground line-clamp-2 mt-1 xs">{r.description}</p>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(r.found_at), { addSuffix: true })}
                                    </div>
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
        )}
      </CardContent>
    </Card>
  )
}
