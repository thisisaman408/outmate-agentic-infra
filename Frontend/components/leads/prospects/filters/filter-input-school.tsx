"use client"

import * as React from "react"
import { Check, Loader2, Search, X } from "lucide-react"

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

interface FilterInputSchoolProps {
    value?: string[]
    onChange: (value: string[] | undefined) => void
    placeholder?: string
}

export function FilterInputSchool({
    value = [],
    onChange,
    placeholder = "Search schools..."
}: FilterInputSchoolProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [options, setOptions] = React.useState<string[]>([])
    const [loading, setLoading] = React.useState(false)

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
            const response = await fetch('/api/school-search', {
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
            console.error("Failed to fetch school options", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelect = (school: string) => {
        const newValue = value.includes(school)
            ? value.filter((item) => item !== school)
            : [...value, school]

        onChange(newValue.length > 0 ? newValue : undefined)
    }

    const removeValue = (valToRemove: string) => {
        const newValue = value.filter(val => val !== valToRemove)
        onChange(newValue.length > 0 ? newValue : undefined)
    }

    return (
        <div className="space-y-3">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {value.map((val) => (
                        <Badge key={val} variant="secondary" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {val}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/20 p-0.5"
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={() => removeValue(val)}
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
                            {!loading && options.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => handleSelect(option)}
                                >
                                    <div
                                        className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            value.includes(option)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                        )}
                                    >
                                        <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <span>{option}</span>
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
