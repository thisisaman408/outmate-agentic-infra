"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser } = useStore()
  const hasHandledExpiry = useRef(false)
  const lastConnectionToast = useRef(0)

  // Restore auth state from localStorage on mount / path change
  useEffect(() => {
    const user = authService.getCurrentUser()
    setUser(user)

    const normalizedPath = pathname || "/"

    // Allow public pages (homepage, privacy policy, etc.) without auth
    const isPublicPage = normalizedPath === "/" || normalizedPath.startsWith("/privacy")

    if (user) {
      if (normalizedPath.startsWith("/auth")) {
        // After login/signup — route based on onboarding status
        if (user.onboarding_completed) {
          router.replace("/dashboard")
        } else {
          router.replace("/onboarding")
        }
      } else if (!user.onboarding_completed && !normalizedPath.startsWith("/onboarding")) {
        // Logged in but onboarding not done — block access to rest of app
        router.replace("/onboarding")
      } else if (user.onboarding_completed && normalizedPath.startsWith("/onboarding")) {
        // Already completed onboarding — don't let them go back
        router.replace("/dashboard")
      }
    } else if (!normalizedPath.startsWith("/auth") && !isPublicPage) {
      // Not logged in and not on an auth or public page — send to login
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

      const url = typeof input === "string" ? input : (input as Request).url
      const isApiCall = url.includes("/api/") || url.startsWith(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")

      const showConnectionToast = (msg: string) => {
        const now = Date.now()
        if (now - lastConnectionToast.current > 5000) {
          lastConnectionToast.current = now
          toast.error(msg, { duration: 4000 })
        }
      }

      let response: Response
      try {
        response = await originalFetch(input, finalInit)
      } catch (err: any) {
        // Network failure (offline, DNS, connection refused, timeout) — don't redirect.
        if (isApiCall) {
          const msg = !navigator.onLine
            ? "You're offline. Check your internet connection."
            : "Connection issue — your network is slow or unstable. Please retry."
          showConnectionToast(msg)
        }
        throw err
      }

      // Handle 503 / 504 — backend slow or DB transient failure. Don't log out.
      if ((response.status === 503 || response.status === 504) && isApiCall) {
        showConnectionToast("Connection is slow — the server is taking longer than usual. Please retry.")
        return response
      }

      // Handle 401 — token expired or invalid
      if (response.status === 401 && !hasHandledExpiry.current) {
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
