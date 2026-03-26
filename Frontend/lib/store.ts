// Global state management using Zustand
import { create } from "zustand"
import type { User } from "./auth"

interface AppState {
  user: User | null
  isAuthenticated: boolean
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  setUser: (user: User | null) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  logout: () => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
