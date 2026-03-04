"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Twitter, User, Hash, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CreateSignalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { name: string; type: string; target: string; maxResults?: number; frequency?: string }) => void
}

const xMonitoringOptions = [
    {
        id: 'x_mentions',
        name: 'Monitor Mentions from X',
        icon: Twitter,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        description: 'Track when your handle or keyword is mentioned on X/Twitter'
    },
    {
        id: 'x_profiles',
        name: 'Monitor Profiles on X by Topics',
        icon: User,
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        description: 'Follow specific profiles and track their posts by topics'
    },
    {
        id: 'x_hashtags',
        name: 'Monitor Hashtags on X',
        icon: Hash,
        color: 'text-green-500',
        bg: 'bg-green-50 dark:bg-green-900/20',
        description: 'Track conversations around specific hashtags'
    },
    {
        id: 'x_trends',
        name: 'Monitor Trending Topics on X',
        icon: TrendingUp,
        color: 'text-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        description: 'Stay updated with trending topics in your industry'
    },
]

export function CreateSignalDialog({ open, onOpenChange, onSubmit }: CreateSignalDialogProps) {
    const [step, setStep] = useState(1)
    const [selectedSource, setSelectedSource] = useState<string | null>(null)
    const [handleOrKeyword, setHandleOrKeyword] = useState("")
    const [maxResults, setMaxResults] = useState("20")
    const [name, setName] = useState("")

    const handleNext = () => {
        if (step === 1 && selectedSource) {
            setStep(2)
            // Default name
            const sourceName = xMonitoringOptions.find(t => t.id === selectedSource)?.name
            setName(`${sourceName}`)
        } else if (step === 2 && handleOrKeyword) {
            onSubmit({
                name,
                type: selectedSource!,
                target: handleOrKeyword,
                maxResults: parseInt(maxResults),
                frequency: 'monthly'
            })
            // Reset
            setStep(1)
            setSelectedSource(null)
            setHandleOrKeyword("")
            setMaxResults("20")
            setName("")
            onOpenChange(false)
        }
    }

    const handleBack = () => {
        if (step === 2) {
            setStep(1)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] gap-0 p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle className="text-xl">
                        {step === 1 ? "Add Custom Signal" : "Configure X/Twitter Monitor"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1 ? "Select a source to monitor" : "Set up your monitoring parameters"}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Twitter className="h-5 w-5 text-blue-500" />
                                <h3 className="font-semibold text-lg">X / Twitter</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {xMonitoringOptions.map((option) => {
                                    const Icon = option.icon
                                    const isSelected = selectedSource === option.id
                                    return (
                                        <div
                                            key={option.id}
                                            className={cn(
                                                "cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/30",
                                                isSelected ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border"
                                            )}
                                            onClick={() => setSelectedSource(option.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0", option.bg)}>
                                                    <Icon className={cn("h-5 w-5", option.color)} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm mb-1">{option.name}</div>
                                                    <div className="text-xs text-muted-foreground">{option.description}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="signal-name">Signal Name</Label>
                                <Input
                                    id="signal-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Track @competitor mentions"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="handle-keyword">
                                    {selectedSource === 'x_mentions' ? 'Handle or Keyword' :
                                        selectedSource === 'x_profiles' ? 'Profile Handle' :
                                            selectedSource === 'x_hashtags' ? 'Hashtag' :
                                                'Topic or Keyword'}
                                </Label>
                                <Input
                                    id="handle-keyword"
                                    value={handleOrKeyword}
                                    onChange={(e) => setHandleOrKeyword(e.target.value)}
                                    placeholder={
                                        selectedSource === 'x_mentions' ? "e.g. @yourbrand or 'AI automation'" :
                                            selectedSource === 'x_profiles' ? "e.g. @elonmusk" :
                                                selectedSource === 'x_hashtags' ? "e.g. #AI" :
                                                    "e.g. artificial intelligence"
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    {selectedSource === 'x_mentions' && "Enter a Twitter handle (with @) or keywords to track"}
                                    {selectedSource === 'x_profiles' && "Enter the Twitter handle to monitor"}
                                    {selectedSource === 'x_hashtags' && "Enter the hashtag to track (with or without #)"}
                                    {selectedSource === 'x_trends' && "Enter topics or keywords to monitor in trends"}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="max-results">Max Results per Run</Label>
                                <Select value={maxResults} onValueChange={setMaxResults}>
                                    <SelectTrigger id="max-results">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 results</SelectItem>
                                        <SelectItem value="10">10 results</SelectItem>
                                        <SelectItem value="15">15 results</SelectItem>
                                        <SelectItem value="20">20 results (recommended)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Maximum number of new mentions to fetch per run
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="frequency">Run Frequency</Label>
                                <Select value="monthly" disabled>
                                    <SelectTrigger id="frequency">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    How often this signal should run automatically
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t bg-muted/30 p-6 flex items-center justify-between">
                    <div className="flex-1">
                        {step === 2 && (
                            <Button variant="ghost" onClick={handleBack}>
                                ← Back
                            </Button>
                        )}
                    </div>
                    <Button
                        onClick={handleNext}
                        disabled={step === 1 ? !selectedSource : !handleOrKeyword || !name}
                        className="ml-auto"
                    >
                        {step === 1 ? "Next" : "Create Signal"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}