"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Inline constants to avoid import issues
// Mock constants
const ALL_FILTERS = {
  industry: {
    type: "select",
    label: "Industry",
    options: [
      "Software Development",
      "Information Technology", 
      "Financial Services",
      "Healthcare",
      "Manufacturing",
      "Retail",
      "Consulting",
      "Education"
    ]
  },
  company_size: {
    type: "range",
    label: "Company Size",
    min: 1,
    max: 10000,
    step: 100,
    unit: "employees"
  },
  revenue: {
    type: "select",
    label: "Revenue Range",
    options: [
      "< $1M",
      "$1M - $10M",
      "$10M - $50M",
      "$50M - $100M",
      "$100M - $500M",
      "$500M - $1B",
      "> $1B"
    ]
  },
  funding_stage: {
    type: "checkbox",
    label: "Funding Stage",
    options: [
      "Seed",
      "Series A",
      "Series B",
      "Series C",
      "Series D+",
      "Private Equity",
      "Public"
    ]
  },
  location: {
    type: "text",
    label: "Location"
  },
  founded_year: {
    type: "range",
    label: "Founded Year",
    min: 1900,
    max: 2024,
    step: 1,
    unit: ""
  }
}

interface Props {
  onSearch: (results: any[], loading: boolean, searched: boolean, filters: Record<string, any>) => void
}

export function FilterSidebarNew({ onSearch }: Props) {
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleFilterChange = (filterKey: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }))
  }

  const handleSearch = async () => {
    setIsLoading(true)
    onSearch([], true, true, filters)
    
    try {
      const requestBody = {
        filters: filters,
        options: {
          limit: 25,
          page: 1
        },
        user_id: null
      }

      console.log('=== DEBUG: About to call API ===')
      console.log('API URL:', '/api/leads/search/companies')
      console.log('Request body:', requestBody)
      
      const response = await fetch('/api/leads/search/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('=== DEBUG: Backend response ===')
      console.log('Response data:', data)
      
      const companies = data.success ? (data.data?.companies || []) : []
      console.log('=== DEBUG: Extracted companies ===')
      console.log('Companies count:', companies.length)
      console.log('Sample company:', companies[0])
      
      onSearch(companies, false, true, filters)
    } catch (error) {
      console.error('Search error:', error)
      onSearch([], false, true, filters)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearFilters = () => {
    setFilters({})
    onSearch([], false, false, {})
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  const renderFilterInput = (filterKey: string, filterConfig: any) => {
    const value = filters[filterKey]

    switch (filterConfig.type) {
      case "text":
        return (
          <Input
            placeholder={`Enter ${filterConfig.label.toLowerCase()}`}
            value={value || ""}
            onChange={(e) => handleFilterChange(filterKey, e.target.value)}
          />
        )

      case "select":
        return (
          <Select value={value || ""} onValueChange={(newValue: string) => handleFilterChange(filterKey, newValue)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${filterConfig.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {filterConfig.options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "range":
        return (
          <div className="space-y-2">
            <Input
              type="number"
              min={filterConfig.min}
              max={filterConfig.max}
              step={filterConfig.step}
              value={value || filterConfig.min}
              onChange={(e) => handleFilterChange(filterKey, parseInt(e.target.value))}
              placeholder={`${filterConfig.min} - ${filterConfig.max}`}
            />
            <div className="text-sm text-muted-foreground">
              {value || filterConfig.min} {filterConfig.unit}
            </div>
          </div>
        )

      case "checkbox":
        return (
          <div className="space-y-2">
            {filterConfig.options.map((option: string) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filterKey}-${option}`}
                  checked={value?.includes(option) || false}
                  onCheckedChange={(checked) => {
                    const currentValues = value || []
                    const newValues = checked
                      ? [...currentValues, option]
                      : currentValues.filter((v: string) => v !== option)
                    handleFilterChange(filterKey, newValues.length > 0 ? newValues : undefined)
                  }}
                />
                <Label htmlFor={`${filterKey}-${option}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-80 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(ALL_FILTERS).map(([filterKey, filterConfig]) => (
            <div key={filterKey} className="space-y-2">
              <Label className="text-sm font-medium">{filterConfig.label}</Label>
              {renderFilterInput(filterKey, filterConfig)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
