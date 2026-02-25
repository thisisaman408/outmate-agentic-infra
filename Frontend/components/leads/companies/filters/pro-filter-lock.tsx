"use client"

import { Button } from "@/components/ui/button"

interface ProFilterLockProps {
    label: string
    onUpgrade: () => void
}

export function ProFilterLock({ label, onUpgrade }: ProFilterLockProps) {
    return (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-sm text-foreground">{label}</p>
            <p className="text-[11px]">Advanced filter · Start a trial or upgrade to Outmate Pro to unlock this control.</p>
            <Button onClick={onUpgrade} size="sm" variant="ghost" className="w-full">Start trial / Upgrade</Button>
        </div>
    )
}
