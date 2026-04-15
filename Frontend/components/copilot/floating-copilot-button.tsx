"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Sparkles, X, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function FloatingCopilotButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasNewFeatures, setHasNewFeatures] = React.useState(true)

  const handleClick = () => {
    router.push("/copilot")
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 mb-2 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Unified Copilot</h3>
                <p className="text-xs text-muted-foreground">AI-powered assistant</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Get AI assistance with daily briefs, meeting prep, campaign optimization, and more.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleClick}
              className="w-full h-9 text-xs font-bold uppercase tracking-wider rounded-xl"
            >
              Open Copilot
            </Button>
          </div>
        </div>
      )}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "flex items-center justify-center relative group"
        )}
        size="icon"
      >
        <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
        {hasNewFeatures && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-background">
            1
          </Badge>
        )}
        <span className="sr-only">Open Copilot</span>
      </Button>
    </div>
  )
}
