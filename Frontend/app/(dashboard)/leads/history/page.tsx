/**
 * Search History Page
 * Displays all saved prospect searches for easy restoration
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Clock, AlertCircle } from "lucide-react"
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

export default function HistoryPage() {
    const router = useRouter()
    const [history, setHistory] = useState<SearchHistoryItem[]>([])
    const [showClearDialog, setShowClearDialog] = useState(false)

    // Load history on mount
    useEffect(() => {
        setHistory(getSearchHistory())
    }, [])

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
        deleteSearchHistoryItem(id)
        setHistory(getSearchHistory())
    }

    // Clear all history
    const handleClearAll = () => {
        clearSearchHistory()
        setHistory([])
        setShowClearDialog(false)
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Search History</h2>
                    <p className="text-muted-foreground mt-1">
                        View and restore your previous prospect searches
                    </p>
                </div>

                {history.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={() => setShowClearDialog(true)}
                        className="text-destructive hover:text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All
                    </Button>
                )}
            </div>

            {/* History List */}
            {history.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="bg-muted rounded-full p-4 mb-4">
                            <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">No search history yet</p>
                        <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                            Your prospect searches will be automatically saved here for easy access.
                            Start by searching for prospects!
                        </p>
                        <Button
                            className="mt-6"
                            onClick={() => router.push("/leads/prospects")}
                        >
                            Go to Prospects
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Info Banner */}
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                        <CardContent className="flex items-start gap-3 p-4">
                            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-blue-900 dark:text-blue-100">
                                    Testing Feature
                                </p>
                                <p className="text-blue-700 dark:text-blue-300 mt-1">
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
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Showing {history.length} search{history.length !== 1 ? "es" : ""} •
                                Last 50 searches are kept
                            </p>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Clear All Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear all search history?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {history.length} saved search
                            {history.length !== 1 ? "es" : ""}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearAll}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
