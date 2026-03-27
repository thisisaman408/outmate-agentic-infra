"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Database,
  MessageSquare,
  Hash,
  ArrowRight,
  Globe,
  IdCard,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Icon + accent color pairing using design-system tokens
type AccentKey = "primary" | "success" | "info" | "warning" | "destructive"

const apiSections: {
  id: string
  title: string
  description: string
  icon: React.ElementType
  accent: AccentKey
  href: string
  features: string[]
}[] = [
  {
    id: "identification",
    title: "Company Identification",
    description: "Identify companies by name, website, profile URL, or company ID",
    icon: IdCard,
    accent: "primary",
    href: "/leads/companies/identification",
    features: ["Name Search", "Domain Lookup", "Profile URL", "Company ID"],
  },
  {
    id: "enrichment",
    title: "Company Enrichment",
    description: "Get detailed company information and firmographics",
    icon: Building2,
    accent: "success",
    href: "/leads/companies/enrichment",
    features: ["Domain Enrichment", "Name Enrichment", "ID Enrichment", "Full Profile Data"],
  },
  {
    id: "search",
    title: "In-DB: Company Search",
    description: "Search and filter companies from our curated intelligence dataset",
    icon: Database,
    accent: "info",
    href: "/leads/companies/search",
    features: ["Advanced Filters", "Industry Search", "Location Filters", "Funding Data"],
  },
  {
    id: "linkedin-posts",
    title: "Social Posts by Company",
    description: "Get recent social posts and engagement metrics for a specific company",
    icon: MessageSquare,
    accent: "warning",
    href: "/leads/companies/linkedin-posts",
    features: ["Domain Search", "Recent Posts", "Engagement Metrics", "Real-time Data"],
  },
  {
    id: "keyword-search",
    title: "Social Posts Keyword Search",
    description: "Search social posts containing specific keywords across companies",
    icon: Hash,
    accent: "destructive",
    href: "/leads/companies/keyword-search",
    features: ["Keyword Search", "Boolean Filters", "Content Types", "Engagement Data"],
  },
]

const accentClasses: Record<AccentKey, { icon: string; badge: string }> = {
  primary:     { icon: "bg-primary/10 text-primary",     badge: "border-primary/20 text-primary" },
  success:     { icon: "bg-success/10 text-success",     badge: "border-success/20 text-success" },
  info:        { icon: "bg-info/10 text-info",           badge: "border-info/20 text-info" },
  warning:     { icon: "bg-warning/10 text-warning",     badge: "border-warning/20 text-warning" },
  destructive: { icon: "bg-destructive/10 text-destructive", badge: "border-destructive/20 text-destructive" },
}

export default function CompanyIntelligencePage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Access powerful company intelligence and enrichment insights
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {apiSections.map((api) => {
          const IconComponent = api.icon
          const colors = accentClasses[api.accent]
          return (
            <Card
              key={api.id}
              className="group flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-border/60"
            >
              <CardHeader className="pb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", colors.icon)}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                  {api.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {api.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 flex-1 pt-0">
                <div className="flex flex-wrap gap-1">
                  {api.features.map((feature) => (
                    <Badge
                      key={feature}
                      variant="outline"
                      className={cn("text-[10px] h-5 px-1.5", colors.badge)}
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto">
                  <Link href={api.href}>
                    <Button variant="outline" size="sm" className="w-full gap-1.5 h-8">
                      Open
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
