"use client"

import { Search, ChevronDown, Settings, Building2, Menu, Bell } from "lucide-react"
import { NotificationDropdown } from "@/components/copilot/notification-dropdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { useRouter, usePathname } from "next/navigation"
import { authService } from "@/lib/auth"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { AuthModal } from "@/components/auth/auth-modal"
import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const navPills = [
  { label: "Home", href: "/dashboard" },
  { label: "Agents", href: "/ai-agents" },
  { label: "Database", href: "/leads/companies" },
  { label: "Analytics", href: "/dashboard#analytics" },
]

export function Header() {
  const { user, logout, mobileSidebarOpen, setMobileSidebarOpen } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<"login" | "signup">("login")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/50 bg-background/95 px-6">
        <div className="flex-1 max-w-md">
          <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      </header>
    )
  }

  const handleLogout = async () => {
    await authService.logout()
    logout()
    router.push("/auth/login")
  }

  const openSignIn = () => {
    setAuthTab("login")
    setAuthModalOpen(true)
  }

  const openSignUp = () => {
    setAuthTab("signup")
    setAuthModalOpen(true)
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href))

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-card px-4 sm:px-6 gap-4">
        {/* Mobile Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Left: Nav Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {navPills.map((pill) => (
            <Link
              key={pill.href}
              href={pill.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap",
                isActive(pill.href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {pill.label}
            </Link>
          ))}
        </div>

        {/* Middle: Search (Optional, keeping it but making it more subtle) */}
        <div className="hidden md:flex flex-1 max-w-sm ml-4">
           <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Quick search..."
              className="pl-9 h-8 bg-muted/30 border-transparent focus:bg-background transition-colors w-full text-xs"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Credits Pill */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {user.credits?.toLocaleString() || "22,400"} credits
            </div>
          )}

          <ThemeToggle />

          {/* Notifications */}
          <NotificationDropdown />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 h-8 w-8 rounded-full border border-border/50 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all">
                  <Avatar className="h-full w-full">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 shadow-xl border-border/40">
                <div className="flex items-center gap-3 p-2 mb-2 bg-muted/20 rounded-md">
                   <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                   </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{user.name || "User"}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")} className="text-xs font-medium cursor-pointer rounded-md">
                  <Settings className="mr-2 h-3.5 w-3.5 opacity-60" /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings/workspace")} className="text-xs font-medium cursor-pointer rounded-md">
                  <Building2 className="mr-2 h-3.5 w-3.5 opacity-60" /> {user.workspace || "Main Workspace"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-xs font-bold text-destructive cursor-pointer rounded-md">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={openSignIn} className="h-8 px-3 text-xs font-bold">
                Sign In
              </Button>
              <Button onClick={openSignUp} className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </header>
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authTab} />
    </>
  )
}
