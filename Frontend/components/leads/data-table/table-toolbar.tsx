"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Columns3, Download, Bookmark } from "lucide-react"
import { SavedViewsDropdown } from "@/components/leads/data-table/saved-views"
import type { ColumnDef } from "@/hooks/use-table-state"

interface TableToolbarProps<T> {
    tableId: string
    columns: ColumnDef<T>[]
    visibility: Record<string, boolean>
    onToggleColumn: (key: string) => void
    onSetVisibility: (vis: Record<string, boolean>) => void
    totalRows: number
    onExport: () => void
    /** Optional quick filter bar */
    quickFilterBar?: React.ReactNode
}

const CATEGORY_LABELS: Record<string, string> = {
    basic: "Basic",
    firmographic: "Firmographic",
    location: "Location",
    funding: "Funding",
    metrics: "Metrics",
    metadata: "Metadata",
    social: "Social",
    contact: "Contact",
    profile: "Profile",
}

export function TableToolbar<T>({
    tableId,
    columns,
    visibility,
    onToggleColumn,
    onSetVisibility,
    totalRows,
    onExport,
    quickFilterBar,
}: TableToolbarProps<T>) {
    const visibleCount = columns.filter((c) => {
        if (visibility[c.key] === undefined) return c.defaultVisible !== false
        return visibility[c.key]
    }).length

    // Group columns by category
    const categories = Array.from(new Set(columns.map((c) => c.category || "other")))

    return (
        <div className="p-3 border-b border-border/40 bg-muted/30 space-y-2">
            {quickFilterBar}

            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground/80">
                    {totalRows} results
                </h3>
                <div className="flex items-center gap-2">
                    {/* Column toggle */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                                <Columns3 className="h-4 w-4 mr-2" />
                                Columns ({visibleCount})
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px] max-h-[500px] overflow-y-auto">
                            <div className="flex items-center justify-between p-2 sticky top-0 bg-popover z-10 border-b">
                                <span className="font-semibold text-sm">Toggle Columns</span>
                                <Button
                                    variant="ghost" size="sm"
                                    className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                                    onClick={() => {
                                        const allHidden: Record<string, boolean> = {}
                                        columns.forEach((c) => { allHidden[c.key] = false })
                                        onSetVisibility(allHidden)
                                    }}
                                >
                                    Clear All
                                </Button>
                            </div>

                            {categories.map((category) => {
                                const catCols = columns.filter((c) => (c.category || "other") === category)
                                const allVisible = catCols.every((c) => {
                                    if (visibility[c.key] === undefined) return c.defaultVisible !== false
                                    return visibility[c.key]
                                })
                                const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1)

                                return (
                                    <div key={category} className="py-1">
                                        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30">
                                            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 h-auto py-0.5"
                                                onClick={() => {
                                                    const updated = { ...visibility }
                                                    catCols.forEach((c) => { updated[c.key] = !allVisible })
                                                    onSetVisibility(updated)
                                                }}
                                            >
                                                {allVisible ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </div>
                                        {catCols.map((col) => {
                                            const isVisible = visibility[col.key] === undefined ? col.defaultVisible !== false : visibility[col.key]
                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={col.key}
                                                    checked={isVisible}
                                                    onCheckedChange={() => onToggleColumn(col.key)}
                                                    className="pl-8"
                                                >
                                                    {col.label}
                                                </DropdownMenuCheckboxItem>
                                            )
                                        })}
                                        <DropdownMenuSeparator />
                                    </div>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Saved views */}
                    <SavedViewsDropdown
                        tableId={tableId}
                        currentVisibility={visibility}
                        onApplyView={(vis) => onSetVisibility(vis)}
                    />

                    {/* Export */}
                    <Button variant="outline" size="sm" className="h-8" onClick={onExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>
        </div>
    )
}
