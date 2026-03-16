"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authService } from "@/lib/auth"
import { useStore } from "@/lib/store"
import { Loader2 } from "lucide-react"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isLoading, setIsLoading] = useState(true)
    const setUser = useStore((state) => state.setUser)

    useEffect(() => {
        const checkAuth = async () => {
            const user = authService.getCurrentUser()
            if (user) {
                setUser(user)
                // Link authenticated user to the tracking pixel
                if (typeof window !== 'undefined' && (window as any).outmate) {
                    (window as any).outmate.identify(user.email);
                }
            }
            setIsLoading(false)
        }

        checkAuth()
    }, [pathname, router, setUser])

    // Loading transition removed for immediate access
    return <>{children}</>
}
