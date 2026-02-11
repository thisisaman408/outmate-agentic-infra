"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react"

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

interface LocationOption {
    label: string
    value: string
    type: 'country' | 'region'
}

interface FilterMultiLocationProps {
    placeholder?: string
    // Value is an array of selected location strings (IDs or ISO codes)
    value?: string[]
    // onChange receives the new array
    onChange: (value: string[]) => void
}

export function FilterMultiLocation({
    placeholder = "Search country, city, region...",
    value = [],
    onChange,
}: FilterMultiLocationProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [options, setOptions] = React.useState<LocationOption[]>([])
    const [loading, setLoading] = React.useState(false)

    // Store full option objects for selected items to display labels correctly
    // Initialize with empty, but in a real app you might need to fetch labels for initial ID values
    const [selectedOptions, setSelectedOptions] = React.useState<LocationOption[]>([])

    // Sync selectedOptions with external value prop if needed
    // (Simplification: we assume for now the user starts empty or we only track additions locally)
    // If value comes from URL/parent and we don't have the labels, we might show IDs. 
    // To fix this properly, the parent should pass objects or we'd need a lookup API.
    // For this implementation, we'll rely on the user adding items via this component.

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 1) {
                fetchSuggestions(query)
            } else {
                setOptions([])
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const fetchSuggestions = async (search: string) => {
        setLoading(true)
        try {
            const response = await fetch('/api/location-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: search,
                    limit: 50
                })
            })

            if (response.ok) {
                const data = await response.json()
                setOptions(data)
            }
        } catch (error) {
            console.error("Failed to fetch location options", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelect = (option: LocationOption) => {
        // Check if already selected
        const isSelected = value.includes(option.value)

        let newValue: string[]
        let newSelectedOptions: LocationOption[]

        if (isSelected) {
            // Remove
            newValue = value.filter(v => v !== option.value)
            newSelectedOptions = selectedOptions.filter(o => o.value !== option.value)
        } else {
            // Add
            newValue = [...value, option.value]
            newSelectedOptions = [...selectedOptions, option]
        }

        onChange(newValue)
        setSelectedOptions(newSelectedOptions)
        // Keep open for multiple selection
        // setOpen(false) 
        setQuery("") // Clear query after selection? Optional.
    }

    const removeOption = (optionValue: string) => {
        const newValue = value.filter(v => v !== optionValue)
        const newSelectedOptions = selectedOptions.filter(o => o.value !== optionValue)
        onChange(newValue)
        setSelectedOptions(newSelectedOptions)
    }

    return (
        <div className="space-y-3">
            {/* Selected Tags Area */}
            {selectedOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedOptions.map(option => (
                        <Badge key={option.value} variant="secondary" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {option.label}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/20 p-0.5"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={() => removeOption(option.value)}
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
                                placeholder="Type to search..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <CommandList>
                            {loading && (
                                <div className="py-6 text-center text-sm text-muted-foreground flex justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Searching...
                                </div>
                            )}
                            {!loading && options.length === 0 && query.length > 1 && (
                                <CommandEmpty>No results found.</CommandEmpty>
                            )}
                            {!loading && options.length === 0 && query.length <= 1 && (
                                <div className="py-2.5 text-center text-sm text-muted-foreground">
                                    Type at least 2 characters...
                                </div>
                            )}
                            {!loading && options.map((option) => {
                                const isSelected = value.includes(option.value)
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label} // Used for display mainly
                                        onSelect={() => handleSelect(option)}
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
                                        <div className="flex flex-col">
                                            <span>{option.label}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{option.type}</span>
                                        </div>
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
