"use client"

import { Bell, Search, ChevronDown, Settings, Building2 } from "lucide-react"
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
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { AuthModal } from "@/components/auth/auth-modal"
import { useState, useEffect } from "react"

export function Header() {
  const { user, logout } = useStore()
  const router = useRouter()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<"login" | "signup">("login")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use the mounted check from visitor-tracker to handle SSR
  if (!mounted) return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/95 px-6">
      <div className="flex-1 max-w-md">
        <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    </header>
  )

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/50 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 px-6">
        {/* Search - Left aligned */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads, campaigns, signals..."
              className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Actions - Right aligned */}
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
            <Bell className="h-[1.1rem] w-[1.1rem]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>

          {mounted && user ? (
            // User Menu for authenticated users
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-3 h-10 px-3 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/50 transition-all">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-xs tracking-tighter">
                      {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start text-left min-w-0">
                    <span className="text-sm font-semibold truncate leading-none mb-1">
                      {user?.name || "Member"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 truncate leading-none uppercase tracking-wider font-medium">
                      {user?.plan || "Free"} Plan
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border/40">
                <div className="flex items-center gap-3 p-2 mb-2 bg-muted/40 rounded-md">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-base font-bold">
                       {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate">{user?.name || "User"}</span>
                    <span className="text-xs text-muted-foreground truncate italic">{user?.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator className="-mx-2 mb-1 opacity-50" />
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5">
                  Management
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push("/settings")} className="rounded-md gap-2 cursor-pointer">
                  <Settings className="h-4 w-4 opacity-70" /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings/workspace")} className="rounded-md gap-2 cursor-pointer">
                  <Building2 className="h-4 w-4 opacity-70" /> {user?.workspace || "Main Workspace"}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="-mx-2 mt-1 mb-1 opacity-50" />
                <DropdownMenuItem onClick={handleLogout} className="rounded-md gap-2 cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Auth buttons for non-authenticated users
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={openSignIn} className="h-9 rounded-lg">
                Sign In
              </Button>
              <Button onClick={openSignUp} className="h-9 rounded-lg shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
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
