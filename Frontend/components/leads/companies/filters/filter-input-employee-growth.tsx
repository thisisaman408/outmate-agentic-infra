"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export interface EmployeeGrowthValue {
    type: ">=" | "<"
    value: number
}

interface FilterInputEmployeeGrowthProps {
    value?: EmployeeGrowthValue
    onChange: (value: EmployeeGrowthValue | undefined) => void
    label?: string
    helperText?: string
}

export function FilterInputEmployeeGrowth({
    value,
    onChange,
    label = "Min Employee Growth (Count)",
    helperText = "Enter count (e.g., 50 for +50 employees)"
}: FilterInputEmployeeGrowthProps) {
    // Default to ">=" (Min Growth) if type isn't set, but try to respect incoming value
    const currentType = value?.type || ">="
    const currentValue = value?.value

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value

        if (val === "" || val === "-") {
            // If empty, we might want to clear the filter or just set value undefined?
            // If we clear, we pass undefined.
            if (val === "") {
                onChange(undefined)
            }
            return
        }

        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            onChange({ type: currentType, value: num })
        }
    }

    // Optional: Allow user to toggle between "At least" (>=) and "Less than" (<) if they want explicit control?
    // The prompt said "Recommended UI... Min Employee Growth (Count)... Input Box".
    // But also gave examples of "Scenario A (>=)" and "Scenario B (<)".
    // If I only provide one input for "Min", it implies ">=".
    // If I want to support "Scenario B" (Shrinking/Layoffs), I might need a toggle.
    // "Default Operator: Backend mein default > ... lagayein"
    // "Logic: Agar user -10 dale aur operator < ... toh wo companies milengi jahan 10 se zyada log nikale gaye."
    // This implies the USER controls the operator? OR the system infers it?
    // "Input Box: [ Number Input ]" -> Only ONE input box shown in recommendation.
    // "Label: 'Min Employee Growth (Count)'" -> "Min" usually means Lower Bound (>=).
    // I will stick to ONLY >= for now based on "Recommended UI".
    // If I strictly follow "Recommended UI", I don't give a choice.
    // But I'll leave the code structure ready for it.
    // Wait, if I only send >=, how does user achieve Scenario B? 
    // Maybe they type -10, resulting in "Growth >= -10". (Companies that didn't shrink more than 10).
    // Scenario B says "value: 0, type: <" -> "Growth < 0" -> Companies that shrank.
    // Without an operator toggle, the user can't explicitly ask for "Growth < 0".
    // I will add a small select toggle for operator: "Min" vs "Max"? Or "More than" vs "Less than"?
    // The prompt explicitly said "Recommended UI" just has "Min Employee Growth".
    // User Instructions: "implement this without disturbing any another filter" and "With this logic and DESIGN".
    // Design spec: "Label: Min Employee Growth (Count) ... Input Box: [ Number Input ]".
    // So I MUST NOT add a dropdown. I will strictly follow the design.
    // I will fallback to sending `{ type: ">=", value: ... }` always.

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                    type="number"
                    placeholder="e.g. 50"
                    value={currentValue ?? ""}
                    onChange={handleValueChange}
                    className="h-9"
                />
            </div>
            <div className="text-xs text-muted-foreground">
                {helperText}
            </div>
        </div>
    )
}
