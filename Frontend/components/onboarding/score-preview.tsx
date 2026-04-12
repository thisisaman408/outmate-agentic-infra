"use client"

import { useMemo } from "react"
import { Target, AlertTriangle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface ICPSelections {
  industries: string[]
  company_sizes: string[]
  geographies: string[]
  job_titles: string[]
  funding_stages: string[]
}

interface ScorePreviewProps {
  selections: ICPSelections
}

export function ScorePreview({ selections }: ScorePreviewProps) {
  const { score, persona, warning } = useMemo(() => {
    let s = 40
    const parts: string[] = []

    if (selections.job_titles.length > 0) {
      s += 15
      parts.push(`a ${selections.job_titles[0]}`)
    }
    if (selections.funding_stages.length > 0) {
      s += 10
      parts.push(`at a ${selections.funding_stages[0]} company`)
    } else {
      parts.push("at a company")
    }
    if (selections.industries.length > 0) {
      s += 15
      parts.push(`in ${selections.industries[0]}`)
    }
    if (selections.company_sizes.length > 0) {
      s += 10
      const size = selections.company_sizes[0]
      parts.push(`with ${size} employees`)
    }
    if (selections.geographies.length > 0) {
      s += 10
      parts.push(`in the ${selections.geographies[0]}`)
    }

    let warn: string | null = null
    const totalSelections =
      selections.industries.length +
      selections.job_titles.length +
      selections.geographies.length

    if (totalSelections === 0) {
      warn = null // no warning when nothing selected yet
    } else if (
      selections.industries.length < 3 &&
      selections.job_titles.length < 3 &&
      selections.industries.length + selections.job_titles.length > 0
    ) {
      warn = "Your ICP is quite narrow — consider adding more industries or titles for better coverage."
    } else if (selections.industries.length > 20) {
      warn = "Very broad industry selection — scoring may be less precise."
    }

    return {
      score: Math.min(100, s),
      persona: parts.length > 0 ? parts.join(" ") : null,
      warning: warn,
    }
  }, [selections])

  const hasAnySelection =
    selections.industries.length > 0 ||
    selections.company_sizes.length > 0 ||
    selections.geographies.length > 0 ||
    selections.job_titles.length > 0 ||
    selections.funding_stages.length > 0

  if (!hasAnySelection) return null

  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-semibold text-[#1e1b4b]">Score Preview</span>
      </div>

      {persona && (
        <p className="text-sm text-muted-foreground mb-3">
          {persona} would score:
        </p>
      )}

      <div className="flex items-center gap-3 mb-2">
        <Progress value={score} className="h-2.5 flex-1" />
        <span className="text-lg font-bold text-[#1e1b4b] w-8 text-right">{score}</span>
      </div>

      {warning && (
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{warning}</p>
        </div>
      )}
    </div>
  )
}
