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
    <div className="flex items-center gap-2 p-3 border-t bg-background">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 1000))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Ask copilot anything..."}
        disabled={isLoading}
        className="flex-1"
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
