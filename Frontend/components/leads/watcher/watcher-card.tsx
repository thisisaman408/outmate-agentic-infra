"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    MoreVertical,
    Play,
    Pause,
    Edit,
    Trash2,
    Bell,
    BellOff,
    TrendingUp,
    Clock,
    Activity,
    Building2,
    User,
    Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

type WatcherStatus = "active" | "paused" | "draft"

type BaseWatcher = {
    id: string
    name: string
    description: string
    status: WatcherStatus
    lastTriggered?: Date
}

type EventWatcher = BaseWatcher & {
    type: "event"
    criteria: Record<string, any>
    matchCount: number
    newMatches: number
}

type AccountWatcher = BaseWatcher & {
    type: "account"
    accountName: string
    accountDomain: string
    triggers: string[]
    recentUpdates: Array<{
        type: string
        description: string
        date: Date
    }>
}

type LeadWatcher = BaseWatcher & {
    type: "lead"
    leadName: string
    leadTitle: string
    leadCompany: string
    triggers: string[]
    recentUpdates: Array<{
        type: string
        description: string
        date: Date
    }>
}

type Watcher = EventWatcher | AccountWatcher | LeadWatcher

interface WatcherCardProps {
    watcher: Watcher
}

export function WatcherCard({ watcher }: WatcherCardProps) {
    const formatDate = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString()
    }

    const getStatusColor = (status: WatcherStatus) => {
        switch (status) {
            case "active":
                return "bg-green-500/10 text-green-600 border-green-500/20"
            case "paused":
                return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            case "draft":
                return "bg-gray-500/10 text-gray-600 border-gray-500/20"
        }
    }

    return (
        <Card className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-border/60",
            watcher.status === "active" ? "hover:border-primary/40" : "hover:border-border"
        )}>
            {/* Status indicator bar */}
            <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                watcher.status === "active" ? "bg-green-500" : "bg-gray-300"
            )} />

            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                            "mt-0.5 p-2 rounded-lg flex-shrink-0",
                            watcher.type === "event" && "bg-blue-500/10 text-blue-600",
                            watcher.type === "account" && "bg-purple-500/10 text-purple-600",
                            watcher.type === "lead" && "bg-orange-500/10 text-orange-600"
                        )}>
                            {watcher.type === "event" && <Activity className="h-4 w-4" />}
                            {watcher.type === "account" && <Building2 className="h-4 w-4" />}
                            {watcher.type === "lead" && <User className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">{watcher.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {watcher.description}
                            </p>
                        </div>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Watcher
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                {watcher.status === "active" ? (
                                    <>
                                        <Pause className="mr-2 h-4 w-4" />
                                        Pause Watcher
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Activate Watcher
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Bell className="mr-2 h-4 w-4" />
                                Notification Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Watcher
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Type-specific content */}
                {watcher.type === "event" && (
                    <EventWatcherContent watcher={watcher} />
                )}
                {watcher.type === "account" && (
                    <AccountWatcherContent watcher={watcher} />
                )}
                {watcher.type === "lead" && (
                    <LeadWatcherContent watcher={watcher} />
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {watcher.lastTriggered ? (
                            <span>Last updated {formatDate(watcher.lastTriggered)}</span>
                        ) : (
                            <span>No updates yet</span>
                        )}
                    </div>
                    <Badge variant="outline" className={getStatusColor(watcher.status)}>
                        {watcher.status}
                    </Badge>
                </div>
            </div>
        </Card>
    )
}

function EventWatcherContent({ watcher }: { watcher: EventWatcher }) {
    return (
        <div className="space-y-3">
            {/* Match stats */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-md">
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <div className="text-sm font-medium">{watcher.matchCount}</div>
                        <div className="text-xs text-muted-foreground">Total Matches</div>
                    </div>
                </div>
                {watcher.newMatches > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="bg-green-500/10 p-2 rounded-md">
                            <Sparkles className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-green-600">{watcher.newMatches}</div>
                            <div className="text-xs text-muted-foreground">New Today</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Criteria preview */}
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(watcher.criteria).slice(0, 3).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                        {key.replace(/_/g, " ")}: {Array.isArray(value) ? value.join(", ") : value}
                    </Badge>
                ))}
            </div>
        </div>
    )
}

function AccountWatcherContent({ watcher }: { watcher: AccountWatcher }) {
    return (
        <div className="space-y-3">
            {/* Account info */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{watcher.accountName}</div>
                    <div className="text-xs text-muted-foreground truncate">{watcher.accountDomain}</div>
                </div>
            </div>

            {/* Trigger types */}
            <div className="flex flex-wrap gap-1.5">
                {watcher.triggers.map((trigger) => (
                    <Badge key={trigger} variant="outline" className="text-xs">
                        <Bell className="h-3 w-3 mr-1" />
                        {trigger.replace(/_/g, " ")}
                    </Badge>
                ))}
            </div>

            {/* Recent updates */}
            {watcher.recentUpdates.length > 0 && (
                <div className="space-y-1.5">
                    {watcher.recentUpdates.slice(0, 2).map((update, idx) => (
                        <div key={idx} className="text-xs p-2 bg-muted/30 rounded border border-border/40">
                            <div className="font-medium text-foreground">{update.description}</div>
                            <div className="text-muted-foreground mt-0.5">
                                {new Date(update.date).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function LeadWatcherContent({ watcher }: { watcher: LeadWatcher }) {
    return (
        <div className="space-y-3">
            {/* Lead info */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{watcher.leadName}</div>
                    <div className="text-xs text-muted-foreground">{watcher.leadTitle}</div>
                    <div className="text-xs text-muted-foreground truncate">{watcher.leadCompany}</div>
                </div>
            </div>

            {/* Trigger types */}
            <div className="flex flex-wrap gap-1.5">
                {watcher.triggers.map((trigger) => (
                    <Badge key={trigger} variant="outline" className="text-xs">
                        <Bell className="h-3 w-3 mr-1" />
                        {trigger.replace(/_/g, " ")}
                    </Badge>
                ))}
            </div>

            {/* Recent updates */}
            {watcher.recentUpdates.length > 0 && (
                <div className="space-y-1.5">
                    {watcher.recentUpdates.slice(0, 2).map((update, idx) => (
                        <div key={idx} className="text-xs p-2 bg-muted/30 rounded border border-border/40">
                            <div className="font-medium text-foreground">{update.description}</div>
                            <div className="text-muted-foreground mt-0.5">
                                {new Date(update.date).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}