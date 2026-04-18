"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Save, CheckCircle2, Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getCompanyProfile,
  updateCompanyProfile,
  EMPTY_PROFILE,
  type CompanyProfile,
} from "@/lib/api/company-profile"

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    getCompanyProfile()
      .then((p) => setProfile({
        company_name: p.company_name,
        website_url: p.website_url,
        one_liner: p.one_liner,
        product_description: p.product_description,
        pricing_summary: p.pricing_summary,
        icp_description: p.icp_description,
        objection_handling: p.objection_handling,
        key_differentiators: p.key_differentiators,
        additional_context: p.additional_context,
        agent_persona_name: p.agent_persona_name,
        agent_persona_role: p.agent_persona_role,
        calendar_booking_url: p.calendar_booking_url,
      }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true); setError(""); setSavedAt(null)
    try {
      const updated = await updateCompanyProfile(profile)
      setSavedAt(updated.updated_at || new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [profile])

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <Link href="/settings" className="flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Company Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill this out once. Every agent (Voice, Social, Co-Pilot) uses it to
          understand what you sell and how to pitch it. Without it, agents fall
          back to generic language.
        </p>
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm flex items-start gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Your voice agent reads this on every call.</div>
          <div className="text-muted-foreground mt-0.5">
            The agent persona, product pitch, pricing, objection handling — all pulled from below.
            Changes apply to the next call; no restart needed.
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Identity</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Your company name *</Label>
              <Input
                value={profile.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={profile.website_url}
                onChange={(e) => set("website_url", e.target.value)}
                placeholder="https://acme.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Agent name (shown to prospects)</Label>
              <Input
                value={profile.agent_persona_name}
                onChange={(e) => set("agent_persona_name", e.target.value)}
                placeholder="Alex"
              />
            </div>
            <div>
              <Label>Agent role</Label>
              <Input
                value={profile.agent_persona_role}
                onChange={(e) => set("agent_persona_role", e.target.value)}
                placeholder="GTM Specialist"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Pitch</h2>

          <div>
            <Label>One-liner *</Label>
            <Input
              value={profile.one_liner}
              onChange={(e) => set("one_liner", e.target.value)}
              placeholder="We help Series B SaaS founders scale outbound without hiring SDRs."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Delivered in the first 10 seconds of every call. Keep it under 20 words.
            </p>
          </div>

          <div>
            <Label>Product description</Label>
            <Textarea
              rows={4}
              value={profile.product_description}
              onChange={(e) => set("product_description", e.target.value)}
              placeholder="Outmate is a signal-based GTM platform. It detects when ICP companies raise funding, hire GTM leaders, or show buying intent, then autonomously drafts and sends personalized outreach..."
            />
          </div>

          <div>
            <Label>Pricing summary</Label>
            <Textarea
              rows={2}
              value={profile.pricing_summary}
              onChange={(e) => set("pricing_summary", e.target.value)}
              placeholder="Starts at $500/mo for 2 seats. 14-day free trial, no credit card."
            />
          </div>

          <div>
            <Label>ICP (who you sell to)</Label>
            <Textarea
              rows={2}
              value={profile.icp_description}
              onChange={(e) => set("icp_description", e.target.value)}
              placeholder="Series A-C SaaS, 20-200 employees, EU + US, with a founder-led GTM motion."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Conversation guidance</h2>

          <div>
            <Label>Key differentiators</Label>
            <Textarea
              rows={3}
              value={profile.key_differentiators}
              onChange={(e) => set("key_differentiators", e.target.value)}
              placeholder="1. Signal-based (we only reach out when the timing is right). 2. Autonomous — set up once, runs daily. 3. Built-in Retell voice agent."
            />
          </div>

          <div>
            <Label>Objection handling</Label>
            <Textarea
              rows={4}
              value={profile.objection_handling}
              onChange={(e) => set("objection_handling", e.target.value)}
              placeholder='"We already have SDRs" → "Outmate works alongside — we surface the hottest signals so your SDRs spend time on the best leads."&#10;"Too expensive" → ...'
            />
          </div>

          <div>
            <Label>Additional context (anything else the agent should know)</Label>
            <Textarea
              rows={3}
              value={profile.additional_context}
              onChange={(e) => set("additional_context", e.target.value)}
              placeholder="Case studies, certifications, recent press, integration partners..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Call-to-action</h2>
          <div>
            <Label>Calendar booking link</Label>
            <Input
              value={profile.calendar_booking_url}
              onChange={(e) => set("calendar_booking_url", e.target.value)}
              placeholder="https://cal.com/yourname/discovery"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The voice agent offers this link when the prospect wants to book a meeting.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between sticky bottom-0 bg-background/80 backdrop-blur py-3 border-t">
        <div className="text-xs text-muted-foreground">
          {savedAt && <span className="text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
          {error && <span className="text-destructive">{error}</span>}
        </div>
        <Button onClick={handleSave} disabled={saving || !profile.company_name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save profile
        </Button>
      </div>
    </div>
  )
}
