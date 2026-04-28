"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home,
  Eye,
  Building2,
  Users,
  Sparkles,
  GitBranch,
  BookOpen,
  Share2,
  BarChart3,
  Plug,
  Settings,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
  Radio,
  DollarSign,
  UserPlus,
  Phone,
  ListTree,
  Bot,
  Target,
  Bell,
  Cpu,
  ExternalLink,
  Radar,
  Zap,
  Database,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

type NavItem = {
  name: string
  href: string
  icon: any
  badge?: string
  badgeColor?: string
  external?: boolean
  children?: { name: string; href: string; icon?: any }[]
}

type NavSection = {
  label: string
  items: NavItem[]
}

const AGENTIC_INFRA_URL =
  process.env.NEXT_PUBLIC_AGENTIC_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:7860")

const sections: NavSection[] = [
  {
    label: "Website Visitors",
    items: [
      { name: "Website Visitors", href: "/visitors", icon: Eye, badge: "Live", badgeColor: "green" },
    ],
  },
  {
    label: "Copilot",
    items: [
      { name: "Copilot", href: "/copilot", icon: Sparkles, badge: "AI", badgeColor: "indigo" },
    ],
  },
  {
    label: "Database",
    items: [
      { name: "Database", href: "/database", icon: Database, badge: "New", badgeColor: "green" },
      { name: "Companies", href: "/leads/companies", icon: Building2 },
      { name: "People", href: "/leads/prospects", icon: Users },
      { name: "History", href: "/leads/history", icon: Clock },
      
    ],
  },
  {
    label: "Execution",
    items: [
      ...(AGENTIC_INFRA_URL
        ? [{ name: "AI Agents Infra", href: AGENTIC_INFRA_URL, icon: Cpu, external: true } as NavItem]
        : []),
      { name: "Social Agent", href: "/social-agent", icon: Share2, badge: "New", badgeColor: "green" },
      { name: "Voice AI Agent", href: "/voice-agent", icon: Phone, badge: "AI", badgeColor: "indigo" },
      { name: "Intent Signals", href: "/signals", icon: Radar },
      { name: "Watchers", href: "/leads/watcher", icon: Bell, badge: "AI", badgeColor: "indigo" },
      { name: "Campaigns", href: "/campaigns", icon: GitBranch },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Integrations", href: "/integrations", icon: Plug },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
]


export function Sidebar() {
  const pathname = usePathname()
  const { user, sidebarCollapsed, setSidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useStore()
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({ "Website Visitors": true })

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const toggleItem = (label: string) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // Auto-expand if child is active
  useEffect(() => {
    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some((child) => pathname === child.href)
          if (hasActiveChild && !expandedItems[item.name]) {
            setExpandedItems((prev) => ({ ...prev, [item.name]: true }))
          }
        }
      })
    })
  }, [pathname])

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname, setMobileSidebarOpen])

  const isActive = (path: string) =>
    pathname === path || (path === "/dashboard" && pathname === "/") || (path !== "/" && pathname.startsWith(path + "/"))

  const renderItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.href)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems[item.name] ?? false
    const Icon = item.icon

    const linkContent = (
      <div key={item.href}>
        <div className="flex items-center">
          {item.external ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group relative flex-1 flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                sidebarCollapsed ? "justify-center px-2 py-2" : `px-3 py-[7px] ${depth > 0 ? "pl-9" : ""}`,
                "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-[15px] h-[15px] shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              {!sidebarCollapsed && <ExternalLink className="ml-auto w-3 h-3 opacity-50" />}
            </a>
          ) : (
            <Link
              href={item.href}
              className={cn(
                "group relative flex-1 flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                sidebarCollapsed ? "justify-center px-2 py-2" : `px-3 py-[7px] ${depth > 0 ? "pl-9" : ""}`,
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              {active && !sidebarCollapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
              )}
              <Icon className={cn("w-[15px] h-[15px] shrink-0", active ? "text-primary" : "")} />
              {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              {!sidebarCollapsed && item.badge && (
                <span
                  className={cn(
                    "ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                    item.badgeColor === "green"
                      ? "bg-green-500/15 text-green-500"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )}
          {!sidebarCollapsed && hasChildren && (
            <button
              onClick={() => toggleItem(item.name)}
              className="p-1 mr-1 rounded hover:bg-muted text-muted-foreground/50"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>
        {!sidebarCollapsed && hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => renderItem({ ...child, name: child.name, icon: child.icon || Icon }, depth + 1))}
          </div>
        )}
      </div>
    )

    if (sidebarCollapsed && !hasChildren) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.name}
          </TooltipContent>
        </Tooltip>
      )
    }

    return linkContent
  }

  const renderSection = (section: NavSection, index: number) => {
    const isCollapsedSection = collapsedSections[section.label] ?? false

    return (
      <div key={section.label} className={index > 0 ? "mt-1" : ""}>
        {!sidebarCollapsed ? (
          <button
            onClick={() => toggleSection(section.label)}
            className="w-full flex items-center justify-between px-3 py-1.5 group cursor-pointer"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              {section.label}
            </span>
            <ChevronDown
              className={cn(
                "w-3 h-3 text-muted-foreground/40 transition-transform duration-200",
                isCollapsedSection ? "-rotate-90" : ""
              )}
            />
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-2">
                <span className="w-5 h-[1px] bg-border rounded" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {section.label}
            </TooltipContent>
          </Tooltip>
        )}
        {!isCollapsedSection && (
          <div className={cn("space-y-0.5", sidebarCollapsed ? "px-1.5" : "px-2")}>
            {section.items.map((item) => renderItem(item))}
          </div>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      {/* Backdrop for mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden h-full w-full"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:translate-x-0 flex flex-col",
          sidebarCollapsed ? "lg:w-[60px]" : "lg:w-[220px]",
          mobileSidebarOpen ? "translate-x-0 w-[240px] shadow-2xl" : "-translate-x-full",
        )}
      >
        {/* Logo Section */}
        <div className={cn("border-b border-sidebar-border px-3 py-3", sidebarCollapsed && "px-2")}>
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-2.5 px-1")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              O
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">Outmate</div>
                <div className="text-[10px] text-muted-foreground/60">GTM Operating System</div>
              </div>
            )}
          </div>
          <div className={cn("mt-2", sidebarCollapsed ? "px-0" : "")}>
            {renderItem({ name: "Home", href: "/dashboard", icon: Home })}
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 no-scrollbar">
          {sections.map((section, idx) => renderSection(section, idx))}
        </div>

        {/* Footer Section */}
        <div className="border-t border-sidebar-border p-3 space-y-2.5">
          {!sidebarCollapsed && (
            <>
              <div className="px-1">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground/60 font-bold">Credits</span>
                  <span className="font-bold text-muted-foreground">
                    {user?.credits?.toLocaleString() || "22,400"} / {user?.plan === 'pro' ? '100,000' : '30,000'}
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all" 
                    style={{ width: `${Math.min(((user?.credits || 22400) / (user?.plan === 'pro' ? 100000 : 30000)) * 100, 100)}%` }} 
                  />
                </div>
              </div>
              <Button 
                variant="default"
                size="sm"
                className="w-full h-8 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => window.location.href = '/settings'}
              >
                Upgrade Plan
              </Button>
            </>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 transition-colors"
          >
            {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span className="text-[11px] font-bold ml-2">Collapse</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
