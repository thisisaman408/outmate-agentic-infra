"use client"

import * as React from "react"
import { X, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface FilterInputTagsProps {
    value?: string[]
    onChange: (value: string[] | undefined) => void
    placeholder?: string
}

export function FilterInputTags({
    value = [],
    onChange,
    placeholder = "Type and press Enter..."
}: FilterInputTagsProps) {
    const [inputValue, setInputValue] = React.useState("")

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            const trimmed = inputValue.trim()
            if (trimmed) {
                if (!value.includes(trimmed)) {
                    onChange([...value, trimmed])
                }
                setInputValue("")
            }
        }
    }

    const removeTag = (tagToRemove: string) => {
        const newValue = value.filter(tag => tag !== tagToRemove)
        onChange(newValue.length > 0 ? newValue : undefined)
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
                {value.map((tag) => (
                    <Badge key={tag} variant="secondary" className="mr-1 mb-1">
                        {tag}
                        <button
                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onClick={() => removeTag(tag)}
                        >
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-8 h-9 text-sm bg-background/50 focus-visible:ring-primary/20"
                />
            </div>
        </div>
    )
}
