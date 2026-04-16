/**
 * History Card Component
 * Displays a single search history item with filters and result count
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Trash2, Users, ArrowRight } from "lucide-react"
import { SearchHistoryItem } from "@/lib/stores/searchHistoryStore"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

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
            className="cursor-pointer hover:bg-primary/5 hover:border-primary/20 transition-all group border-dashed"
            onClick={() => onRestore(item)}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Details */}
                    <div className="flex-1 min-w-0">
                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                            <Clock className="h-3 w-3" />
                            <span>{formattedTime}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>{formattedDate}</span>
                        </div>

                        {/* Filter Summary */}
                        <p className="text-[11px] font-black text-foreground uppercase tracking-wider mb-3 truncate leading-relaxed">
                            {item.filterSummary}
                        </p>

                        {/* Result Count Badge */}
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] bg-primary/10 text-primary border-primary/20">
                                <Users className="h-3 w-3" />
                                {item.totalCount.toLocaleString()} found
                            </Badge>
                            {item.results.length > 0 && (
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                    {item.results.length} loaded
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-0 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(item.id)
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                        </Button>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            <ArrowRight className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
