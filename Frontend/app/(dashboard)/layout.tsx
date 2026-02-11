import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { AuthProvider } from "@/components/providers/auth-provider"

import { MainLayoutWrapper } from "@/components/layout/main-layout-wrapper"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainLayoutWrapper>
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </MainLayoutWrapper>
      </div>
    </AuthProvider>
  )
}
