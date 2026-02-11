"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"

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
import hqCountries from "@/lib/data/hq-countries.json"

interface FilterAutocompleteProps {
    placeholder?: string
    value?: string
    onChange: (value: string) => void
    field: string // e.g., 'hq_location'
}

interface FilterOption {
    label: string
    value: string
}

export function FilterAutocomplete({
    placeholder = "Search...",
    value,
    onChange,
    field
}: FilterAutocompleteProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [options, setOptions] = React.useState<FilterOption[]>([])
    const [loading, setLoading] = React.useState(false)

    // Helper to get display label for the current selected value
    const getDisplayValue = React.useMemo(() => {
        if (!value) return null
        if (field === 'hq_location') {
            const country = hqCountries.find(c => c.iso_alpha3 === value)
            return country ? country.name : value
        }
        return value
    }, [value, field])

    // Debounce the query to avoid hitting API on every keystroke
    React.useEffect(() => {
        const timer = setTimeout(() => {
            fetchSuggestions(query)
        }, 300)

        return () => clearTimeout(timer)
    }, [query, field])

    const fetchSuggestions = async (search: string) => {
        setLoading(true)
        try {
            if (field === 'hq_location') {
                // Local search for countries
                if (!search) {
                    // Show some initial popular countries or just the first few? 
                    // Or maybe nothing until typed? Let's show first 10 if empty to be helpful
                    const initial = hqCountries.slice(0, 10).map(c => ({
                        label: c.name,
                        value: c.iso_alpha3
                    }))
                    setOptions(initial)
                } else {
                    const searchLower = search.toLowerCase()
                    const filtered = hqCountries
                        .filter(c => c.name.toLowerCase().includes(searchLower))
                        .slice(0, 20) // Limit results
                        .map(c => ({
                            label: c.name,
                            value: c.iso_alpha3
                        }))
                    setOptions(filtered)
                }
            } else {
                // API search for other fields
                if (search.length <= 1) {
                    setOptions([])
                    setLoading(false)
                    return
                }

                const response = await fetch('/api/proxy/autocomplete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        field: field,
                        query: search,
                        limit: 10
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    const suggestions: string[] = Array.isArray(data) ? data : (data.matches || data.values || [])
                    setOptions(suggestions.map(s => ({ label: s, value: s })))
                }
            }
        } catch (error) {
            console.error("Failed to fetch autocomplete options", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-background/50 font-normal text-muted-foreground hover:text-foreground border-dashed"
                >
                    {value ? getDisplayValue : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={placeholder}
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
                        {!loading && options.length === 0 && (
                            <CommandEmpty>No results found.</CommandEmpty>
                        )}
                        {!loading && options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={option.label} // Value here is mainly for cmdk internal usage if filtering, but we disabled it. 
                                // Actually, it's better to use label for accessibility text matching if needed.
                                onSelect={() => {
                                    onChange(option.value === value ? "" : option.value)
                                    setOpen(false)
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {option.label}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
