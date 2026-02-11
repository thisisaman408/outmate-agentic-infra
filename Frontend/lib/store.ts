// Global state management using Zustand
import { create } from "zustand"
import type { User } from "./auth"

interface AppState {
  user: User | null
  isAuthenticated: boolean
  sidebarCollapsed: boolean
  setUser: (user: User | null) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  logout: () => void
}

export const useStore = create<AppState>((set) => ({
  user: {
    id: "user_1",
    email: "user@example.com",
    name: "Demo User",
    workspace: "Main Workspace",
    credits: 1000,
  },
  isAuthenticated: true,
  sidebarCollapsed: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
