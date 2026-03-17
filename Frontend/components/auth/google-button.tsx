"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

interface GoogleButtonProps {
  onCredential: (credential: string) => void
  text?: "signin_with" | "signup_with" | "continue_with"
  disabled?: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (parent: HTMLElement, options: object) => void
          cancel: () => void
        }
      }
    }
    __gsi_loaded?: boolean
  }
}

export function GoogleButton({ onCredential, text = "continue_with", disabled }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const renderButton = () => {
    if (!window.google || !containerRef.current || !clientId) return

    // Clear previous render
    containerRef.current.innerHTML = ""

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => {
        onCredential(response.credential)
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    })

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      text,
      width: Math.min(containerRef.current.clientWidth || 400, 400),
      shape: "rectangular",
      logo_alignment: "center",
    })
  }

  useEffect(() => {
    if (ready) renderButton()
  }, [ready, text, disabled])

  if (!clientId) return null

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => {
          window.__gsi_loaded = true
          setReady(true)
        }}
        onReady={() => {
          if (window.__gsi_loaded) setReady(true)
        }}
      />
      <div
        ref={containerRef}
        className="w-full flex justify-center"
        style={{ minHeight: 44, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
      />
    </>
  )
}
