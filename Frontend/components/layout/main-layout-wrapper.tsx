"use client"

import React from "react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { sidebarCollapsed } = useStore()

    return (
        <div
            className={cn(
                "flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out",
                sidebarCollapsed ? "pl-16" : "pl-64"
            )}
        >
            {children}
        </div>
    )
}
