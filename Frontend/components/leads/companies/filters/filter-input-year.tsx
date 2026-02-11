"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface FilterInputYearProps {
    value?: string
    onChange: (value: string) => void
    placeholder?: string
}

export function FilterInputYear({
    value = "",
    onChange,
    placeholder = "Type year (e.g. 2023)..."
}: FilterInputYearProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Only allow numbers and max 4 digits
        if (/^\d{0,4}$/.test(val)) {
            onChange(val)
        }
    }

    const clear = () => onChange("")

    return (
        <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                className="pl-8 pr-8"
                type="text"
                inputMode="numeric"
            />
            {value && (
                <Button
                    variant="ghost"
                    onClick={clear}
                    className="absolute right-0 top-0 h-full px-2 py-0 hover:bg-transparent"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Clear</span>
                </Button>
            )}
        </div>
    )
}
