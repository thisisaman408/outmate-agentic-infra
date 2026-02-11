"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import industryData from "@/input_data/linkdin_industry.json"

interface FilterInputIndustryProps {
    value?: string[]
    onChange: (value: string[] | undefined) => void
    placeholder?: string
}

export function FilterInputIndustry({
    value = [],
    onChange,
    placeholder = "Select industries..."
}: FilterInputIndustryProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // industryData is likely an array of strings based on typical pattern, 
    // but let's cast it safely or assuming it matches the json structure.
    const allIndustries = industryData as string[]

    const filteredIndustries = React.useMemo(() => {
        if (!search) return allIndustries.slice(0, 50) // Limit initial view
        return allIndustries.filter(item =>
            item.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 50)
    }, [search, allIndustries])

    const handleSelect = (currentValue: string) => {
        const newValue = value.includes(currentValue)
            ? value.filter((item) => item !== currentValue)
            : [...value, currentValue]

        onChange(newValue.length > 0 ? newValue : undefined)
    }

    const removeValue = (valToRemove: string) => {
        const newValue = value.filter(val => val !== valToRemove)
        onChange(newValue.length > 0 ? newValue : undefined)
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
                {value.map((val) => (
                    <Badge key={val} variant="secondary" className="mr-1 mb-1">
                        {val}
                        <button
                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    removeValue(val)
                                }
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                            }}
                            onClick={() => removeValue(val)}
                        >
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                    </Badge>
                ))}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-9 text-sm"
                    >
                        {value.length > 0 ? `${value.length} selected` : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Search industries..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            <CommandEmpty>No industry found.</CommandEmpty>
                            <CommandGroup>
                                {filteredIndustries.map((item) => (
                                    <CommandItem
                                        key={item}
                                        value={item}
                                        onSelect={() => handleSelect(item)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value.includes(item) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {item}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
