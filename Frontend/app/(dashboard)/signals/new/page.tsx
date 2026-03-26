"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Linkedin, MessageSquare, Users, Target, FileText, Twitter, User, Rss,
    Youtube, Instagram, Star, Sparkles, UserCheck, Github, GitCommit, GitFork, 
    Database, BarChart, Phone, Share2, ShoppingBag, Search, Globe, Zap, Table, ShoppingCart, Briefcase, Network, Settings2
} from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
    {
        title: "Social Listening",
        items: [
            { label: "Monitor professional posts", icon: Linkedin, color: "text-blue-700", category: "linkedin_post" },
            { label: "Monitor interactions with professional posts", icon: MessageSquare, color: "text-blue-600", category: "linkedin_post" },
            { label: "Monitor post audiences on LinkedIn", icon: Users, color: "text-blue-500", category: "linkedin_post" },
            { label: "Monitor for ads with Adbeat", icon: Target, color: "text-red-500", category: "brand_mentions" },
            { label: "Monitor mentions on Reddit", icon: FileText, color: "text-orange-500", category: "brand_mentions" },
            { label: "Monitor Google News RSS Feed", icon: Rss, color: "text-orange-600", category: "news_funding" },
        ]
    },
    {
        title: "X / Twitter Batch",
        items: [
            { label: "Monitor mentions from X", icon: Twitter, color: "text-sky-500", category: "brand_mentions" },
            { label: "Monitor profiles on X by topic", icon: User, color: "text-sky-600", category: "custom" },
            { label: "Monitor followers on X", icon: Twitter, color: "text-sky-500", category: "custom" },
            { label: "Monitor profiles followed by X user", icon: User, color: "text-sky-600", category: "custom" },
            { label: "Monitor activity from X accounts", icon: Twitter, color: "text-sky-400", category: "custom" },
        ]
    },
    {
        title: "Media & Influencers",
        items: [
            { label: "Monitor for YouTube videos or creators", icon: Youtube, color: "text-red-600", category: "brand_mentions" },
            { label: "Monitor profiles followed by an Instagram user", icon: Instagram, color: "text-pink-600", category: "custom" },
            { label: "Monitor followers on Instagram", icon: Instagram, color: "text-pink-500", category: "custom" },
            { label: "Monitor social media influencers with Modash", icon: Star, color: "text-yellow-500", category: "brand_mentions" },
            { label: "Monitor social media micro-influencers with Upfluence", icon: Sparkles, color: "text-purple-500", category: "brand_mentions" },
        ]
    },
    {
        title: "Trigify",
        items: [
            { label: "Monitor prospects engaging with professional posts using Trigify", icon: UserCheck, color: "text-green-600", category: "linkedin_post" },
        ]
    },
    {
        title: "GitHub",
        items: [
            { label: "Monitor stargazers on GitHub", icon: Github, color: "text-slate-800 dark:text-slate-200", category: "custom" },
            { label: "Monitor contributors on GitHub", icon: GitCommit, color: "text-slate-800 dark:text-slate-300", category: "custom" },
            { label: "Monitor forks on GitHub", icon: GitFork, color: "text-slate-800 dark:text-slate-400", category: "custom" },
        ]
    },
    {
        title: "1st party signals",
        items: [
            { label: "Monitor Snowflake data", icon: Database, color: "text-blue-400", category: "custom" },
            { label: "Monitor Databricks data", icon: Database, color: "text-orange-500", category: "custom" },
            { label: "Monitor profiles from a Mixpanel cohort", icon: BarChart, color: "text-purple-500", category: "custom" },
            { label: "Monitor calls from Gong", icon: Phone, color: "text-pink-500", category: "custom" },
            { label: "Monitor accounts from Crossbeam", icon: Share2, color: "text-indigo-500", category: "custom" },
        ]
    },
    {
        title: "Company sourcing",
        items: [
            { label: "Monitor companies with buying intent by TrustRadius", icon: ShoppingCart, color: "text-blue-600", category: "custom" },
            { label: "Monitor companies by product usage with HG Insights", icon: Briefcase, color: "text-slate-600", category: "custom" },
            { label: "Monitor local businesses using Openmart", icon: Globe, color: "text-green-500", category: "custom" },
            { label: "Monitor local businesses using Google Maps", icon: Globe, color: "text-green-600", category: "custom" },
            { label: "Monitor companies with Store Leads", icon: ShoppingBag, color: "text-orange-500", category: "custom" },
            { label: "Monitor companies from Pitchbook shared search", icon: Search, color: "text-blue-800", category: "custom" },
        ]
    },
    {
        title: "Other",
        items: [
            { label: "Monitor RSS Feed", icon: Rss, color: "text-orange-500", category: "custom" },
            { label: "Monitor Google Search results", icon: Search, color: "text-blue-500", category: "web_intent" },
            { label: "Monitor leads from Phantombuster", icon: Zap, color: "text-amber-500", category: "custom" },
            { label: "Monitor data from Apify actor", icon: Zap, color: "text-orange-400", category: "custom" },
            { label: "Monitor and enrich your data from Airtable", icon: Table, color: "text-blue-500", category: "custom" },
            { label: "Monitor data from an HTTP API", icon: Network, color: "text-gray-600", category: "custom" },
        ]
    }
]

export default function NewSignalPage() {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")

    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    const filteredSections = sections.map(section => ({
        ...section,
        items: section.items.filter(item => {
            if (searchTerms.length === 0) return true;
            const searchableText = `${section.title} ${item.label} ${item.category || ''}`.toLowerCase();
            return searchTerms.every(term => searchableText.includes(term));
        })
    })).filter(section => section.items.length > 0)

    return (
        <div className="container mx-auto py-10 max-w-6xl">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Create New Signal</h1>
                    <p className="text-muted-foreground">Select a specific source or integration to monitor.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search configurations..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-11"
                    />
                </div>
            </div>

            {filteredSections.length === 0 && (
                <div className="p-16 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
                    <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-foreground">0 configurations showing</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        No signal types match your search for "{searchQuery}".
                    </p>
                    <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                        Clear search
                    </Button>
                </div>
            )}

            <div className="space-y-10 pb-20">
                {filteredSections.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="text-xl font-semibold mb-4 text-foreground/80">{section.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {section.items.map((item, itemIdx) => {
                                const categoryParam = item.category ? `?category=${item.category}` : ""
                                return (
                                    <Link
                                        key={itemIdx}
                                        href={`/signals/new/custom/${item.label.toLowerCase().replace(/ /g, '-')}${categoryParam}`}
                                        className="block h-full"
                                    >
                                        <Card
                                            className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all duration-200 group border-muted h-full shadow-sm"
                                        >
                                            <CardContent className="p-4 flex flex-col h-full">
                                                <div className="mb-3">
                                                    <div className={cn("p-2 rounded-md bg-background border inline-flex shadow-sm", "group-hover:bg-background/80 transition-colors")}>
                                                        <item.icon className={cn("w-5 h-5", item.color)} />
                                                    </div>
                                                </div>
                                                <h4 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                                                    {item.label}
                                                </h4>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}