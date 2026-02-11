"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"

export interface GrowthRangeValue {
    min?: number
    max?: number
}

interface FilterInputGrowthRangeProps {
    value?: GrowthRangeValue
    onChange: (value: GrowthRangeValue) => void
}

export function FilterInputGrowthRange({
    value = {},
    onChange,
}: FilterInputGrowthRangeProps) {

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Allow negative numbers and empty string
        if (val === "" || val === "-") {
            onChange({ ...value, min: undefined }) // Or keep as partial string if we want manual typing ease, but props say number
            return
        }

        // Parse int
        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            onChange({ ...value, min: num })
        }
    }

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (val === "" || val === "-") {
            onChange({ ...value, max: undefined })
            return
        }
        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            onChange({ ...value, max: num })
        }
    }

    const error = value.min !== undefined && value.max !== undefined && value.min > value.max

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
                <span>Growth Rate (%)</span>
            </div>

            <div className="flex items-center gap-2">
                <div className="grid gap-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">Min %</Label>
                    <Input
                        type="number"
                        placeholder="e.g. 10"
                        value={value.min ?? ""}
                        onChange={handleMinChange}
                        className="h-9"
                    />
                </div>
                <span className="pt-6 text-muted-foreground">-</span>
                <div className="grid gap-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">Max %</Label>
                    <Input
                        type="number"
                        placeholder="e.g. 100"
                        value={value.max ?? ""}
                        onChange={handleMaxChange}
                        className="h-9"
                    />
                </div>
            </div>

            {error && (
                <div className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Min value must be less than Max value.
                </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
                <p>Enter 20 for 20% growth.</p>
                <p>Use negative numbers (e.g., -10) to find shrinking companies.</p>
            </div>
        </div>
    )
}
