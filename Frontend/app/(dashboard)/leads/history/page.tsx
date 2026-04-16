/**
 * Search History Page
 * Displays all saved prospect searches for easy restoration
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Clock, AlertCircle, Users, ArrowLeft } from "lucide-react"
import { HistoryCard } from "@/components/leads/history/history-card"
import {
    getSearchHistory,
    deleteSearchHistoryItem,
    clearSearchHistory,
    SearchHistoryItem,
} from "@/lib/stores/searchHistoryStore"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function HistoryPage() {
    const router = useRouter()
    const [history, setHistory] = useState<SearchHistoryItem[]>([])
    const [showClearDialog, setShowClearDialog] = useState(false)
    const [loading, setLoading] = useState(true)

    // Load history on mount
    const loadHistory = useCallback(() => {
        try {
            setHistory(getSearchHistory())
        } catch (error) {
            toast.error("Failed to load search history")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadHistory()
    }, [loadHistory])

    // Restore a search
    const handleRestore = (item: SearchHistoryItem) => {
        // Navigate to the correct page with history ID
        if (item.type === 'companies' || item.route?.includes('/leads/companies')) {
            router.push(`/leads/companies/search?historyId=${item.id}`)
        } else {
            router.push(`/leads/prospects?historyId=${item.id}`)
        }
    }

    // Delete a single history item
    const handleDelete = (id: string) => {
        try {
            deleteSearchHistoryItem(id)
            loadHistory()
            toast.success("Search deleted from history")
        } catch (error) {
            toast.error("Failed to delete search")
        }
    }

    // Clear all history
    const handleClearAll = () => {
        try {
            clearSearchHistory()
            loadHistory()
            setShowClearDialog(false)
            toast.success("All search history cleared")
        } catch (error) {
            toast.error("Failed to clear history")
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">Loading history...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase">Search History</h2>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
                                View and restore your previous prospect searches
                            </p>
                        </div>
                    </div>
                </div>

                {history.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => setShowClearDialog(true)}
                        className="border-red-500/20 text-red-500 hover:bg-red-500/5 hover:border-red-500/30 font-black uppercase tracking-widest text-[10px] rounded-xl"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All
                    </Button>
                )}
            </div>

            {/* History List */}
            {history.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-20">
                        <div className="bg-muted/20 rounded-full p-6 mb-6">
                            <Clock className="h-12 w-12 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-black text-foreground uppercase tracking-wider mb-2">No search history yet</h3>
                        <p className="text-[11px] font-bold text-muted-foreground/60 mt-2 text-center max-w-md uppercase tracking-widest leading-relaxed">
                            Your prospect searches will be automatically saved here for easy access.
                            Start by searching for prospects!
                        </p>
                        <Button
                            className="mt-8 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"
                            onClick={() => router.push("/leads/prospects")}
                        >
                            Go to Prospects
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Info Banner */}
                    <Card className="bg-primary/5 border-primary/10">
                        <CardContent className="flex items-start gap-4 p-5">
                            <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                                <AlertCircle className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-foreground uppercase tracking-wider mb-1">
                                    Testing Feature
                                </p>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                                    This history is stored locally in your browser and limited to the last 50 searches.
                                    Click any search to restore its results.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* History Items */}
                    <div className="space-y-3">
                        {history.map((item) => (
                            <HistoryCard
                                key={item.id}
                                item={item}
                                onRestore={handleRestore}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>

                    {/* Stats */}
                    <Card className="bg-muted/20 border-dashed">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-center gap-4">
                                <Badge variant="secondary" className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px]">
                                    <Users className="h-3 w-3" />
                                    {history.length} search{history.length !== 1 ? "es" : ""}
                                </Badge>
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                    Last 50 searches are kept
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Clear All Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-black uppercase tracking-wider">
                            Clear all search history?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                            This will permanently delete all {history.length} saved search
                            {history.length !== 1 ? "es" : ""}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="font-black uppercase tracking-widest text-[10px] rounded-xl">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearAll}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase tracking-widest text-[10px] rounded-xl"
                        >
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
