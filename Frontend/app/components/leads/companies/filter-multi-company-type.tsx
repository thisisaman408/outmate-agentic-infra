"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Props {
  value?: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export function FilterMultiCompanyType({ value, onChange, placeholder }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Company Type</Label>
      <Select value={value?.join(',') || ""} onValueChange={(newValue: string) => onChange(newValue ? newValue.split(',') : [])}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || "Select company types"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Software">Software</SelectItem>
          <SelectItem value="SaaS">SaaS</SelectItem>
          <SelectItem value="E-commerce">E-commerce</SelectItem>
          <SelectItem value="Marketplace">Marketplace</SelectItem>
          <SelectItem value="B2B">B2B</SelectItem>
          <SelectItem value="B2C">B2C</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
