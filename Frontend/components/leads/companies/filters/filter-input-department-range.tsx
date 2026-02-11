"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import DEPARTMENTS from "@/input_data/Department.json"

export interface DepartmentRangeValue {
    sub_filter?: string
    value?: {
        min?: number
        max?: number
    }
}

interface FilterInputDepartmentRangeProps {
    value?: DepartmentRangeValue
    onChange: (value: DepartmentRangeValue | undefined) => void
    mode?: "count" | "growth"
}

export function FilterInputDepartmentRange({
    value = {},
    onChange,
    mode = "count"
}: FilterInputDepartmentRangeProps) {

    const subFilter = value.sub_filter
    const minVal = value.value?.min
    const maxVal = value.value?.max

    const handleDepartmentChange = (dept: string) => {
        onChange({
            ...value,
            sub_filter: dept
        })
    }

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (val === "" || val === "-") {
            const newValue = { ...value.value, min: undefined }
            // Clean up empty object if needed, but keeping structure is fine
            onChange({ ...value, value: newValue })
            return
        }

        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            onChange({ ...value, value: { ...value.value, min: num } })
        }
    }

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (val === "" || val === "-") {
            const newValue = { ...value.value, max: undefined }
            onChange({ ...value, value: newValue })
            return
        }
        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            onChange({ ...value, value: { ...value.value, max: num } })
        }
    }

    const error = minVal !== undefined && maxVal !== undefined && minVal > maxVal
    const missingDepartment = (minVal !== undefined || maxVal !== undefined) && !subFilter

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Select Department</Label>
                <Select value={subFilter} onValueChange={handleDepartmentChange}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                                {dept}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <div className="grid gap-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">
                        {mode === "growth" ? "Min Growth %" : "Min Employees"}
                    </Label>
                    <Input
                        type="number"
                        placeholder={mode === "growth" ? "e.g. 20" : "e.g. 10"}
                        value={minVal ?? ""}
                        onChange={handleMinChange}
                        className="h-9"
                    />
                </div>
                <span className="pt-6 text-muted-foreground">to</span>
                <div className="grid gap-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">
                        {mode === "growth" ? "Max Growth %" : "Max Employees"}
                    </Label>
                    <Input
                        type="number"
                        placeholder={mode === "growth" ? "e.g. 100" : "e.g. 50"}
                        value={maxVal ?? ""}
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

            {missingDepartment && (
                <div className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Please select a department.
                </div>
            )}
        </div>
    )
}
