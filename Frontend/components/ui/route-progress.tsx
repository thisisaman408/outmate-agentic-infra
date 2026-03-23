"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { usePathname } from "next/navigation"

/**
 * Thin top-of-page progress bar that animates during Next.js route transitions.
 * Zero-dependency alternative to NProgress — uses only CSS transitions.
 */
export function RouteProgress() {
    const pathname = usePathname()
    const [progress, setProgress] = useState(0)
    const [visible, setVisible] = useState(false)
    const timer = useRef<NodeJS.Timeout | null>(null)
    const prevPath = useRef(pathname)

    const start = useCallback(() => {
        setVisible(true)
        setProgress(15)
        // Simulate incremental progress
        timer.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) {
                    if (timer.current) clearInterval(timer.current)
                    return 90
                }
                // Slow down as we get higher
                const inc = prev < 50 ? 8 : prev < 80 ? 3 : 1
                return Math.min(prev + inc, 90)
            })
        }, 200)
    }, [])

    const finish = useCallback(() => {
        if (timer.current) clearInterval(timer.current)
        setProgress(100)
        setTimeout(() => {
            setVisible(false)
            setProgress(0)
        }, 300)
    }, [])

    useEffect(() => {
        if (pathname !== prevPath.current) {
            start()
            // On Next.js App Router, the pathname changes when the new route
            // is ready, so we immediately finish after a tiny delay
            const t = setTimeout(finish, 150)
            prevPath.current = pathname
            return () => clearTimeout(t)
        }
    }, [pathname, start, finish])

    if (!visible && progress === 0) return null

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
        >
            <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                style={{
                    width: `${progress}%`,
                    transition: progress === 0
                        ? "none"
                        : progress === 100
                            ? "width 200ms ease-out"
                            : "width 400ms ease",
                    boxShadow: "0 0 10px rgba(99, 102, 241, 0.5), 0 0 5px rgba(99, 102, 241, 0.3)",
                }}
            />
        </div>
    )
}
