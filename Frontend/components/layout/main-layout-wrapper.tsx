"use client"

import React from "react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
const GlobalCopilotPanel = dynamic(
    () => import("@/components/copilot/global-copilot-panel").then(mod => mod.GlobalCopilotPanel),
    { ssr: false }
)
const LeadCopilotPanel = dynamic(
    () => import("@/components/copilot/lead-copilot-panel").then(mod => mod.LeadCopilotPanel),
    { ssr: false }
)

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { sidebarCollapsed } = useStore()

    return (
        <div
            className={cn(
                "flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out",
                sidebarCollapsed ? "lg:pl-16" : "lg:pl-64",
                "pl-0" // No padding on mobile
            )}
        >
            {children}
            <GlobalCopilotPanel />
            <LeadCopilotPanel />
        </div>
    )
}
