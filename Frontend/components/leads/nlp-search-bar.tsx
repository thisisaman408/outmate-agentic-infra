"use client"

import { useState, useRef } from "react"
import { Sparkles, Loader2, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

interface NlpSearchBarProps {
  /** "company" or "prospect" — controls the forced intent */
  intent: "company" | "prospect"
  /** Called with LLM-extracted filters when the user submits a query */
  onFiltersExtracted: (filters: Record<string, any>) => void
  /** Optional placeholder text */
  placeholder?: string
}

interface RedirectInfo {
  pageName: string
  path: string
}

export function NlpSearchBar({ intent, onFiltersExtracted, placeholder }: NlpSearchBarProps) {
  const [query, setQuery] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState("")
  const [redirect, setRedirect] = useState<RedirectInfo | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const defaultPlaceholder = intent === "company"
    ? 'e.g., "B2B SaaS companies in the US with 50-500 employees that use Snowflake"'
    : 'e.g., "VP of Marketing at fintech companies in New York with verified emails"'

  const handleSubmit = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    const API = ""
    setIsParsing(true)
    setError("")
    setRedirect(null)

    try {
      const token = localStorage.getItem("outmate_token")
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const res = await fetch(`${API}/api/v1/chat/parse-query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: trimmed }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `Parse failed: ${res.status}`)
      }

      const parsed = await res.json()
      console.log(`[NLP ${intent}] Parsed:`, parsed)

      // Check if LLM-detected intent matches this page's intent
      const detectedIntent = parsed.intent === "company" ? "company" : "prospect"
      if (detectedIntent !== intent) {
        const pageName = detectedIntent === "company" ? "Companies" : "Prospects"
        const path = detectedIntent === "company" ? "/leads/companies/search" : "/leads/prospects"
        setRedirect({ pageName, path })
        return
      }

      const filters = parsed.filters || {}

      // Remove empty arrays
      const cleanFilters: Record<string, any> = {}
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value) && value.length > 0) {
          cleanFilters[key] = value
        } else if (value && !Array.isArray(value)) {
          cleanFilters[key] = value
        }
      }

      if (Object.keys(cleanFilters).length === 0) {
        setError("Could not extract any filters from your query. Try being more specific about titles, industries, locations, or company size.")
        return
      }

      onFiltersExtracted(cleanFilters)
      setQuery("")
    } catch (e: any) {
      console.error(`[NLP ${intent}] Error:`, e)
      setError("Failed to parse query. Please try again or use the manual filters.")
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={placeholder || defaultPlaceholder}
          rows={1}
          className="resize-none min-h-[40px] text-sm"
        />
        <Button
          onClick={handleSubmit}
          disabled={isParsing || !query.trim()}
          size="sm"
          className="shrink-0 self-end"
        >
          {isParsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Intent mismatch popup */}
      {redirect && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-4 relative">
          <button
            onClick={() => setRedirect(null)}
            className="absolute top-2 right-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Wrong page for this search
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This looks like a {redirect.pageName.toLowerCase()} search. Please use the {redirect.pageName} page instead.
              </p>
              <Link
                href={redirect.path}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Go to {redirect.pageName} page →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
