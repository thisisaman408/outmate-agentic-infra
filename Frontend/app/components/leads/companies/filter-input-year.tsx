"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
}

export function FilterInputYear({ value, onChange, placeholder }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Year</Label>
      <Input
        type="number"
        min="1900"
        max="2024"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter year..."}
        className="w-full"
      />
    </div>
  )
}
