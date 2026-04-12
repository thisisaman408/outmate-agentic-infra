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
            try {
                // First check if we have a token at all
                const token = authService.getToken()
                if (!token) {
                    if (!pathname.startsWith('/auth')) {
                        router.push('/auth/login')
                    }
                    setIsLoading(false)
                    return
                }

                // Verify the token with the backend
                const user = await authService.getMe()
                setUser(user)
                
                // Link authenticated user to the tracking pixel
                if (typeof window !== 'undefined' && (window as any).outmate) {
                    (window as any).outmate.identify(user.email);
                }
                
                // Onboarding redirect logic
                if (!user.onboarding_completed && !pathname.startsWith('/onboarding') && !pathname.startsWith('/auth')) {
                    router.push('/onboarding')
                }
            } catch (err) {
                console.error("Auth verification failed:", err)
                if (!pathname.startsWith('/auth')) {
                    router.push('/auth/login')
                }
            }
            setIsLoading(false)
        }

        checkAuth()
    }, [pathname, router, setUser])

    // Loading transition removed for immediate access
    return <>{children}</>
}
