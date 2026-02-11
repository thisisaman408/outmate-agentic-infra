"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser, isAuthenticated } = useStore()

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user) {
      setUser(user)
    }
    // Auth redirect logic removed to disable authentication enforcement
  }, [pathname, router, setUser])

  return <>{children}</>
}
