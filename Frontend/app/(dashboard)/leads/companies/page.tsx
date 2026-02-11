"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Building2,
  Database,
  MessageSquare,
  Hash,
  ArrowRight,
  Globe,
  Linkedin,
  IdCard
} from "lucide-react"
import Link from "next/link"

const apiSections = [
  {
    id: "identification",
    title: "Company Identification",
    description: "Identify companies by name, website, LinkedIn URL, Crunchbase URL, or company ID",
    icon: IdCard,
    color: "bg-blue-500",
    href: "/leads/companies/identification",
    features: ["Name Search", "Domain Lookup", "LinkedIn URL", "Crunchbase URL", "Company ID"]
  },
  {
    id: "enrichment",
    title: "Company Enrichment",
    description: "Get detailed company information and firmographics",
    icon: Building2,
    color: "bg-green-500",
    href: "/leads/companies/enrichment",
    features: ["Domain Enrichment", "Name Enrichment", "ID Enrichment", "Full Profile Data"]
  },
  {
    id: "search",
    title: "In-DB: Company Search",
    description: "Search and filter companies from Crustdata's database",
    icon: Database,
    color: "bg-purple-500",
    href: "/leads/companies/search",
    features: ["Advanced Filters", "Industry Search", "Location Filters", "Funding Data"]
  },
  {
    id: "linkedin-posts",
    title: "Realtime: LinkedIn Posts by Company",
    description: "Get recent LinkedIn posts and engagement metrics for a specific company",
    icon: MessageSquare,
    color: "bg-orange-500",
    href: "/leads/companies/linkedin-posts",
    features: ["Domain Search", "Recent Posts", "Engagement Metrics", "Real-time Data"]
  },
  {
    id: "keyword-search",
    title: "Realtime: LinkedIn Posts Keyword Search",
    description: "Search LinkedIn posts containing specific keywords",
    icon: Hash,
    color: "bg-pink-500",
    href: "/leads/companies/keyword-search",
    features: ["Keyword Search", "Boolean Filters", "Content Types", "Engagement Data"]
  }
]

export default function CrustdataApisPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Globe className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Companies</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Access powerful company intelligence and LinkedIn data
        </p>
      </div>

      {/* API Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apiSections.map((api) => {
          const IconComponent = api.icon
          return (
            <Card key={api.id} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${api.color} text-white`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {api.title}
                  </CardTitle>
                  <CardDescription className="text-sm mt-2">
                    {api.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {api.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                {/* Action Button */}
                <Link href={api.href}>
                  <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    Explore
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}