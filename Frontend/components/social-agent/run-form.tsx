"use client"

import { useState } from "react"
import { Loader2, Play, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_INPUT,
  MESSAGE_TYPE_OPTIONS,
  TONE_OPTIONS,
  type MessageType,
  type SocialAgentRunInput,
  type Tone,
} from "@/lib/social-agent"

interface Props {
  onSubmit: (input: SocialAgentRunInput) => void | Promise<void>
  isRunning: boolean
  initialValues?: Partial<SocialAgentRunInput>
}

export function RunForm({ onSubmit, isRunning, initialValues }: Props) {
  const [topic, setTopic] = useState(initialValues?.topic ?? DEFAULT_INPUT.topic)
  const [maxLeads, setMaxLeads] = useState(
    initialValues?.max_leads ?? DEFAULT_INPUT.max_leads,
  )
  const [clientCompany, setClientCompany] = useState(
    initialValues?.client_company ?? DEFAULT_INPUT.client_company,
  )
  const [clientDescription, setClientDescription] = useState(
    initialValues?.client_description ?? DEFAULT_INPUT.client_description,
  )
  const [senderName, setSenderName] = useState(
    initialValues?.sender_name ?? DEFAULT_INPUT.sender_name,
  )
  const [messageType, setMessageType] = useState<MessageType>(
    (initialValues?.message_type as MessageType) ?? DEFAULT_INPUT.message_type,
  )
  const [tone, setTone] = useState<Tone>(
    (initialValues?.tone as Tone) ?? DEFAULT_INPUT.tone,
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  const canSubmit = topic.trim().length > 0 && !isRunning

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      topic: topic.trim(),
      max_leads: maxLeads,
      client_company: clientCompany.trim(),
      client_description: clientDescription.trim(),
      sender_name: senderName.trim(),
      message_type: messageType,
      tone,
    })
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Topic — the headline input */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-sm font-medium">
              Topic / Keyword
            </Label>
            <div className="flex gap-2">
              <Input
                id="topic"
                placeholder='e.g. "AI agents in sales", "vector database benchmarks"'
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isRunning}
                className="text-base"
              />
              <Button
                type="submit"
                disabled={!canSubmit}
                className="shrink-0 gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Run Agent
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find people actively posting about this topic on LinkedIn / X and
              generate personalized outreach.
            </p>
          </div>

          {/* Quick row: max leads + tone + message type */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="max-leads" className="text-xs uppercase tracking-wider text-muted-foreground">
                Max Leads
              </Label>
              <Input
                id="max-leads"
                type="number"
                min={1}
                max={20}
                value={maxLeads}
                onChange={(e) => setMaxLeads(parseInt(e.target.value || "1", 10))}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Message Type
              </Label>
              <Select
                value={messageType}
                onValueChange={(v) => setMessageType(v as MessageType)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tone
              </Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v as Tone)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced — client context */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="size-3" />
            {showAdvanced ? "Hide" : "Show"} sender context
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-dashed border-border/60 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-company" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Your Company
                  </Label>
                  <Input
                    id="client-company"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Sender Name
                  </Label>
                  <Input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-description" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Your Company Description / Value Prop
                </Label>
                <Textarea
                  id="client-description"
                  value={clientDescription}
                  onChange={(e) => setClientDescription(e.target.value)}
                  disabled={isRunning}
                  rows={3}
                />
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
