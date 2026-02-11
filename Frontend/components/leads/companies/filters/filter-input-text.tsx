"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface FilterInputTextProps {
    placeholder?: string
    value?: string
    onChange: (value: string) => void
}

export function FilterInputText({
    placeholder = "Search...",
    value = "",
    onChange
}: FilterInputTextProps) {
    return (
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-8 h-9 text-sm bg-background/50 focus-visible:ring-primary/20"
            />
        </div>
    )
}
