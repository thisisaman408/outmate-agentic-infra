"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
    Activity, 
    Building2, 
    Calendar, 
    ExternalLink, 
    ArrowRight,
    TrendingUp,
    Globe,
    UserCircle,
    Clock
} from "lucide-react"
import { Watcher } from "./watcher-types"

interface WatcherDetailsDialogProps {
    watcher: Watcher | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function WatcherDetailsDialog({ watcher, open, onOpenChange }: WatcherDetailsDialogProps) {
    if (!watcher) return null

    const matches = watcher.type === 'event' ? (watcher as any).matches || [] : []
    const updates = (watcher.type === 'account' || watcher.type === 'lead') ? (watcher as any).recentUpdates || [] : []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                            watcher.type === 'event' ? 'bg-blue-500/10 text-blue-600' : 
                            watcher.type === 'account' ? 'bg-purple-500/10 text-purple-600' : 
                            'bg-orange-500/10 text-orange-600'
                        }`}>
                            {watcher.type === 'event' && <Activity className="h-5 w-5" />}
                            {watcher.type === 'account' && <Building2 className="h-5 w-5" />}
                            {watcher.type === 'lead' && <UserCircle className="h-5 w-5" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl">{watcher.name}</DialogTitle>
                            <DialogDescription>{watcher.description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs defaultValue="matches" className="flex-1 flex flex-col">
                        <div className="px-6 border-b">
                            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                <TabsTrigger 
                                    value="matches" 
                                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12 px-2"
                                >
                                    {watcher.type === 'event' ? 'Discovery Matches' : 'Real-time Updates'}
                                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                                        {watcher.type === 'event' ? matches.length : updates.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="analytics"
                                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-12 px-2"
                                >
                                    Analytics & Criteria
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="matches" className="flex-1 overflow-hidden p-0 m-0">
                            <ScrollArea className="h-[500px] p-6">
                                {watcher.type === 'event' ? (
                                    <div className="space-y-4">
                                        {matches.length === 0 ? (
                                            <EmptyState message="No discovery matches found yet. Try syncing!" />
                                        ) : (
                                            matches.map((match: any) => (
                                                <MatchItem key={match.id} match={match} />
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {updates.length === 0 ? (
                                            <EmptyState message="No updates detected recently." />
                                        ) : (
                                            updates.map((update: any, idx: number) => (
                                                <UpdateItem key={idx} update={update} />
                                            ))
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="analytics" className="flex-1 overflow-hidden p-6 m-0">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Configuration</h4>
                                    <div className="space-y-2">
                                        {watcher.type === 'event' && watcher.criteria && (
                                            Object.entries(watcher.criteria).map(([k, v]: any) => {
                                                const displayValue = Array.isArray(v) 
                                                    ? (v.length > 0 ? v.join(', ') : 'Any') 
                                                    : (v ? String(v) : 'Any');
                                                return (
                                                    <div key={k} className="flex justify-between border-b pb-2">
                                                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                                                        <span className="font-medium text-right ml-4">{displayValue}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {watcher.type === 'account' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between border-b pb-2">
                                                    <span className="text-muted-foreground">Domain</span>
                                                    <span className="font-medium text-primary">{watcher.accountDomain}</span>
                                                </div>
                                                <div className="flex justify-between border-b pb-2">
                                                    <span className="text-muted-foreground">Triggers</span>
                                                    <div className="flex flex-wrap gap-1 justify-end">
                                                        {(!watcher.triggers || watcher.triggers.length === 0) ? (
                                                            <span className="font-medium text-sm">All Activity</span>
                                                        ) : (
                                                            watcher.triggers.map((t: string) => (
                                                                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Health & Stats</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-muted/40 rounded-xl border">
                                            <TrendingUp className="h-4 w-4 text-green-600 mb-2" />
                                            <div className="text-2xl font-bold">{watcher.match_count ?? 0}</div>
                                            <div className="text-xs text-muted-foreground">Total Identified</div>
                                        </div>
                                        <div className="p-4 bg-muted/40 rounded-xl border">
                                            <Calendar className="h-4 w-4 text-blue-600 mb-2" />
                                            <div className="text-2xl font-bold">{watcher.new_matches_count ?? 0}</div>
                                            <div className="text-xs text-muted-foreground">New Today</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function MatchItem({ match }: { match: any }) {
    return (
        <div className="group border rounded-xl overflow-hidden hover:border-primary/50 transition-all bg-card shadow-sm">
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <img src={match.company.logo} className="w-10 h-10 rounded-lg bg-muted object-cover border" alt={match.company.name} />
                        <div>
                            <div className="font-bold flex items-center gap-2">
                                {match.company.name}
                                <Globe className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{match.company.domain}</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 h-8" asChild>
                        <a href={`https://${match.company.domain}`} target="_blank" rel="noopener noreferrer">
                            Website <ExternalLink className="h-3 w-3" />
                        </a>
                    </Button>
                </div>
                
                <div className="bg-muted/30 p-3 rounded-lg border border-border/60">
                    <div className="flex items-start gap-2 mb-1">
                        <Badge variant="secondary" className="bg-primary/10 text-primary capitalize text-[10px]">
                            {match.event.type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(match.event.date).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                        {match.event.description}
                    </p>
                </div>
            </div>
            <div className="bg-muted/10 px-4 py-2 flex justify-between items-center text-[10px] text-muted-foreground border-t">
                <span>Signal identified via Explorium Event Stream</span>
                <span 
                    className="flex items-center gap-1 hover:text-primary cursor-pointer transition-colors group-hover:translate-x-1 duration-300"
                    onClick={() => {
                        // Navigate to company profile page or search page pre-filtered by domain
                        const domain = match.company.domain;
                        if (domain) {
                            window.open(`/leads/companies/${domain}`, "_blank");
                        }
                    }}
                >
                    View Full Profile <ArrowRight className="h-2 w-2" />
                </span>
            </div>
        </div>
    )
}

function UpdateItem({ update }: { update: any }) {
    return (
        <div className="border p-4 rounded-xl bg-card space-y-2 hover:bg-muted/5 transition-colors border-l-4 border-l-primary/50">
            <div className="flex justify-between items-start">
                <Badge variant="outline" className="capitalize text-[10px] py-0 h-5">
                    {update.type.replace(/_/g, ' ')}
                </Badge>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(update.date).toLocaleString()}
                </div>
            </div>
            <p className="text-sm font-medium leading-relaxed">
                {update.description}
            </p>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 opacity-60">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">{message}</p>
        </div>
    )
}
