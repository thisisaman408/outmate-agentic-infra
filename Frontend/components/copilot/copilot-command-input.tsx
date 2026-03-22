"use client"

import { useState, useCallback, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"

interface CopilotCommandInputProps {
  onSubmit: (prompt: string) => void
  isLoading: boolean
  placeholder?: string
}

export function CopilotCommandInput({ onSubmit, isLoading, placeholder }: CopilotCommandInputProps) {
  const [value, setValue] = useState("")

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    if (trimmed.length > 1000) return
    onSubmit(trimmed)
    setValue("")
  }, [value, isLoading, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 1000))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Ask copilot anything..."}
        disabled={isLoading}
        className="flex-1 h-9 bg-muted/30 border-border/40 text-[13px] placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="shrink-0 h-9 w-9 rounded-lg"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
