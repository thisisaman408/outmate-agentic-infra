"use client"

import * as React from "react"
import { Check, ChevronsUpDown, DollarSign } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Label } from "@/components/ui/label"

export interface RevenueValue {
    min?: number
    max?: number
    currency: string
}

interface FilterRevenueProps {
    value?: RevenueValue
    onChange: (value: RevenueValue) => void
}

const CURRENCIES = [
    "USD", "AED", "AUD", "BRL", "CAD", "CNY", "DKK", "EUR", "GBP", "HKD",
    "IDR", "ILS", "INR", "JPY", "NOK", "NZD", "RUB", "SEK", "SGD", "THB",
    "TRY", "TWD"
]

export function FilterRevenue({
    value = { currency: "USD" },
    onChange,
}: FilterRevenueProps) {
    const [openCurrency, setOpenCurrency] = React.useState(false)

    const handleCurrencyChange = (currency: string) => {
        onChange({ ...value, currency })
        setOpenCurrency(false)
    }

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        onChange({ ...value, min: val ? Number(val) : undefined })
    }

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        onChange({ ...value, max: val ? Number(val) : undefined })
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Currency</Label>
                <Popover open={openCurrency} onOpenChange={setOpenCurrency}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCurrency}
                            className="w-full justify-between font-normal"
                        >
                            {value.currency}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Search currency..." />
                            <CommandList>
                                <CommandEmpty>No currency found.</CommandEmpty>
                                <CommandGroup>
                                    {CURRENCIES.map((currency) => (
                                        <CommandItem
                                            key={currency}
                                            value={currency}
                                            onSelect={() => handleCurrencyChange(currency)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value.currency === currency ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {currency}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Min (Millions)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={value.min ?? ""}
                            onChange={handleMinChange}
                            className="pl-7 h-8 text-sm"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Max (Millions)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            type="number"
                            min="0"
                            placeholder="Any"
                            value={value.max ?? ""}
                            onChange={handleMaxChange}
                            className="pl-7 h-8 text-sm"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
