"use client"

import { Linkedin, Twitter, MessageCircle, Star, Radio, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

export type MonitorSource =
  | "linkedin_posts"
  | "linkedin_activity"
  | "linkedin_comments"
  | "job_changes"
  | "twitter_posts"
  | "reddit_threads"
  | "g2_reviews"

interface SourceOption {
  value: MonitorSource
  label: string
  description: string
  icon: any
  available: boolean
}

const SOURCES: SourceOption[] = [
  { value: "linkedin_posts", label: "Monitor posts on LinkedIn", description: "Track posts and articles matching your keywords", icon: Linkedin, available: true },
  { value: "linkedin_activity", label: "Monitor profile activity", description: "Track profile changes, job updates, and engagement", icon: Linkedin, available: true },
  { value: "linkedin_comments", label: "Monitor comments & reactions", description: "Track who's engaging with relevant content", icon: MessageCircle, available: true },
  { value: "job_changes", label: "Monitor job changes", description: "Detect when prospects change roles, get promoted, or switch companies", icon: Briefcase, available: true },
  { value: "twitter_posts", label: "Monitor posts on X", description: "Track tweets and threads on topics you care about", icon: Twitter, available: false },
  { value: "reddit_threads", label: "Monitor Reddit threads", description: "Track discussions in relevant subreddits", icon: MessageCircle, available: false },
  { value: "g2_reviews", label: "Monitor G2 reviews", description: "Track competitor and category reviews", icon: Star, available: false },
]

interface SourceSelectorProps {
  value: MonitorSource
  onChange: (source: MonitorSource) => void
  apifyAvailable?: boolean
}

export function SourceSelector({ value, onChange, apifyAvailable }: SourceSelectorProps) {
  // If Apify is available, Twitter and Reddit become available
  const sources = SOURCES.map(s => ({
    ...s,
    available: s.available || (apifyAvailable && ["twitter_posts", "reddit_threads"].includes(s.value)),
  }))

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Select a source to monitor</label>
      <div className="space-y-2">
        {sources.map((source) => {
          const Icon = source.icon
          const selected = value === source.value
          const disabled = !source.available
          return (
            <button
              key={source.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(source.value)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : disabled
                  ? "border-border/40 opacity-50 cursor-not-allowed"
                  : "border-border/60 hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
              )}
            >
              <div className={cn(
                "size-9 rounded-lg flex items-center justify-center shrink-0",
                selected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>{source.label}</span>
                  {!source.available && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Coming soon</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
              </div>
              <div className={cn(
                "size-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                selected ? "border-primary" : "border-muted-foreground/30"
              )}>
                {selected && <div className="size-2 rounded-full bg-primary" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
