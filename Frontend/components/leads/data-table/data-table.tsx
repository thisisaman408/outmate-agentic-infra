"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ColumnDef, SortState } from "@/hooks/use-table-state"

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  visibleColumns: ColumnDef<T>[]
  sort: SortState
  onSort: (columnKey: string) => void
  selectedRows: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: () => void
  isAllSelected: boolean
  isSomeSelected: boolean
  getRowId: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  /** Extra column rendered after all data columns (e.g. actions) */
  renderActions?: (row: T, index: number) => React.ReactNode
  pageOffset?: number
}

export function DataTable<T>({
  data,
  columns,
  visibleColumns,
  sort,
  onSort,
  selectedRows,
  onToggleRow,
  onToggleAll,
  isAllSelected,
  isSomeSelected,
  getRowId,
  onRowClick,
  renderActions,
  pageOffset = 0,
}: DataTableProps<T>) {
  return (
    <div className="flex-1 overflow-auto max-h-[calc(100vh-20rem)]">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            {/* Checkbox column */}
            <TableHead className="w-[40px] bg-muted/50">
              <Checkbox
                checked={isAllSelected}
                ref={(el) => {
                  if (el) {
                    // @ts-ignore - indeterminate is a valid DOM property
                    el.dataset.state = isSomeSelected ? "indeterminate" : isAllSelected ? "checked" : "unchecked"
                  }
                }}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
              />
            </TableHead>

            {/* Data columns */}
            {visibleColumns.map((col) => (
              <TableHead
                key={col.key}
                style={{ minWidth: col.width }}
                className={cn(
                  "bg-muted/50",
                  col.sortable !== false && "cursor-pointer select-none hover:bg-muted/70"
                )}
                onClick={() => col.sortable !== false && onSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable !== false && (
                    <span className="ml-1">
                      {sort.column === col.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}

            {/* Actions column */}
            {renderActions && (
              <TableHead className="text-right bg-muted/50 sticky right-0">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((row, idx) => {
            const globalIdx = pageOffset + idx
            const rowId = getRowId(row, globalIdx)
            const isSelected = selectedRows.has(rowId)

            return (
              <TableRow
                key={rowId}
                className={cn(
                  "hover:bg-muted/50 transition-colors",
                  isSelected && "bg-primary/5",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {/* Checkbox */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleRow(rowId)}
                    aria-label={`Select row ${idx + 1}`}
                  />
                </TableCell>

                {/* Data cells */}
                {visibleColumns.map((col) => (
                  <TableCell key={`${rowId}-${col.key}`}>
                    {col.render
                      ? col.render((row as any)[col.key], row, globalIdx)
                      : renderDefaultCell((row as any)[col.key])}
                  </TableCell>
                ))}

                {/* Actions */}
                {renderActions && (
                  <TableCell
                    className="text-right sticky right-0 bg-background"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(row, globalIdx)}
                  </TableCell>
                )}
              </TableRow>
            )
          })}

          {data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length + (renderActions ? 2 : 1)}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function renderDefaultCell(value: any) {
  if (value === undefined || value === null || value === "") return <>N/A</>
  if (Array.isArray(value)) return <>{value.join(", ")}</>
  if (typeof value === "object") return <>{JSON.stringify(value)}</>
  return <>{String(value)}</>
}
