/**
 * History Card Component
 * Displays a single search history item with filters and result count
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Trash2, Users } from "lucide-react"
import { SearchHistoryItem } from "@/lib/stores/searchHistoryStore"
import { formatDistanceToNow } from "date-fns"

interface HistoryCardProps {
    item: SearchHistoryItem
    onRestore: (item: SearchHistoryItem) => void
    onDelete: (id: string) => void
}

export function HistoryCard({ item, onRestore, onDelete }: HistoryCardProps) {
    const formattedTime = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
    const formattedDate = new Date(item.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })

    return (
        <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onRestore(item)}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Details */}
                    <div className="flex-1 min-w-0">
                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Clock className="h-3 w-3" />
                            <span>{formattedTime}</span>
                            <span className="text-muted-foreground/70">•</span>
                            <span>{formattedDate}</span>
                        </div>

                        {/* Filter Summary */}
                        <p className="text-sm font-medium mb-2 truncate">
                            {item.filterSummary}
                        </p>

                        {/* Result Count Badge */}
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {item.totalCount.toLocaleString()} found
                            </Badge>
                            {item.results.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {item.results.length} loaded
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: Delete Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(item.id)
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
