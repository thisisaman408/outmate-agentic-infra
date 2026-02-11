"use client"

import * as React from "react"
import { Check, X, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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
import INVESTORS_DATA from "@/input_data/crunchbase_investors.json"

interface FilterInputInvestorsProps {
    value?: string[]
    onChange: (value: string[]) => void
    placeholder?: string
}

export function FilterInputInvestors({
    value = [],
    onChange,
    placeholder = "Search investors..."
}: FilterInputInvestorsProps) {
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const handleSelect = (currentValue: string) => {
        const isSelected = value.includes(currentValue)
        let newValue: string[]
        if (isSelected) {
            newValue = value.filter((v) => v !== currentValue)
        } else {
            newValue = [...value, currentValue]
        }
        onChange(newValue)
        // Keep open for multiple selection
    }

    const unselect = (v: string) => {
        onChange(value.filter((val) => val !== v))
    }

    // Filter logic: Command handles filtering automatically based on valid Search query vs Item value/label.
    // However, we want to allow selecting items.

    // Convert primitive string array to objects for easier mapping if needed, but strings are fine.

    return (
        <div className="flex flex-col gap-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                    {value.map((v) => (
                        <Badge key={v} variant="secondary" className="hover:bg-secondary/80">
                            {v}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={() => unselect(v)}
                            >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between hover:bg-muted/50"
                    >
                        <span className="text-muted-foreground font-normal overflow-hidden text-ellipsis whitespace-nowrap">
                            {placeholder}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search investors..." />
                        <CommandList>
                            <CommandEmpty>No investor found.</CommandEmpty>
                            <CommandGroup className="max-h-[200px] overflow-y-auto">
                                {INVESTORS_DATA.map((investor) => (
                                    <CommandItem
                                        key={investor}
                                        value={investor}
                                        onSelect={() => handleSelect(investor)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                value.includes(investor)
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{investor}</span>
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
