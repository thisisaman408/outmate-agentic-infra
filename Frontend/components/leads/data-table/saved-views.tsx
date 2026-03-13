"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Bookmark, Trash2, Plus } from "lucide-react"
import { useTablePreferencesStore } from "@/lib/stores/table-preferences-store"

interface SavedViewsDropdownProps {
    tableId: string
    currentVisibility: Record<string, boolean>
    currentFilters?: Record<string, any>
    onApplyView: (visibility: Record<string, boolean>, filters?: Record<string, any>) => void
}

export function SavedViewsDropdown({
    tableId,
    currentVisibility,
    currentFilters,
    onApplyView,
}: SavedViewsDropdownProps) {
    const { savedViews, saveView, deleteView } = useTablePreferencesStore()
    const [newName, setNewName] = useState("")
    const [showInput, setShowInput] = useState(false)

    const views = savedViews.filter((v) => v.tableId === tableId)

    const handleSave = () => {
        if (!newName.trim()) return
        saveView({
            name: newName.trim(),
            tableId,
            columnVisibility: { ...currentVisibility },
            filters: currentFilters,
        })
        setNewName("")
        setShowInput(false)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Views {views.length > 0 && `(${views.length})`}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
                {views.map((view) => (
                    <DropdownMenuItem key={view.id} className="flex items-center justify-between"
                        onClick={() => onApplyView(view.columnVisibility, view.filters)}>
                        <span className="truncate">{view.name}</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-2 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteView(view.id) }}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </DropdownMenuItem>
                ))}

                {views.length > 0 && <DropdownMenuSeparator />}

                {showInput ? (
                    <div className="p-2 flex gap-1">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="View name..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            autoFocus
                        />
                        <Button size="sm" className="h-7 px-2" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                ) : (
                    <DropdownMenuItem onClick={() => setShowInput(true)}>
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Save Current View
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
