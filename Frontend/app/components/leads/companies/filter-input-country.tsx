"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
}

export function FilterInputCountry({ value, onChange, placeholder }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Country</Label>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter country..."}
        className="w-full"
      />
    </div>
  )
}
