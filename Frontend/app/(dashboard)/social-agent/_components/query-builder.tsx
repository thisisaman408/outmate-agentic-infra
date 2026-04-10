"use client"

import { useState } from "react"
import { Plus, X, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface BooleanQuery {
  must: string[]
  should: string[]
  must_not: string[]
}

export interface QueryFilters {
  job_titles: string[]
  seniority: string[]
  industries: string[]
  languages: string[]
  countries: string[]
  hide_replies: boolean
  must_contain_links: boolean
  exclude_sponsored: boolean
}

interface QueryBuilderProps {
  query: BooleanQuery
  filters: QueryFilters
  timeFrame: string
  onQueryChange: (q: BooleanQuery) => void
  onFiltersChange: (f: QueryFilters) => void
  onTimeFrameChange: (t: string) => void
}

const SENIORITY_OPTIONS = [
  { value: "c_level", label: "C-Level" },
  { value: "vp", label: "VP" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "individual", label: "Individual Contributor" },
]

const TIME_FRAME_OPTIONS = [
  { value: "today", label: "Last 24h" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "all", label: "Any time" },
]

export function QueryBuilder({ query, filters, timeFrame, onQueryChange, onFiltersChange, onTimeFrameChange }: QueryBuilderProps) {
  return (
    <div className="space-y-5">
      {/* Boolean Query Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Boolean Query</h4>

        <KeywordGroup
          label="AND (all must be present)"
          keywords={query.must}
          onChange={(must) => onQueryChange({ ...query, must })}
          color="text-emerald-400"
          placeholder="Enter keyword and press Enter..."
        />

        <KeywordGroup
          label="OR (any can be present)"
          keywords={query.should}
          onChange={(should) => onQueryChange({ ...query, should })}
          color="text-blue-400"
          placeholder="Enter keyword and press Enter..."
        />

        <KeywordGroup
          label="NOT (exclude these)"
          keywords={query.must_not}
          onChange={(must_not) => onQueryChange({ ...query, must_not })}
          color="text-red-400"
          placeholder="Enter keyword to exclude..."
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3 border-t border-border/60 pt-4">
        <h4 className="text-sm font-semibold text-foreground">Filters</h4>

        <KeywordGroup
          label="Job Titles"
          keywords={filters.job_titles}
          onChange={(job_titles) => onFiltersChange({ ...filters, job_titles })}
          color="text-violet-400"
          placeholder='e.g. "CTO", "VP Engineering"...'
        />

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Seniority Level</label>
          <div className="flex flex-wrap gap-1.5">
            {SENIORITY_OPTIONS.map((opt) => {
              const active = filters.seniority.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? filters.seniority.filter((s) => s !== opt.value)
                      : [...filters.seniority, opt.value]
                    onFiltersChange({ ...filters, seniority: next })
                  }}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md border transition-colors",
                    active
                      ? "bg-primary/15 border-primary/40 text-primary font-medium"
                      : "border-border/60 text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Time Frame</label>
          <div className="flex gap-1.5">
            {TIME_FRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTimeFrameChange(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md border transition-colors",
                  timeFrame === opt.value
                    ? "bg-primary/15 border-primary/40 text-primary font-medium"
                    : "border-border/60 text-muted-foreground hover:border-primary/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Options */}
      <div className="space-y-2 border-t border-border/60 pt-4">
        <ToggleOption
          label="Hide replies"
          checked={filters.hide_replies}
          onChange={(v) => onFiltersChange({ ...filters, hide_replies: v })}
        />
        <ToggleOption
          label="Must contain links"
          checked={filters.must_contain_links}
          onChange={(v) => onFiltersChange({ ...filters, must_contain_links: v })}
        />
        <ToggleOption
          label="Exclude sponsored"
          checked={filters.exclude_sponsored}
          onChange={(v) => onFiltersChange({ ...filters, exclude_sponsored: v })}
        />
      </div>
    </div>
  )
}

// ─── Internal Components ─────────────────────────────────────────────

function KeywordGroup({ label, keywords, onChange, color, placeholder }: {
  label: string
  keywords: string[]
  onChange: (kw: string[]) => void
  color: string
  placeholder: string
}) {
  const [input, setInput] = useState("")

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed])
      setInput("")
    }
  }

  return (
    <div className="space-y-1.5">
      <label className={cn("text-xs font-medium", color)}>{label}</label>
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={add}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.map((kw) => (
            <Badge key={kw} variant="secondary" className="text-xs gap-1 pr-1">
              {kw}
              <button type="button" onClick={() => onChange(keywords.filter((k) => k !== kw))} className="hover:text-destructive">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "size-4 rounded border flex items-center justify-center transition-colors",
          checked ? "bg-primary border-primary" : "border-muted-foreground/40"
        )}
      >
        {checked && <span className="text-[10px] text-primary-foreground font-bold">&#10003;</span>}
      </button>
      <span className="text-sm text-foreground/80">{label}</span>
    </label>
  )
}
