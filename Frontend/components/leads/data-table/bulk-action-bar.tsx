"use client"

import { Button } from "@/components/ui/button"
import { Download, Zap, ListPlus, X } from "lucide-react"

interface BulkActionBarProps {
    selectedCount: number
    onClearSelection: () => void
    onExportSelected?: () => void
    onEnrichAll?: () => void
    onAddToList?: () => void
}

export function BulkActionBar({
    selectedCount,
    onClearSelection,
    onExportSelected,
    onEnrichAll,
    onAddToList,
}: BulkActionBarProps) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-lg shadow-lg px-5 py-3">
                <span className="text-sm font-medium">
                    {selectedCount} selected
                </span>
                <div className="h-4 w-px bg-primary-foreground/30" />
                {onExportSelected && (
                    <Button variant="secondary" size="sm" className="h-7" onClick={onExportSelected}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export
                    </Button>
                )}
                {onEnrichAll && (
                    <Button variant="secondary" size="sm" className="h-7" onClick={onEnrichAll}>
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Enrich All
                    </Button>
                )}
                {onAddToList && (
                    <Button variant="secondary" size="sm" className="h-7" onClick={onAddToList}>
                        <ListPlus className="h-3.5 w-3.5 mr-1.5" />
                        Add to List
                    </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
                    onClick={onClearSelection}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear
                </Button>
            </div>
        </div>
    )
}
