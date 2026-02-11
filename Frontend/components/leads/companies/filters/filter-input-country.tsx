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
import countriesData from "@/input_data/HQ_Country.json"

interface FilterInputCountryProps {
    value?: string
    onChange: (value: string) => void
    placeholder?: string
}

export function FilterInputCountry({
    value = "",
    onChange,
    placeholder = "Select country..."
}: FilterInputCountryProps) {
    const [open, setOpen] = React.useState(false)

    // Find selected country name for display
    const selectedCountry = React.useMemo(() =>
        countriesData.find((c) => c.iso_alpha3 === value),
        [value])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedCountry ? selectedCountry.name : <span className="text-muted-foreground">{placeholder}</span>}
                    {value ? (
                        <div
                            role="button"
                            tabIndex={0}
                            className="ml-auto p-1 hover:bg-muted rounded-full"
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange("")
                            }}
                        >
                            <X className="h-3 w-3 opacity-50" />
                        </div>
                    ) : (
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search country..." />
                    <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                            {countriesData.map((country) => (
                                <CommandItem
                                    key={country.iso_alpha3}
                                    value={country.name}
                                    onSelect={() => {
                                        onChange(country.iso_alpha3 === value ? "" : country.iso_alpha3)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === country.iso_alpha3 ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {country.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
