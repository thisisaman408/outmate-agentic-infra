import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface SavedView {
  id: string
  name: string
  tableId: string
  columnVisibility: Record<string, boolean>
  filters?: Record<string, any>
  createdAt: number
}

interface TablePreferencesState {
  // Column visibility per table
  columnVisibility: Record<string, Record<string, boolean>>
  setColumnVisibility: (tableId: string, visibility: Record<string, boolean>) => void
  toggleColumn: (tableId: string, columnKey: string) => void

  // Saved views per table
  savedViews: SavedView[]
  saveView: (view: Omit<SavedView, "id" | "createdAt">) => void
  deleteView: (viewId: string) => void
  getViewsForTable: (tableId: string) => SavedView[]
}

export const useTablePreferencesStore = create<TablePreferencesState>()(
  persist(
    (set, get) => ({
      columnVisibility: {},

      setColumnVisibility: (tableId, visibility) =>
        set((state) => ({
          columnVisibility: {
            ...state.columnVisibility,
            [tableId]: visibility,
          },
        })),

      toggleColumn: (tableId, columnKey) =>
        set((state) => {
          const current = state.columnVisibility[tableId] || {}
          return {
            columnVisibility: {
              ...state.columnVisibility,
              [tableId]: {
                ...current,
                [columnKey]: !current[columnKey],
              },
            },
          }
        }),

      savedViews: [],

      saveView: (view) =>
        set((state) => ({
          savedViews: [
            ...state.savedViews,
            {
              ...view,
              id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
            },
          ],
        })),

      deleteView: (viewId) =>
        set((state) => ({
          savedViews: state.savedViews.filter((v) => v.id !== viewId),
        })),

      getViewsForTable: (tableId) =>
        get().savedViews.filter((v) => v.tableId === tableId),
    }),
    {
      name: "table-preferences",
    }
  )
)
