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
    ExternalLink,
    Bookmark,
    BookmarkCheck,
    Copy,
    MoreVertical,
    Download,
    Share2,
    Clock,
    TrendingUp,
    Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface SearchResult {
    id: string
    query: string
    rank: number
    title: string
    url: string
    snippet: string
    domain: string
    searchedAt: Date
    saved: boolean
}

interface SearchResultCardProps {
    result: SearchResult
}

export function SearchResultCard({ result }: SearchResultCardProps) {
    const [isSaved, setIsSaved] = useState(result.saved)

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

    const getDomainFavicon = (domain: string) => {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    }

    const handleSaveToggle = () => {
        setIsSaved(!isSaved)
        // TODO: Call API to save/unsave
    }

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(result.url)
        // TODO: Show toast notification
    }

    const getRankColor = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
        if (rank <= 3) return "bg-blue-500/10 text-blue-600 border-blue-500/20"
        if (rank <= 5) return "bg-green-500/10 text-green-600 border-green-500/20"
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }

    return (
        <Card className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/60 hover:border-primary/40"
        )}>
            {/* Rank indicator bar */}
            <div className={cn(
                "absolute top-0 left-0 bottom-0 w-1",
                result.rank === 1 ? "bg-yellow-500" : "bg-blue-500"
            )} />

            <div className="pl-5 pr-4 py-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Favicon */}
                        <div className="mt-1 flex-shrink-0">
                            <img
                                src={getDomainFavicon(result.domain)}
                                alt={result.domain}
                                className="w-5 h-5 rounded"
                                onError={(e) => {
                                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='%23ddd'/%3E%3C/svg%3E"
                                }}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Domain & Rank */}
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-muted-foreground">{result.domain}</span>
                                <Badge variant="outline" className={cn("text-xs px-1.5 py-0", getRankColor(result.rank))}>
                                    #{result.rank}
                                </Badge>
                                {result.rank === 1 && (
                                    <Zap className="h-3 w-3 text-yellow-500" />
                                )}
                            </div>

                            {/* Title */}
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 group/link"
                            >
                                {result.title}
                                <ExternalLink className="inline ml-1 h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>

                            {/* URL */}
                            <div className="text-xs text-primary/70 hover:text-primary truncate mt-0.5">
                                {result.url}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 w-8 p-0 transition-colors",
                                isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
                            )}
                            onClick={handleSaveToggle}
                        >
                            {isSaved ? (
                                <BookmarkCheck className="h-4 w-4" />
                            ) : (
                                <Bookmark className="h-4 w-4" />
                            )}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleCopyUrl}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy URL
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share Result
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export to PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open in New Tab
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Snippet */}
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {result.snippet}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>Searched {formatDate(result.searchedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground/60">Query:</span>
                            <Badge variant="outline" className="text-xs font-normal">
                                {result.query}
                            </Badge>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        asChild
                    >
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                            View Page
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </Button>
                </div>
            </div>
        </Card>
    )
}