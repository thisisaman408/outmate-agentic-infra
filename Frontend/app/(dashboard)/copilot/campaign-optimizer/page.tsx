"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Target, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi, type CampaignOptimizerInput } from "@/lib/api/copilot"

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500"
  return (
    <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-muted">
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground">/ 100</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export default function CampaignOptimizerPage() {
  const [form, setForm] = useState<CampaignOptimizerInput>({ subject_line: "", email_body: "" })
  const [openRate, setOpenRate] = useState("")
  const [replyRate, setReplyRate] = useState("")
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload: CampaignOptimizerInput = {
        ...form,
        metrics: openRate || replyRate ? {
          opened: openRate ? parseFloat(openRate) : undefined,
          replied: replyRate ? parseFloat(replyRate) : undefined,
        } : undefined,
      }
      const data = await copilotApi.analyzeCampaign(payload)
      setResult(data)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to analyze campaign", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Campaign Optimizer</h2>
        <p className="text-sm text-muted-foreground">Don't guess — optimize with AI</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject Line *</label>
              <Input
                placeholder="e.g. Quick question about your outreach"
                value={form.subject_line}
                onChange={(e) => setForm({ ...form, subject_line: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email Body *</label>
              <Textarea
                placeholder="Paste your full email body here..."
                value={form.email_body}
                onChange={(e) => setForm({ ...form, email_body: e.target.value })}
                rows={6}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Open Rate % (optional)</label>
                <Input
                  type="number"
                  placeholder="e.g. 18"
                  value={openRate}
                  onChange={(e) => setOpenRate(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reply Rate % (optional)</label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  value={replyRate}
                  onChange={(e) => setReplyRate(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <Button type="submit" disabled={isLoading || !form.subject_line || !form.email_body}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
              Analyze Campaign
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Analyzing your campaign...</span>
          </CardContent>
        </Card>
      )}

      {result && !isLoading && (
        <div className="space-y-4">
          {/* Score Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <ScoreCircle score={result.overall_score} />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Category Scores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.category_scores ?? {}).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                        <span className={val >= 70 ? "text-green-500" : val >= 40 ? "text-yellow-500" : "text-red-500"}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {result.predicted_lift && (
                <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
                  📈 {result.predicted_lift}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weaknesses */}
          {(result.weaknesses ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Weaknesses</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.weaknesses.map((w: string, i: number) => (
                  <p key={i} className="text-sm flex gap-2"><span className="text-red-500">✗</span>{w}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Improvements */}
          {(result.improvements ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Improvements</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.improvements.map((imp: string, i: number) => (
                  <p key={i} className="text-sm flex gap-2"><span className="text-green-500">✓</span>{imp}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Suggested Subjects */}
          {(result.suggested_subjects ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Suggested Subject Lines</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.suggested_subjects.map((s: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm">{s}</span>
                    <CopyButton text={s} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Suggested Openers */}
          {(result.suggested_openers ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Suggested Opening Lines</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.suggested_openers.map((s: string, i: number) => (
                  <div key={i} className="flex items-start justify-between p-2 rounded bg-muted/50 gap-2">
                    <span className="text-sm">{s}</span>
                    <CopyButton text={s} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
