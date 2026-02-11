"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FilterInputDateProps {
    value?: string
    onChange: (value: string) => void
    placeholder?: string
}

export function FilterInputDate({
    value,
    onChange,
    placeholder = "Pick a date"
}: FilterInputDateProps) {
    // Parse initial value if present
    const initialDate = value ? new Date(value) : undefined
    const validInitial = initialDate && isValid(initialDate)

    const [year, setYear] = React.useState<string>(validInitial ? format(initialDate, "yyyy") : "")
    const [month, setMonth] = React.useState<string>(validInitial ? format(initialDate, "MM") : "")
    const [day, setDay] = React.useState<string>(validInitial ? format(initialDate, "dd") : "")

    // Update local state if external value changes
    React.useEffect(() => {
        if (value) {
            const d = new Date(value)
            if (isValid(d)) {
                setYear(format(d, "yyyy"))
                setMonth(format(d, "MM"))
                setDay(format(d, "dd"))
            }
        } else {
            // Only clear if the user hasn't typed anything yet, or strict sync? 
            // Better to respect prop update usually, but for local inputs it can be tricky.
            // Let's assume if value is cleared externally, we clear inputs.
            if (value === "") {
                setYear("")
                setMonth("")
                setDay("")
            }
        }
    }, [value])

    const validateAndUpdate = (y: string, m: string, d: string) => {
        // Basic length/numeric checks before trying to parse
        if (!y || !m || !d) {
            onChange("")
            return
        }

        const yNum = parseInt(y)
        const mNum = parseInt(m)
        const dNum = parseInt(d)

        if (isNaN(yNum) || isNaN(mNum) || isNaN(dNum)) {
            onChange("")
            return
        }

        // Construct date string yyyy-MM-dd
        const dateString = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        const parsedDate = parse(dateString, "yyyy-MM-dd", new Date())

        if (isValid(parsedDate)) {
            // Check if it matches inputs (to handle Feb 31 -> Mar 3 rollover cases if parse is too lenient)
            // date-fns parse might rollover, so we check formatting back
            if (format(parsedDate, "MM") !== m.padStart(2, '0') || format(parsedDate, "dd") !== d.padStart(2, '0')) {
                // Invalid date (e.g. Feb 30)
                onChange("")
                return
            }
            onChange(format(parsedDate, "yyyy-MM-dd"))
        } else {
            onChange("")
        }
    }

    const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
        setYear(val)
        validateAndUpdate(val, month, day)
    }

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 2)
        setMonth(val)
        validateAndUpdate(year, val, day)
    }

    const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 2)
        setDay(val)
        validateAndUpdate(year, month, val)
    }

    return (
        <div className="flex items-end gap-2 w-full">
            <div className="grid gap-1.5 flex-1">
                <Label className="text-xs text-muted-foreground">Year</Label>
                <Input
                    placeholder="YYYY"
                    value={year}
                    onChange={handleYearChange}
                    className="h-9 px-2 text-center"
                />
            </div>
            <div className="grid gap-1.5 w-[60px]">
                <Label className="text-xs text-muted-foreground">Month</Label>
                <Input
                    placeholder="MM"
                    value={month}
                    onChange={handleMonthChange}
                    className="h-9 px-2 text-center"
                />
            </div>
            <div className="grid gap-1.5 w-[60px]">
                <Label className="text-xs text-muted-foreground">Day</Label>
                <Input
                    placeholder="DD"
                    value={day}
                    onChange={handleDayChange}
                    className="h-9 px-2 text-center"
                />
            </div>
        </div>
    )
}
