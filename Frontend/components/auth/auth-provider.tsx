"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const setUser = useStore((state) => state.setUser)

  useEffect(() => {
    const checkAuth = async () => {
      const token = authService.getToken()
      const cachedUser = authService.getCurrentUser()

      // ── Step 1: No token → redirect to login ────────────────────────
      if (!token || !cachedUser) {
        const isPublicPage = pathname === "/" || pathname.startsWith("/privacy")
        if (!pathname.startsWith("/auth") && !isPublicPage) {
          router.push("/auth/login")
        }
        setIsLoading(false)
        return
      }

      // ── Step 2: Use cached user immediately (no backend wait) ────────
      setUser(cachedUser)

      const onAuth = pathname.startsWith("/auth")
      const onOnboarding = pathname.startsWith("/onboarding")

      if (onAuth) {
        router.push(cachedUser.onboarding_completed ? "/dashboard" : "/onboarding")
      } else if (!cachedUser.onboarding_completed && !onOnboarding) {
        router.push("/onboarding")
      } else if (cachedUser.onboarding_completed && onOnboarding) {
        router.push("/dashboard")
      }

      setIsLoading(false)

      // ── Step 3: Verify with backend in background ────────────────────
      // Only a real 401 clears the session. Network errors are ignored.
      try {
        const freshUser = await authService.getMe()
        setUser(freshUser)
        if (typeof window !== "undefined" && (window as any).outmate) {
          (window as any).outmate.identify(freshUser.email)
        }
      } catch (err: any) {
        const isAuthError =
          err?.message === "Session expired" || err?.message?.includes("401")
        if (isAuthError) {
          setUser(null)
          router.push("/auth/login?expired=true")
        }
        // Network errors → silently ignored, cached user stays
      }
    }

    checkAuth()
  }, [pathname, router, setUser])

  return <>{children}</>
}
