"use client"

import { useState } from "react"
import Image from "next/image"

/**
 * Integration logo component.
 *
 * Tries to load an SVG from /icons/integrations/{slug}.svg.
 * Falls back to a colored initial letter on failure (no broken image icons).
 *
 * Brand logos should be placed in Frontend/public/icons/integrations/ as SVGs
 * following each company's brand guidelines.
 */

// Brand-approximate colors for fallback initials
const BRAND_COLORS: Record<string, string> = {
  salesforce: "#00A1E0",
  hubspot: "#FF7A59",
  explorium: "#6366f1",
  crustdata: "#0ea5e9",
  contactout: "#f59e0b",
  bettercontact: "#10b981",
  gmail: "#EA4335",
  slack: "#4A154B",
  linkedin: "#0A66C2",
  "linkedin-dm": "#0A66C2",
  calendly: "#006BFF",
  zapier: "#FF4A00",
  make: "#6D00CC",
  notion: "#000000",
  airtable: "#18BFFF",
  "google-calendar": "#4285F4",
  "google-sheets": "#34A853",
  "google-analytics": "#E37400",
  "google-drive": "#0F9D58",
  "google-meet": "#00897B",
  "google-ads": "#4285F4",
  jira: "#0052CC",
  trello: "#0079BF",
  asana: "#F06A6A",
  twilio: "#F22F46",
  sendgrid: "#1A82E2",
  mailchimp: "#FFE01B",
  pipedrive: "#017737",
  "zoho-crm": "#D4382E",
  intercom: "#286EFA",
  zendesk: "#03363D",
  gong: "#7B61FF",
  teams: "#6264A7",
  outlook: "#0078D4",
  discord: "#5865F2",
  twitter: "#000000",
  "meta-ads": "#1877F2",
  apollo: "#4B3FD4",
  "hunter": "#FF6740",
  clearbit: "#2563EB",
  segment: "#52BD94",
  mixpanel: "#7856FF",
  posthog: "#1D4AFF",
  amplitude: "#0061FF",
  n8n: "#EA4B71",
  whatsapp: "#25D366",
  drift: "#0176FF",
  "enrich-so": "#8B5CF6",
  brightdata: "#22C55E",
  ipinfo: "#0369A1",
  "6sense": "#2563EB",
  stripe: "#635BFF",
  freshsales: "#0099FF",
  close: "#5A67D8",
  copper: "#F4A460",
  attio: "#111827",
  "rest-api": "#6366f1",
  webhooks: "#059669",
}

interface IntegrationLogoProps {
  slug: string
  name: string
  size?: number
}

export function IntegrationLogo({ slug, name, size = 40 }: IntegrationLogoProps) {
  const [imgError, setImgError] = useState(false)

  const bgColor = BRAND_COLORS[slug] || "#6b7280"
  const initial = name.charAt(0).toUpperCase()

  if (imgError) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-lg text-white font-bold"
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
          fontSize: size * 0.4,
        }}
      >
        {initial}
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 rounded-lg overflow-hidden bg-muted/40"
      style={{ width: size, height: size }}
    >
      <Image
        src={`/icons/integrations/${slug}.svg`}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="object-contain p-1"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  )
}
