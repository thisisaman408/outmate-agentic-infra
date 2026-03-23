"use client"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Reusable page-level loading skeleton for dashboard routes.
 * Shows a consistent loading pattern: header area + stat cards + table/content.
 */
export function PageSkeleton({ variant = "table" }: { variant?: "table" | "cards" | "minimal" }) {
    return (
        <div className="space-y-6 animate-in fade-in-0 duration-200">
            {/* Page title skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-2 w-full" />
                    </div>
                ))}
            </div>

            {variant === "table" && (
                <>
                    {/* Toolbar */}
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-64 rounded-lg" />
                        <Skeleton className="h-9 w-20 rounded-lg" />
                        <Skeleton className="h-9 w-20 rounded-lg" />
                        <div className="flex-1" />
                        <Skeleton className="h-9 w-24 rounded-lg" />
                    </div>

                    {/* Table skeleton */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                        {/* Table header */}
                        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
                            {[120, 100, 80, 60, 100, 60].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                        {/* Table rows */}
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0" style={{ opacity: 1 - i * 0.08 }}>
                                <div className="flex items-center gap-3 flex-1">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-4" />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {variant === "cards" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-4" style={{ opacity: 1 - i * 0.1 }}>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="space-y-1.5 flex-1">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-20 w-full rounded-lg" />
                            <div className="flex gap-2">
                                <Skeleton className="h-7 w-16 rounded-full" />
                                <Skeleton className="h-7 w-20 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {variant === "minimal" && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
                    ))}
                </div>
            )}
        </div>
    )
}
