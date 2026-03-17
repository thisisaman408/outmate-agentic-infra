"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { redirect } from "next/navigation"
import { OtpForm } from "@/components/auth/otp-form"

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  if (!email) redirect("/auth/signup")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <OtpForm email={decodeURIComponent(email)} />
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
