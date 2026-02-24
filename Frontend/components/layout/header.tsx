"use client"

import { Bell, Search, ChevronDown } from "lucide-react"
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
    // Redirect to login removed
    window.location.reload() // Reload to reset state with mock user
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
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 px-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads, campaigns, signals..."
              className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
            <Bell className="h-[1.1rem] w-[1.1rem]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>

          {user ? (
            // User Menu for authenticated users
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2.5 h-10 px-3 rounded-lg hover:bg-accent">
                  <Avatar className="h-8 w-8 ring-2 ring-border/50">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium leading-tight">{user?.name || "User"}</span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      {user?.workspace || "Workspace"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings/workspace")}>Workspace</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Auth buttons for non-authenticated users
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={openSignIn} className="h-9 rounded-lg">
                Sign In
              </Button>
              <Button onClick={openSignUp} className="h-9 rounded-lg shadow-sm">
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </header>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authTab} />
    </>
  )
}
