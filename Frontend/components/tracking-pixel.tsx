"use client"

import { useEffect } from "react"
import { useStore } from "@/lib/store"

export function TrackingPixel() {
  const user = useStore((s) => s.user)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!user?.id) return
    if (document.querySelector("script[data-outmate-pixel]")) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://app.outmate.ai"
    const s = document.createElement("script")
    s.src = `${apiUrl}/api/v1/visitors/pixel.js`
    s.async = true
    s.setAttribute("data-pixel-key", user.id)
    s.setAttribute("data-outmate-pixel", "1")
    document.head.appendChild(s)
  }, [user?.id])

  return null
}
