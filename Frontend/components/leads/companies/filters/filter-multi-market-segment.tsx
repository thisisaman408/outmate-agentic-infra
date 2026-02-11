"use client"

import * as React from "react"
import { Check, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import MARKETS from "@/input_data/markets_segment.json"

interface FilterMultiMarketSegmentProps {
    placeholder?: string
    // Value is an array of selected market segment strings
    value?: string[]
    onChange: (value: string[]) => void
}

export function FilterMultiMarketSegment({
    placeholder = "Search market segments...",
    value = [],
    onChange,
}: FilterMultiMarketSegmentProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    // Memoize the filtering
    const filteredMarkets = React.useMemo(() => {
        if (!query) return MARKETS.slice(0, 50)

        const lowerQuery = query.toLowerCase()
        return MARKETS
            .filter(market => market.toLowerCase().includes(lowerQuery))
            .slice(0, 50)
    }, [query])

    const handleSelect = (market: string) => {
        const isSelected = value.includes(market)
        let newValue: string[]

        if (isSelected) {
            newValue = value.filter(v => v !== market)
        } else {
            newValue = [...value, market]
        }

        onChange(newValue)
    }

    const removeOption = (market: string) => {
        const newValue = value.filter(v => v !== market)
        onChange(newValue)
    }

    return (
        <div className="space-y-3">
            {/* Selected Tags Area */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {value.map(market => (
                        <Badge key={market} variant="secondary" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {market}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/20 p-0.5"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={() => removeOption(market)}
                            >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove</span>
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
                        className="w-full justify-between bg-background/50 font-normal text-muted-foreground hover:text-foreground border-dashed h-10"
                    >
                        <span className="truncate">
                            {placeholder}
                        </span>
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Type to search markets..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <CommandList>
                            {filteredMarkets.length === 0 && (
                                <CommandEmpty>No market segments found.</CommandEmpty>
                            )}

                            {filteredMarkets.map((market) => {
                                const isSelected = value.includes(market)
                                return (
                                    <CommandItem
                                        key={market}
                                        value={market}
                                        onSelect={() => handleSelect(market)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{market}</span>
                                    </CommandItem>
                                )
                            })}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
