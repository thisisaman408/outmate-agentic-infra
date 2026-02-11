"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterInputYear } from "./filter-input-year"
import { FilterInputCountry } from "./filter-input-country"
import { FilterMultiCompanyType } from "./filter-multi-company-type"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Filter, X } from "lucide-react"

// Simplified filters for company search
export const ALL_FILTERS = {
  name: {
    type: "text",
    label: "Company Name"
  },
  domain: {
    type: "text",
    label: "Company Domain"
  },
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
  employee_count: {
    type: "range",
    label: "Employee Count",
    min: 1,
    max: 10000,
    step: 10,
    unit: "employees"
  }
}

interface Props {
  onSearch: (results: any[], loading: boolean, searched: boolean, filters: Record<string, any>) => void
}

export function FilterSidebar({ onSearch }: Props) {
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
      // API call to backend - using correct LeadSearchRequest format
      const requestBody = {
        filters: filters, // Send filters directly as expected by backend
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
      
      // Handle the correct response format from LeadSearchResponse
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

  const renderFilter = (filterKey: string, filterConfig: any) => {
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
      
      default:
        return null
    }
  }

  const hasActiveFilters = Object.keys(filters).length > 0

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
            <div key={`filter-${filterKey}`} className="space-y-2">
              <Label className="text-sm font-medium">{filterConfig.label}</Label>
              {renderFilter(filterKey, filterConfig)}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSearch} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
