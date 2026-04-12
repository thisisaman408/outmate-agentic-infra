import type React from "react"
import { AuthProvider } from "@/components/providers/auth-provider"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen w-full overflow-hidden bg-white">
        {children}
      </div>
    </AuthProvider>
  )
}
