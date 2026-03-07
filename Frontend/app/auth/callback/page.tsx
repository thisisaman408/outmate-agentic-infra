"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store"

const AUTH_KEY = "outmate_auth_token"
const USER_KEY = "outmate_user_data"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useStore()

  useEffect(() => {
    const token = searchParams.get("token")
    const userParam = searchParams.get("user")

    if (!token || !userParam) {
      router.replace("/auth/login")
      return
    }

    try {
      const userData = JSON.parse(atob(userParam))

      localStorage.setItem(AUTH_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userData))

      setUser(userData)

      router.replace("/dashboard")
    } catch {
      router.replace("/auth/login")
    }
  }, [searchParams, router, setUser])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
