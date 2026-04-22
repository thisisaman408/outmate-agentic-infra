"use client"

import { Suspense } from "react"
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
            { label: "Monitor post audiences on social networks", icon: Users, color: "text-blue-500" },
            { label: "Monitor Google News RSS Feed", icon: Rss, color: "text-orange-600" },
        ]
    },
    {
        title: "X / Twitter Batch",
        items: [
            { label: "Monitor mentions from X", icon: Twitter, color: "text-sky-500" },
            { label: "Monitor profiles on X by topic", icon: User, color: "text-sky-600" },
        ]
    },
    {
        title: "Media & Influencers",
        items: [
            { label: "Monitor for YouTube videos or creators", icon: Youtube, color: "text-red-600" },
        ]
    },
    {
        title: "GitHub",
        items: [
            { label: "Monitor stargazers on GitHub", icon: Github, color: "text-slate-800 dark:text-slate-200" },
            { label: "Monitor forks on GitHub", icon: GitFork, color: "text-slate-800 dark:text-slate-400" },
        ]
    },
    {
        title: "Other",
        items: [
            { label: "Monitor RSS Feed", icon: Rss, color: "text-orange-500" },
            { label: "Monitor Google Search results", icon: Search, color: "text-blue-500" },
        ]
    }
]

function CustomSignalPageContent() {
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

export default function CustomSignalPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomSignalPageContent />
        </Suspense>
    )
}
