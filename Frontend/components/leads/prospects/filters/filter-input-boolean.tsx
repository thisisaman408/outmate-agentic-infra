"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface FilterInputBooleanProps {
    value?: boolean
    onChange: (value: boolean) => void
    label?: string
}

export function FilterInputBoolean({
    value = false,
    onChange,
    label
}: FilterInputBooleanProps) {
    return (
        <div className="flex items-center space-x-2">
            <Checkbox
                id="filter-boolean"
                checked={value}
                onCheckedChange={(checked: boolean | string) => onChange(checked === true)}
            />
            <Label htmlFor="filter-boolean" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {label || "Enabled"}
            </Label>
        </div>
    )
}
