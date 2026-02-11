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
    Copy,
    MoreVertical,
    Download,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Gauge,
    Calendar,
    User,
    Tag
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface FetchResult {
    id: string
    url: string
    title: string
    htmlContent: string | null
    textContent: string | null
    contentLength: number
    fetchedAt: Date
    status: "success" | "failed" | "pending"
    responseTime: number
    error?: string
    metadata?: {
        author?: string
        publishDate?: string
        keywords?: string[]
    }
}

interface FetchResultCardProps {
    result: FetchResult
}

export function FetchResultCard({ result }: FetchResultCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)

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

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "success":
                return {
                    icon: CheckCircle2,
                    color: "bg-green-500/10 text-green-600 border-green-500/20",
                    label: "Success"
                }
            case "failed":
                return {
                    icon: XCircle,
                    color: "bg-red-500/10 text-red-600 border-red-500/20",
                    label: "Failed"
                }
            case "pending":
                return {
                    icon: Loader2,
                    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                    label: "Pending"
                }
            default:
                return {
                    icon: Clock,
                    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
                    label: "Unknown"
                }
        }
    }

    const getResponseTimeColor = (time: number) => {
        if (time < 1) return "text-green-600"
        if (time < 3) return "text-yellow-600"
        return "text-red-600"
    }

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(result.url)
        // TODO: Show toast notification
    }

    const handleCopyContent = () => {
        if (result.textContent) {
            navigator.clipboard.writeText(result.textContent)
            // TODO: Show toast notification
        }
    }

    const handleDownloadHTML = () => {
        if (result.htmlContent) {
            const blob = new Blob([result.htmlContent], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${result.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    const statusConfig = getStatusConfig(result.status)
    const StatusIcon = statusConfig.icon

    return (
        <Card className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/60",
            result.status === "success" && "hover:border-green-500/40",
            result.status === "failed" && "hover:border-red-500/40"
        )}>
            {/* Status indicator bar */}
            <div className={cn(
                "absolute top-0 left-0 bottom-0 w-1",
                result.status === "success" && "bg-green-500",
                result.status === "failed" && "bg-red-500",
                result.status === "pending" && "bg-blue-500"
            )} />

            <div className="pl-5 pr-4 py-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                            "mt-0.5 p-2 rounded-lg flex-shrink-0",
                            result.status === "success" && "bg-green-500/10 text-green-600",
                            result.status === "failed" && "bg-red-500/10 text-red-600",
                            result.status === "pending" && "bg-blue-500/10 text-blue-600"
                        )}>
                            <StatusIcon className={cn(
                                "h-4 w-4",
                                result.status === "pending" && "animate-spin"
                            )} />
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Title */}
                            <h3 className="font-semibold text-base line-clamp-1">{result.title}</h3>

                            {/* URL */}
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary/70 hover:text-primary truncate block mt-0.5 group/link"
                            >
                                {result.url}
                                <ExternalLink className="inline ml-1 h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                        </div>
                    </div>

                    {/* Actions */}
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
                            <DropdownMenuItem onClick={handleCopyUrl}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy URL
                            </DropdownMenuItem>
                            {result.textContent && (
                                <DropdownMenuItem onClick={handleCopyContent}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Copy Text Content
                                </DropdownMenuItem>
                            )}
                            {result.htmlContent && (
                                <DropdownMenuItem onClick={handleDownloadHTML}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download HTML
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open in New Tab
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Metrics Row */}
                <div className="flex items-center gap-4 text-xs">
                    <Badge variant="outline" className={statusConfig.color}>
                        {statusConfig.label}
                    </Badge>

                    {result.status === "success" && (
                        <>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                <span>{formatBytes(result.contentLength)}</span>
                            </div>
                            <div className={cn("flex items-center gap-1.5 font-medium", getResponseTimeColor(result.responseTime))}>
                                <Gauge className="h-3 w-3" />
                                <span>{result.responseTime}s</span>
                            </div>
                        </>
                    )}

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(result.fetchedAt)}</span>
                    </div>
                </div>

                {/* Error Message */}
                {result.status === "failed" && result.error && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                        <p className="text-xs text-red-600 flex items-start gap-2">
                            <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{result.error}</span>
                        </p>
                    </div>
                )}

                {/* Content Preview */}
                {result.status === "success" && result.textContent && (
                    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                        <div className="space-y-2">
                            <div className="p-3 bg-muted/30 border border-border/60 rounded-md">
                                <p className={cn(
                                    "text-sm text-muted-foreground leading-relaxed",
                                    !isExpanded && "line-clamp-3"
                                )}>
                                    {result.textContent}
                                </p>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full text-xs h-7">
                                    {isExpanded ? "Show Less" : "Show More"}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </Collapsible>
                )}

                {/* Metadata */}
                {result.metadata && (
                    <div className="pt-2 border-t border-border/40 space-y-2">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {result.metadata.author && (
                                <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3" />
                                    <span>{result.metadata.author}</span>
                                </div>
                            )}
                            {result.metadata.publishDate && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    <span>{result.metadata.publishDate}</span>
                                </div>
                            )}
                        </div>
                        {result.metadata.keywords && result.metadata.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <Tag className="h-3 w-3 text-muted-foreground mt-0.5" />
                                {result.metadata.keywords.map((keyword, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                        {keyword}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    )
}