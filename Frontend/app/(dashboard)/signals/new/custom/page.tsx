"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Linkedin, MessageSquare, Users, Target, FileText, Twitter, User, Rss,
    Youtube, Instagram, Star, Sparkles, UserCheck, Github, GitCommit, GitFork, ArrowLeft,
    Database, BarChart, Phone, Share2, ShoppingBag, Search, Globe, Zap, Table, ShoppingCart, Briefcase, Network
} from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
    {
        title: "Social Listening",
        items: [
            { label: "Monitor professional posts", icon: Linkedin, color: "text-blue-700" },
            { label: "Monitor interactions with professional posts", icon: MessageSquare, color: "text-blue-600" },
            { label: "Monitor post audiences on LinkedIn", icon: Users, color: "text-blue-500" },
            { label: "Monitor for ads with Adbeat", icon: Target, color: "text-red-500" },
            { label: "Monitor mentions on Reddit", icon: FileText, color: "text-orange-500" },
            { label: "Monitor Google News RSS Feed", icon: Rss, color: "text-orange-600" },
        ]
    },
    {
        title: "X / Twitter Batch",
        items: [
            { label: "Monitor mentions from X", icon: Twitter, color: "text-sky-500" },
            { label: "Monitor profiles on X by topic", icon: User, color: "text-sky-600" },
            { label: "Monitor followers on X", icon: Twitter, color: "text-sky-500" },
            { label: "Monitor profiles followed by X user", icon: User, color: "text-sky-600" },
            { label: "Monitor activity from X accounts", icon: Twitter, color: "text-sky-400" },
        ]
    },
    {
        title: "Media & Influencers",
        items: [
            { label: "Monitor for YouTube videos or creators", icon: Youtube, color: "text-red-600" },
            { label: "Monitor profiles followed by an Instagram user", icon: Instagram, color: "text-pink-600" },
            { label: "Monitor followers on Instagram", icon: Instagram, color: "text-pink-500" },
            { label: "Monitor social media influencers with Modash", icon: Star, color: "text-yellow-500" },
            { label: "Monitor social media micro-influencers with Upfluence", icon: Sparkles, color: "text-purple-500" },
        ]
    },
    {
        title: "Trigify",
        items: [
            { label: "Monitor prospects engaging with professional posts using Trigify", icon: UserCheck, color: "text-green-600" },
        ]
    },
    {
        title: "GitHub",
        items: [
            { label: "Monitor stargazers on GitHub", icon: Github, color: "text-slate-800 dark:text-slate-200" },
            { label: "Monitor contributors on GitHub", icon: GitCommit, color: "text-slate-800 dark:text-slate-300" },
            { label: "Monitor forks on GitHub", icon: GitFork, color: "text-slate-800 dark:text-slate-400" },
        ]
    },
    {
        title: "1st party signals",
        items: [
            { label: "Monitor Snowflake data", icon: Database, color: "text-blue-400" },
            { label: "Monitor Databricks data", icon: Database, color: "text-orange-500" },
            { label: "Monitor profiles from a Mixpanel cohort", icon: BarChart, color: "text-purple-500" },
            { label: "Monitor calls from Gong", icon: Phone, color: "text-pink-500" },
            { label: "Monitor accounts from Crossbeam", icon: Share2, color: "text-indigo-500" },
        ]
    },
    {
        title: "Company sourcing",
        items: [
            { label: "Monitor companies with buying intent by TrustRadius", icon: ShoppingCart, color: "text-blue-600" },
            { label: "Monitor companies by product usage with HG Insights", icon: Briefcase, color: "text-slate-600" },
            { label: "Monitor local businesses using Openmart", icon: Globe, color: "text-green-500" },
            { label: "Monitor local businesses using Google Maps", icon: Globe, color: "text-green-600" },
            { label: "Monitor companies with Store Leads", icon: ShoppingBag, color: "text-orange-500" },
            { label: "Monitor companies from Pitchbook shared search", icon: Search, color: "text-blue-800" },
        ]
    },
    {
        title: "Other",
        items: [
            { label: "Monitor RSS Feed", icon: Rss, color: "text-orange-500" },
            { label: "Monitor Google Search results", icon: Search, color: "text-blue-500" },
            { label: "Monitor leads from Phantombuster", icon: Zap, color: "text-amber-500" },
            { label: "Monitor data from Apify actor", icon: Zap, color: "text-orange-400" },
            { label: "Monitor and enrich your data from Airtable", icon: Table, color: "text-blue-500" },
            { label: "Monitor data from an HTTP API", icon: Network, color: "text-gray-600" },
        ]
    }
]

export default function CustomSignalPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const category = searchParams.get("category") || ""
    const categoryParam = category ? `?category=${category}` : ""

    return (
        <div className="container mx-auto py-10 max-w-6xl">
            <Button variant="ghost" className="mb-6 pl-0 hover:pl-2 transition-all" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Signal Types
            </Button>

            <div className="mb-8">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Step 1</span>
                <h1 className="text-3xl font-bold tracking-tight mt-1 mb-2">Select a source to monitor</h1>
                <p className="text-muted-foreground text-lg">
                    We'll monitor your signal activity on your chosen schedule and add any new data we find.
                </p>
            </div>

            <div className="space-y-10 pb-20">
                {sections.map((section, idx) => (section.items.length > 0 && (
                    <div key={idx}>
                        <h3 className="text-xl font-semibold mb-4 text-foreground/80">{section.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {section.items.map((item, itemIdx) => (
                                <Link
                                    key={itemIdx}
                                    href={`/signals/new/custom/${item.label.toLowerCase().replace(/ /g, '-')}${categoryParam}`}
                                    className="block h-full"
                                >
                                    <Card
                                        className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all duration-200 group border-muted h-full"
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
                            ))}
                        </div>
                    </div>
                )))}
            </div>
        </div>
    )
}