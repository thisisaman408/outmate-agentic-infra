"use client"

import React, { useState } from "react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
import { useNotifications } from "@/hooks/use-notifications"
import { useAgentToast } from "@/hooks/use-agent-toast"
import { Bot, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"

const GlobalCopilotPanel = dynamic(
    () => import("@/components/copilot/global-copilot-panel").then(mod => mod.GlobalCopilotPanel),
    { ssr: false }
)
const LeadCopilotPanel = dynamic(
    () => import("@/components/copilot/lead-copilot-panel").then(mod => mod.LeadCopilotPanel),
    { ssr: false }
)
const AutomationAgentTrigger = dynamic(
    () => import("@/components/copilot/automation-agent-trigger").then(mod => mod.AutomationAgentTrigger),
    { ssr: false }
)

function CombinedFAB() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [copilotOpen, setCopilotOpen] = useState(false)
    const [automationOpen, setAutomationOpen] = useState(false)
    const isAgentLoading = useCoPilotAgentStore((s) => s.isLoading)
    const agentMessageCount = useCoPilotAgentStore((s) => s.messages.length)

    const openCopilot = () => { setMenuOpen(false); setCopilotOpen(true) }
    const openAutomation = () => { setMenuOpen(false); setAutomationOpen(true) }

    return (
        <>
            <GlobalCopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
            <AutomationAgentTrigger open={automationOpen} onOpenChange={setAutomationOpen} />

            {/* Mini menu */}
            <AnimatePresence>
                {menuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMenuOpen(false)}
                        />
                        {/* Options */}
                        <motion.div
                            className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        >
                            <button
                                onClick={openAutomation}
                                className="flex items-center gap-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-colors"
                            >
                                <Bot className="h-4 w-4" />
                                Automation Agent
                                {agentMessageCount > 0 && !isAgentLoading && (
                                    <span className="ml-1 h-5 w-5 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                                        {agentMessageCount > 9 ? '9+' : agentMessageCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={openCopilot}
                                className="flex items-center gap-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-colors"
                            >
                                <Sparkles className="h-4 w-4" />
                                Outmate Copilot
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Combined FAB */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setMenuOpen(v => !v)}
                    className="relative h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-all duration-300 group"
                    title="Outmate AI"
                    aria-label="Open AI panel"
                >
                    {/* Pulse ring */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    />
                    {/* Agent running pulse */}
                    <AnimatePresence>
                        {isAgentLoading && (
                            <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                                exit={{ opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                                className="absolute inset-0 rounded-full border-2 border-violet-400 pointer-events-none"
                            />
                        )}
                    </AnimatePresence>
                    {/* Combined icon: Sparkles + small Bot badge */}
                    <Sparkles className="h-6 w-6 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-violet-600 border-2 border-background flex items-center justify-center z-10">
                        <Bot className="h-3 w-3 text-white" />
                    </span>
                </button>
            </div>
        </>
    )
}

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { sidebarCollapsed } = useStore()
    useNotifications()  // Connect SSE once for the whole session
    useAgentToast()     // Fire toasts on agent execution results

    return (
        <div
            className={cn(
                "flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out",
                sidebarCollapsed ? "lg:pl-16" : "lg:pl-64",
                "pl-0" // No padding on mobile
            )}
        >
            {children}
            <LeadCopilotPanel />
            <CombinedFAB />
        </div>
    )
}
