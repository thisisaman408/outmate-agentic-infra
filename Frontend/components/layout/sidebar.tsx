"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Activity,
  Send,
  Bot,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Workflow,
  Target,
  ChevronDown,
  Building2,
  UserCircle,
  Clock,
  AlertCircle,
  CheckSquare,
  Radar,
  Globe,
  Eye,
  Sparkles,
  Cpu,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type NavItem = {
  name: string
  href: string
  icon: any
  external?: boolean
  children?: { name: string; href: string; icon?: any }[]
}

const AGENTIC_INFRA_URL = process.env.NEXT_PUBLIC_AGENTIC_URL || (process.env.NODE_ENV === "production" ? "https://outmate-agentic.greenbeach-bf0c913b.eastus.azurecontainerapps.io" : "http://localhost:7860")

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Visitors", href: "/visitors", icon: Users },
  { name: "AI-Powered Search", href: "/ai-powered-search", icon: Database },
  {
    name: "Leads",
    href: "/leads",
    icon: Users,
    children: [
      { name: "Companies", href: "/leads/companies", icon: Building2 },
      { name: "Prospects", href: "/leads/prospects", icon: UserCircle },
      { name: "Watcher", href: "/leads/watcher", icon: Eye },
      { name: "History", href: "/leads/history", icon: Clock },
    ],
  },
  {
    name: "Signals",
    href: "/signals",
    icon: Activity,
    children: [
      { name: "Overview", href: "/signals", icon: AlertCircle },
      { name: "Events", href: "/signals/events", icon: AlertCircle },
      { name: "Intents", href: "/signals/intent", icon: Target },
      { name: "Trackers", href: "/signals/tracker", icon: Radar },
      { name: "Websights", href: "/signals/websights", icon: Globe },
      { name: "Form Complete", href: "/signals/formcomplete", icon: CheckSquare },
    ],
  },
  { name: "Scoring", href: "/scoring", icon: Target },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "Co-Pilot", href: "/copilot", icon: Sparkles },
  { name: "AI Agents", href: "/ai-agents", icon: Bot },
  { name: "AI Agents Infra", href: AGENTIC_INFRA_URL, icon: Cpu, external: true },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed } = useStore()
  const [expandedItems, setExpandedItems] = useState<string[]>(["Leads", "Signals"])

  // Auto-expand if child is active
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => pathname === child.href)
        if (hasActiveChild && !expandedItems.includes(item.name)) {
          setExpandedItems((prev) => [...prev, item.name])
        }
      }
    })
  }, [pathname])

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.preventDefault()
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    )
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-base shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
                O
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">Outmate.ai</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center justify-center w-full group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-base shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
                O
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const isChildActive = item.children?.some((child) => pathname === child.href)
            const isExpanded = expandedItems.includes(item.name)
            const Icon = item.icon

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <div
                      onClick={(e) => !sidebarCollapsed && toggleExpand(item.name, e)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group cursor-pointer select-none",
                        isActive || isChildActive
                          ? "bg-sidebar-accent/50 text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        !sidebarCollapsed && "justify-start",
                        sidebarCollapsed && "justify-center",
                      )}
                    >
                      {isActive && !item.children && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                      )}

                      <Icon className={cn("h-5 w-5 shrink-0", (isActive || isChildActive) && "text-primary")} />

                      {!sidebarCollapsed && (
                        <>
                          <span className="tracking-tight flex-1">{item.name}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200",
                              isExpanded ? "rotate-180" : ""
                            )}
                          />
                        </>
                      )}

                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </div>

                    {/* Nested Items */}
                    <AnimatePresence>
                      {!sidebarCollapsed && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden bg-sidebar-accent/10 rounded-b-xl mb-1"
                        >
                          <div className="pl-4 pr-2 pb-2 pt-1 space-y-0.5">
                            {item.children.map((child) => {
                              const isChildActive = pathname === child.href
                              const ChildIcon = child.icon
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                    isChildActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                                  )}
                                >
                                  {ChildIcon && <ChildIcon className="h-4 w-4 shrink-0" />}
                                  <span>{child.name}</span>
                                </Link>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : item.external ? (
                  <a href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group",
                        "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        !sidebarCollapsed && "justify-start",
                        sidebarCollapsed && "justify-center",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="tracking-tight flex-1">{item.name}</span>
                      )}
                      {!sidebarCollapsed && (
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      )}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </div>
                  </a>
                ) : (
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        !sidebarCollapsed && "justify-start",
                        sidebarCollapsed && "justify-center",
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                      )}
                      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                      {!sidebarCollapsed && <span className="tracking-tight">{item.name}</span>}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full justify-center hover:bg-sidebar-accent rounded-xl h-9"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  )
}
