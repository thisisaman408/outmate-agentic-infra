"use client"

import { useState } from "react"
import {
  Check,
  Copy,
  ExternalLink,
  Linkedin,
  Mail,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Lead } from "@/lib/social-agent"

interface Props {
  lead: Lead
  index: number
}

export function LeadCard({ lead, index }: Props) {
  const [showMessage, setShowMessage] = useState(false)
  const [copied, setCopied] = useState(false)

  const initials = (lead.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const charsOver = lead.charCount > lead.charLimit
  const charBadgeVariant = charsOver ? "destructive" : "secondary"

  function copyMessage() {
    if (!lead.message) return
    navigator.clipboard.writeText(lead.message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className="overflow-hidden border-l-4 border-l-primary/60 hover:border-l-primary transition-colors">
        <CardContent className="space-y-4">
          {/* Header — person identity */}
          <div className="flex items-start gap-3">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base leading-tight">
                  {lead.name || "Unknown"}
                </h3>
                {lead.linkedin && (
                  <a
                    href={lead.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label="LinkedIn profile"
                  >
                    <Linkedin className="size-3.5" />
                  </a>
                )}
              </div>
              {(lead.title || lead.company) && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lead.title}
                  {lead.title && lead.company && (
                    <span className="text-muted-foreground/60"> · </span>
                  )}
                  {lead.company && (
                    <span className="font-medium text-foreground/80">
                      {lead.company}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Recent post — what they're saying */}
          {lead.postSnippet && (
            <div className="rounded-md bg-muted/40 border border-border/60 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                <Sparkles className="size-3" />
                Recent post
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">
                "{lead.postSnippet}"
              </p>
              {lead.postUrl && (
                <a
                  href={lead.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View post <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}

          {/* Best hook */}
          {lead.bestHook && (
            <div className="text-sm">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Hook ·{" "}
              </span>
              <span className="text-foreground/80">{lead.bestHook}</span>
            </div>
          )}

          {/* Email + actions row */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-2 text-xs">
              {lead.email ? (
                <>
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-foreground/80 truncate max-w-[240px]">
                    {lead.email}
                  </span>
                  {lead.emailUnverified && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      unverified
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground italic">
                  no email found
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant={showMessage ? "secondary" : "default"}
              onClick={() => setShowMessage((v) => !v)}
              className="gap-1.5 h-8"
              disabled={!lead.message}
            >
              <MessageSquare className="size-3.5" />
              {showMessage ? "Hide message" : "View AI message"}
            </Button>
          </div>

          {/* AI-drafted outreach message */}
          {showMessage && lead.message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.18 }}
              className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary font-medium">
                  <Sparkles className="size-3" />
                  AI-drafted outreach
                </div>
                <Badge variant={charBadgeVariant as any} className="text-[10px]">
                  {lead.charCount} / {lead.charLimit} chars
                </Badge>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {lead.message}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copyMessage}
                  className="gap-1.5 h-7 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy message
                    </>
                  )}
                </Button>
                {lead.linkedin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    className="gap-1.5 h-7 text-xs"
                  >
                    <a
                      href={lead.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="size-3" /> Open profile
                    </a>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
