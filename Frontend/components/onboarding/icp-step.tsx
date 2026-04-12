"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ICPStepProps {
  title: string
  description: string
  options: string[]
  selected: string[]
  onSelect: (items: string[]) => void
  suggestions?: string[]
  searchPlaceholder?: string
}

export function ICPStep({
  title,
  description,
  options,
  selected,
  onSelect,
  suggestions = [],
  searchPlaceholder = "Search...",
}: ICPStepProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 100)
    const q = search.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 100)
  }, [options, search])

  const toggle = useCallback(
    (item: string) => {
      if (selected.includes(item)) {
        onSelect(selected.filter((s) => s !== item))
      } else {
        onSelect([...selected, item])
      }
    },
    [selected, onSelect],
  )

  const suggestionsNotSelected = suggestions.filter((s) => !selected.includes(s))

  return (
    <div className="bg-white rounded-xl border p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <h3 className="text-xl font-bold text-[#1e1b4b] mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>

      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selected.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors pr-1.5"
              onClick={() => toggle(item)}
            >
              <span className="font-bold flex items-center gap-1.5">{item} <X className="h-3 w-3" /></span>
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground self-center ml-1">
            {selected.length} selected
          </span>
        </div>
      )}

      {/* Suggested */}
      {suggestionsNotSelected.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggested</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestionsNotSelected.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                onClick={() => toggle(s)}
              >
                + {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-12 text-base font-bold text-slate-900 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400 bg-white"
        />
      </div>

      {/* Options list */}
      <ScrollArea className="h-[280px] border rounded-lg">
        <div className="p-2 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
          )}
          {filtered.map((option) => {
            const isChecked = selected.includes(option)
            return (
              <label
                key={option}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-gray-50 ${
                  isChecked ? "bg-indigo-50/50" : ""
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggle(option)}
                />
                <span className="text-sm font-bold text-slate-800">{option}</span>
              </label>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
