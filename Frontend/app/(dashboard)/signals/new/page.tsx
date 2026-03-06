"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Briefcase, UserPlus, FileText, TrendingUp, Newspaper, Share2, Megaphone, Globe, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

const signalTypes = [
    {
        id: 'job_change',
        title: 'Job Change',
        description: 'Track when people change jobs',
        icon: Briefcase,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
    },
    {
        id: 'new_hire',
        title: 'New Hire',
        description: 'Track new employees joining companies',
        icon: UserPlus,
        color: 'text-green-500',
        bg: 'bg-green-500/10',
    },
    {
        id: 'job_posting',
        title: 'Job Posting',
        description: 'Monitor new job openings',
        icon: FileText,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
    },
    {
        id: 'promotion',
        title: 'Promotion',
        description: 'Track internal promotions',
        icon: TrendingUp,
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
    },
    {
        id: 'news_funding',
        title: 'News & Funding',
        description: 'Track news mentions and funding rounds',
        icon: Newspaper,
        color: 'text-red-500',
        bg: 'bg-red-500/10',
    },
    {
        id: 'linkedin_post',
        title: 'LinkedIn Post',
        description: 'Monitor posts on LinkedIn',
        icon: Share2,
        color: 'text-blue-700',
        bg: 'bg-blue-700/10',
    },
    {
        id: 'brand_mentions',
        title: 'Brand Mentions',
        description: 'Track mentions of your brand',
        icon: Megaphone,
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
    },
    {
        id: 'web_intent',
        title: 'Web Intent',
        description: 'Track website visits and intent',
        icon: Globe,
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
    },
    {
        id: 'custom',
        title: 'Custom',
        description: 'Create a custom signal from various sources',
        icon: Settings2,
        color: 'text-gray-500',
        bg: 'bg-gray-500/10',
    }
]

export default function NewSignalPage() {
    const router = useRouter()

    const handleSelect = (id: string) => {
        // All signal types route through the custom flow
        router.push('/signals/new/custom')
    }

    return (
        <div className="container mx-auto py-10 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Create New Signal</h1>
                <p className="text-muted-foreground">Select the type of signal you want to track.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {signalTypes.map((signal) => (
                    <Card
                        key={signal.id}
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group border-muted"
                        onClick={() => handleSelect(signal.id)}
                    >
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <div className={cn("p-2 rounded-lg transition-colors group-hover:bg-opacity-80", signal.bg)}>
                                <signal.icon className={cn("w-6 h-6", signal.color)} />
                            </div>
                            <CardTitle className="text-lg font-semibold">{signal.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-sm">{signal.description}</CardDescription>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}