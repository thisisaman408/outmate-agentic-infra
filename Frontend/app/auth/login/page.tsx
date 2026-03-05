"use client"

import { useEffect } from "react"

export default function LoginPage() {
  useEffect(() => {
    window.location.href = "https://outmate-signal-craft.lovable.app/login"
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <p className="text-muted-foreground text-sm">Redirecting to login...</p>
    </div>
  )
}
