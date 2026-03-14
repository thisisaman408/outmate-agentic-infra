"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi, type MeetingPrepInput } from "@/lib/api/copilot"

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-base">{title}</CardTitle>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

export default function MeetingPrepPage() {
  const [form, setForm] = useState<MeetingPrepInput>({ company_name: "" })
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setIsLoading(true)
    try {
      const data = await copilotApi.generateMeetingPrep(form)
      setResult(data)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to generate meeting prep", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Meeting Prep</h2>
        <p className="text-sm text-muted-foreground">Walk into every call prepared</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Company Name *</label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Company Domain</label>
                <Input
                  placeholder="e.g. acme.com"
                  value={form.company_domain ?? ""}
                  onChange={(e) => setForm({ ...form, company_domain: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Prospect Name</label>
                <Input
                  placeholder="e.g. Jane Doe"
                  value={form.prospect_name ?? ""}
                  onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Prospect Title</label>
                <Input
                  placeholder="e.g. VP of Sales"
                  value={form.prospect_title ?? ""}
                  onChange={(e) => setForm({ ...form, prospect_title: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={isLoading || !form.company_name.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              Generate Pre-Call Brief
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Preparing your brief...</span>
          </CardContent>
        </Card>
      )}

      {result && !isLoading && (
        <div className="space-y-4">
          <CollapsibleSection title="Company Snapshot">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Industry:</span> {result.company_snapshot?.industry}</p>
              <p><span className="font-medium">Size:</span> {result.company_snapshot?.size}</p>
              {result.company_snapshot?.recent_news?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Recent News:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {result.company_snapshot.recent_news.map((n: string, i: number) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
              {result.company_snapshot?.tech_stack?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.company_snapshot.tech_stack.map((t: string, i: number) => (
                    <Badge key={i} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {result.prospect_profile && (
            <CollapsibleSection title="Prospect Profile">
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Background:</span> {result.prospect_profile.background}</p>
                <p><span className="font-medium">Communication style:</span> {result.prospect_profile.communication_style_hint}</p>
                {result.prospect_profile.likely_priorities?.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Likely priorities:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {result.prospect_profile.likely_priorities.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Talking Points">
            <ul className="space-y-2">
              {(result.talking_points ?? []).map((tp: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  {tp}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Discovery Questions">
            <ul className="space-y-2">
              {(result.discovery_questions ?? []).map((q: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground p-2 rounded bg-muted/50">❓ {q}</li>
              ))}
            </ul>
          </CollapsibleSection>

          {(result.risk_factors ?? []).length > 0 && (
            <CollapsibleSection title="Risk Factors">
              <ul className="space-y-2">
                {result.risk_factors.map((r: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-red-600">
                    <span>⚠️</span> {r}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {result.recommended_approach && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-primary mb-1">Recommended Approach</p>
                <p className="text-sm">{result.recommended_approach}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
