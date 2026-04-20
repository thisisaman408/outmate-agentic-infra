import { useState, useMemo, useCallback, useEffect } from "react"
import { useTablePreferencesStore } from "@/lib/stores/table-preferences-store"

export interface ColumnDef<T> {
  key: string
  label: string
  defaultVisible?: boolean
  width?: string
  category?: string
  sortable?: boolean
  render?: (value: any, row: T, index: number) => React.ReactNode
}

export interface SortState {
  column: string | null
  direction: "asc" | "desc"
}

export interface UseTableStateOptions<T> {
  tableId: string
  data: T[]
  columns: ColumnDef<T>[]
  defaultPageSize?: number
  getRowId: (row: T, index: number) => string
}

export function useTableState<T>({
  tableId,
  data,
  columns,
  defaultPageSize = 25,
  getRowId,
}: UseTableStateOptions<T>) {
  // Selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Sort
  const [sort, setSort] = useState<SortState>({ column: null, direction: "asc" })

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  // Column visibility from Zustand store
  const { columnVisibility, setColumnVisibility, toggleColumn: storeToggleColumn } =
    useTablePreferencesStore()

  // Initialize column visibility from defaults, or reset if columns changed
  useEffect(() => {
    const existing = columnVisibility[tableId]
    const defaults: Record<string, boolean> = {}
    columns.forEach((col) => {
      defaults[col.key] = col.defaultVisible !== false
    })
    // Reset if no existing prefs, or if column set changed (new/removed columns)
    const defaultKeys = Object.keys(defaults).sort().join(',')
    const existingKeys = existing ? Object.keys(existing).sort().join(',') : ''
    // Also force reset if tableId contains a version suffix (e.g., -v2, -v3) to apply new defaults
    const hasVersionSuffix = /-v\d+$/.test(tableId)
    if (!existing || defaultKeys !== existingKeys || hasVersionSuffix) {
      setColumnVisibility(tableId, defaults)
    }
  }, [tableId]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibility = columnVisibility[tableId] || {}

  const visibleColumns = useMemo(
    () =>
      columns.filter((col) => {
        if (visibility[col.key] === undefined) return col.defaultVisible !== false
        return visibility[col.key]
      }),
    [columns, visibility]
  )

  // Sort data client-side
  const sortedData = useMemo(() => {
    if (!sort.column) return data
    const col = columns.find((c) => c.key === sort.column)
    if (!col) return data

    return [...data].sort((a, b) => {
      const aVal = (a as any)[sort.column!]
      const bVal = (b as any)[sort.column!]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      let cmp: number
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      }

      return sort.direction === "asc" ? cmp : -cmp
    })
  }, [data, sort, columns])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, page, pageSize])

  // Reset page when data changes
  useEffect(() => {
    setPage(1)
  }, [data.length])

  // Selection helpers
  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set())
    } else {
      const ids = paginatedData.map((row, i) => getRowId(row, (page - 1) * pageSize + i))
      setSelectedRows(new Set(ids))
    }
  }, [paginatedData, selectedRows.size, getRowId, page, pageSize])

  const clearSelection = useCallback(() => setSelectedRows(new Set()), [])

  const isAllSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < paginatedData.length

  // Sort handler
  const handleSort = useCallback((columnKey: string) => {
    setSort((prev) => {
      if (prev.column === columnKey) {
        return { column: columnKey, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { column: columnKey, direction: "asc" }
    })
  }, [])

  // Column toggle
  const toggleColumn = useCallback(
    (columnKey: string) => {
      storeToggleColumn(tableId, columnKey)
    },
    [tableId, storeToggleColumn]
  )

  const setAllColumnsVisibility = useCallback(
    (vis: Record<string, boolean>) => {
      setColumnVisibility(tableId, vis)
    },
    [tableId, setColumnVisibility]
  )

  // Get selected rows data
  const selectedData = useMemo(() => {
    return data.filter((row, i) => selectedRows.has(getRowId(row, i)))
  }, [data, selectedRows, getRowId])

  return {
    // Data
    sortedData,
    paginatedData,
    totalRows: sortedData.length,

    // Selection
    selectedRows,
    selectedData,
    toggleRow,
    toggleAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,

    // Sort
    sort,
    handleSort,

    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,

    // Columns
    visibleColumns,
    visibility,
    toggleColumn,
    setAllColumnsVisibility,
  }
}
