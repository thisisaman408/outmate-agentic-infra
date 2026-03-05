"use client"

import { useEffect } from "react"

export default function SignupPage() {
  useEffect(() => {
    window.location.href = "https://outmate-signal-craft.lovable.app/signup"
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <p className="text-muted-foreground text-sm">Redirecting to signup...</p>
    </div>
  )
}
