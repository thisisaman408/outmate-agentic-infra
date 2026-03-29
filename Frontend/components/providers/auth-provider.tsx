"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser } = useStore()
  const hasHandledExpiry = useRef(false)

  // Restore auth state from localStorage on mount / path change
  useEffect(() => {
    const user = authService.getCurrentUser()
    setUser(user)

    const normalizedPath = pathname || "/"
    if (user) {
      // If already logged in and on an auth page, go to dashboard
      if (normalizedPath.startsWith("/auth")) {
        router.replace("/dashboard")
      }
    } else if (!normalizedPath.startsWith("/auth")) {
      // Not logged in — redirect to local login page
      router.replace("/auth/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router, setUser])

  // Patch global fetch to attach Authorization header and handle 401 (session expired)
  useEffect(() => {
    if (typeof window === "undefined") return
    if ((window as any)._outmateFetchPatched) return
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo, init?: RequestInit) => {
      const authHeaders = authService.getAuthHeaders()
      const headers = new Headers(init?.headers ?? {})
      Object.entries(authHeaders).forEach(([key, value]) => {
        if (value) {
          headers.set(key, value)
        }
      })
      const finalInit = { ...init, headers }
      const response = await originalFetch(input, finalInit)

      // Handle 401 — token expired or invalid
      if (response.status === 401 && !hasHandledExpiry.current) {
        const url = typeof input === "string" ? input : (input as Request).url
        // Don't trigger on auth endpoints (login/signup/etc.) — those 401s are expected
        const isAuthEndpoint = url.includes("/auth/")
        if (!isAuthEndpoint && authService.getToken()) {
          hasHandledExpiry.current = true
          // Clear local session
          localStorage.removeItem("outmate_auth_token")
          localStorage.removeItem("outmate_user_data")
          setUser(null)
          // Redirect to login with session expired message
          router.replace("/auth/login?expired=true")
        }
      }

      return response
    }

    ;(window as any)._outmateFetchPatched = true

    return () => {
      window.fetch = originalFetch
      delete (window as any)._outmateFetchPatched
    }
  }, [router, setUser])

  return <>{children}</>
}
