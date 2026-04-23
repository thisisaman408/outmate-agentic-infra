"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Activity, Building2, UserCheck, Save, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface EditWatcherDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onEditWatcher: (id: string, watcher: any) => void
    watcher: any | null
}

export function EditWatcherDialog({
    open,
    onOpenChange,
    onEditWatcher,
    watcher
}: EditWatcherDialogProps) {
    const [watcherType, setWatcherType] = useState<"event" | "account" | "lead">("event")
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        // Event-specific
        eventTypes: [] as string[],
        fundingStages: [] as string[],
        jobLevels: [] as string[],
        departments: [] as string[],
        companySize: [] as string[],
        // Account-specific
        accountName: "",
        accountDomain: "",
        accountTriggers: [] as string[],
        // Lead-specific
        leadName: "",
        leadTitle: "",
        leadCompany: "",
        leadEmail: "",
        leadTriggers: [] as string[],
        // Notifications
        emailNotifications: true,
        slackNotifications: false,
        webhookUrl: ""
    })

    useEffect(() => {
        if (watcher && open) {
            setWatcherType(watcher.type as "event" | "account" | "lead")
            setFormData({
                name: watcher.name || "",
                description: watcher.description || "",
                eventTypes: watcher.criteria?.event_type || [],
                fundingStages: watcher.criteria?.funding_stage || [],
                jobLevels: watcher.criteria?.job_level || [],
                departments: watcher.criteria?.department || [],
                companySize: watcher.criteria?.company_size || [],
                accountName: watcher.accountName || "",
                accountDomain: watcher.accountDomain || "",
                accountTriggers: watcher.triggers || [],
                leadName: watcher.leadName || "",
                leadTitle: watcher.leadTitle || "",
                leadCompany: watcher.leadCompany || "",
                leadEmail: watcher.leadEmail || "",
                leadTriggers: watcher.triggers || [],
                emailNotifications: watcher.notificationSettings?.email ?? true,
                slackNotifications: watcher.notificationSettings?.slack ?? false,
                webhookUrl: watcher.notificationSettings?.webhook || ""
            })
        }
    }, [watcher, open])

    const handleSubmit = () => {
        if (!watcher) return;
        
        if (watcherType === "event" && (!formData.eventTypes || formData.eventTypes.length === 0)) {
            alert("Please select at least one event type for the event watcher");
            return
        }

        let updatedWatcher: any = {
            ...watcher,
            name: formData.name,
            description: formData.description,
            type: watcherType,
            notificationSettings: {
                email: formData.emailNotifications,
                slack: formData.slackNotifications,
                webhook: formData.webhookUrl || undefined
            }
        }

        if (watcherType === "event") {
            updatedWatcher.criteria = {
                event_type: formData.eventTypes,
                funding_stage: formData.fundingStages,
                job_level: formData.jobLevels,
                department: formData.departments,
                company_size: formData.companySize
            }
        } else if (watcherType === "account") {
            updatedWatcher.accountName = formData.accountName
            updatedWatcher.accountDomain = formData.accountDomain
            updatedWatcher.triggers = formData.accountTriggers
        } else {
            updatedWatcher.leadName = formData.leadName
            updatedWatcher.leadTitle = formData.leadTitle
            updatedWatcher.leadCompany = formData.leadCompany
            updatedWatcher.leadEmail = formData.leadEmail
            updatedWatcher.triggers = formData.leadTriggers
        }

        onEditWatcher(watcher.id, updatedWatcher)
        onOpenChange(false)
    }

    const addItem = (field: keyof typeof formData, value: string) => {
        const currentArray = formData[field] as string[]
        if (!currentArray.includes(value)) {
            setFormData({
                ...formData,
                [field]: [...currentArray, value]
            })
        }
    }

    const removeItem = (field: keyof typeof formData, value: string) => {
        const currentArray = formData[field] as string[]
        setFormData({
            ...formData,
            [field]: currentArray.filter(item => item !== value)
        })
    }

    if (!watcher) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-4">
                    <DialogTitle className="text-2xl">Edit Watcher</DialogTitle>
                    <DialogDescription>
                        Update settings and real-time alerts for this watcher.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={watcherType} onValueChange={(v) => setWatcherType(v as any)} className="flex-1">
                    <div className="px-6 pointer-events-none opacity-80">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="event" className="gap-2">
                                <Activity className="h-4 w-4" />
                                Event Discovery
                            </TabsTrigger>
                            <TabsTrigger value="account" className="gap-2">
                                <Building2 className="h-4 w-4" />
                                Account Watching
                            </TabsTrigger>
                            <TabsTrigger value="lead" className="gap-2">
                                <UserCheck className="h-4 w-4" />
                                Lead Watching
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="h-[400px] px-6 py-4">
                        {/* Common Fields */}
                        <div className="space-y-4 mb-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Watcher Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Series A Funding Tracker"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe what this watcher does..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                />
                            </div>
                        </div>

                        <TabsContent value="event" className="mt-0 space-y-4">
                            <EventWatcherForm
                                formData={formData}
                                setFormData={setFormData}
                                addItem={addItem}
                                removeItem={removeItem}
                            />
                        </TabsContent>

                        <TabsContent value="account" className="mt-0 space-y-4">
                            <AccountWatcherForm
                                formData={formData}
                                setFormData={setFormData}
                                addItem={addItem}
                                removeItem={removeItem}
                            />
                        </TabsContent>

                        <TabsContent value="lead" className="mt-0 space-y-4">
                            <LeadWatcherForm
                                formData={formData}
                                setFormData={setFormData}
                                addItem={addItem}
                                removeItem={removeItem}
                            />
                        </TabsContent>

                        {/* Notification Settings */}
                        <div className="space-y-4 mt-6 pt-6 border-t" id="notification-settings">
                            <h4 className="font-medium text-sm">Notification Settings</h4>
                            
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                                </div>
                                <Switch
                                    checked={formData.emailNotifications}
                                    onCheckedChange={(checked) => 
                                        setFormData({ ...formData, emailNotifications: checked })
                                    }
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Messaging Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Post to a messaging channel</p>
                                </div>
                                <Switch
                                    checked={formData.slackNotifications}
                                    onCheckedChange={(checked) => 
                                        setFormData({ ...formData, slackNotifications: checked })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="webhook">Webhook URL (Optional)</Label>
                                <Input
                                    id="webhook"
                                    placeholder="https://your-domain.com/webhook"
                                    value={formData.webhookUrl}
                                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Receive real-time updates via webhook
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                </Tabs>

                <DialogFooter className="p-6 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={
                            !formData.name || 
                            (watcherType === "event" && (!formData.eventTypes || formData.eventTypes.length === 0))
                        }
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Event Watcher Form
function EventWatcherForm({ formData, setFormData, addItem, removeItem }: any) {
    const [selectedEventType, setSelectedEventType] = useState("")
    const [selectedFundingStage, setSelectedFundingStage] = useState("")
    const [selectedJobLevel, setSelectedJobLevel] = useState("")
    const [selectedDepartment, setSelectedDepartment] = useState("")

    const eventTypes = [
        "IPO Announcement", "New Funding Round", "New Investment", 
        "Merger & Acquisitions", "Cost Cutting", "Team Expansion", 
        "Team Reduction", "Product Launch", "Acquisition"
    ]

    const fundingStages = ["Seed", "Series A", "Series B", "Series C", "Series D+", "IPO"]
    const jobLevels = ["C-Level", "VP", "Director", "Manager", "Individual Contributor"]
    const departments = ["Sales", "Marketing", "Engineering", "Product", "Customer Success", "HR", "Finance"]

    // Quick preset buttons
    const applyPreset = (preset: string[]) => {
        setFormData({ ...formData, eventTypes: preset })
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Event Types <span className="text-destructive">*</span> Required</Label>
                    <p className="text-xs text-muted-foreground">Min. 1 event type needed</p>
                </div>
                
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Select
                            value={selectedEventType}
                            onValueChange={(val) => {
                                setSelectedEventType("")
                                if (val) addItem("eventTypes", val)
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent>
                                {eventTypes.filter(t => !formData.eventTypes.includes(t)).map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-1.5 items-center text-xs">
                        <span className="text-muted-foreground">Quick start:</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => applyPreset(["New Funding Round", "Merger & Acquisitions"])}
                        >
                            Funding & M&A
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => applyPreset(["Team Expansion", "Team Reduction", "Product Launch"])}
                        >
                            Company Growth
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.eventTypes.map((type: string) => (
                        <Badge key={type} variant="secondary" className="gap-1">
                            {type}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeItem("eventTypes", type)}
                            />
                        </Badge>
                    ))}
                </div>
                
                {formData.eventTypes.length === 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        ⚠️ Select at least one event type to discover companies. This defines what types of business activities you want to monitor (e.g., funding rounds, mergers, team growth).
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label>Funding Stages (Optional)</Label>
                <div className="flex gap-2">
                    <Select
                        value={selectedFundingStage}
                        onValueChange={(val) => {
                            setSelectedFundingStage("")
                            if (val) addItem("fundingStages", val)
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select funding stage" />
                        </SelectTrigger>
                        <SelectContent>
                            {fundingStages.filter(s => !formData.fundingStages.includes(s)).map(stage => (
                                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.fundingStages.map((stage: string) => (
                        <Badge key={stage} variant="secondary" className="gap-1">
                            {stage}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeItem("fundingStages", stage)}
                            />
                        </Badge>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Job Levels (Optional)</Label>
                    <div className="flex gap-2">
                        <Select
                            value={selectedJobLevel}
                            onValueChange={(val) => {
                                setSelectedJobLevel("")
                                if (val) addItem("jobLevels", val)
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                                {jobLevels.filter(l => !formData.jobLevels.includes(l)).map(level => (
                                    <SelectItem key={level} value={level}>{level}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {formData.jobLevels.map((level: string) => (
                            <Badge key={level} variant="secondary" className="gap-1 text-xs">
                                {level}
                                <X
                                    className="h-3 w-3 cursor-pointer"
                                    onClick={() => removeItem("jobLevels", level)}
                                />
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Departments (Optional)</Label>
                    <div className="flex gap-2">
                        <Select
                            value={selectedDepartment}
                            onValueChange={(val) => {
                                setSelectedDepartment("")
                                if (val) addItem("departments", val)
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select dept" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.filter(d => !formData.departments.includes(d)).map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {formData.departments.map((dept: string) => (
                            <Badge key={dept} variant="secondary" className="gap-1 text-xs">
                                {dept}
                                <X
                                    className="h-3 w-3 cursor-pointer"
                                    onClick={() => removeItem("departments", dept)}
                                />
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Account Watcher Form
function AccountWatcherForm({ formData, setFormData, addItem, removeItem }: any) {
    const [selectedTrigger, setSelectedTrigger] = useState("")

    const triggers = [
        "Website Content Changes", "Funding Events", "Job Changes", 
        "Technology Changes", "News Mentions", "Web Traffic Changes"
    ]

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="accountName">Company Name *</Label>
                <Input
                    id="accountName"
                    placeholder="e.g., Salesforce"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="accountDomain">Company Domain *</Label>
                <Input
                    id="accountDomain"
                    placeholder="e.g., salesforce.com"
                    value={formData.accountDomain}
                    onChange={(e) => setFormData({ ...formData, accountDomain: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label>Alert Triggers *</Label>
                <div className="flex gap-2">
                    <Select
                        value={selectedTrigger}
                        onValueChange={(val) => {
                            setSelectedTrigger("")
                            if (val) addItem("accountTriggers", val)
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select trigger type" />
                        </SelectTrigger>
                        <SelectContent>
                            {triggers.filter(t => !formData.accountTriggers.includes(t)).map(trigger => (
                                <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.accountTriggers.map((trigger: string) => (
                        <Badge key={trigger} variant="secondary" className="gap-1">
                            {trigger}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeItem("accountTriggers", trigger)}
                            />
                        </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Select events that will trigger alerts for this account
                </p>
            </div>
        </div>
    )
}

// Lead Watcher Form
function LeadWatcherForm({ formData, setFormData, addItem, removeItem }: any) {
    const [selectedTrigger, setSelectedTrigger] = useState("")

    const triggers = [
        "Role Change", "Company Change", "Job Anniversary",
        "Content Published", "Speaking Engagements", "Social Media Activity"
    ]

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="leadName">Lead Name *</Label>
                <Input
                    id="leadName"
                    placeholder="e.g., Sarah Chen"
                    value={formData.leadName}
                    onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="leadTitle">Job Title</Label>
                    <Input
                        id="leadTitle"
                        placeholder="e.g., VP of Marketing"
                        value={formData.leadTitle}
                        onChange={(e) => setFormData({ ...formData, leadTitle: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="leadCompany">Company</Label>
                    <Input
                        id="leadCompany"
                        placeholder="e.g., Stripe"
                        value={formData.leadCompany}
                        onChange={(e) => setFormData({ ...formData, leadCompany: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="leadEmail">Email (Optional)</Label>
                <Input
                    id="leadEmail"
                    type="email"
                    placeholder="email@company.com"
                    value={formData.leadEmail}
                    onChange={(e) => setFormData({ ...formData, leadEmail: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label>Alert Triggers *</Label>
                <div className="flex gap-2">
                    <Select
                        value={selectedTrigger}
                        onValueChange={(val) => {
                            setSelectedTrigger("")
                            if (val) addItem("leadTriggers", val)
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select trigger type" />
                        </SelectTrigger>
                        <SelectContent>
                            {triggers.filter(t => !formData.leadTriggers.includes(t)).map(trigger => (
                                <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.leadTriggers.map((trigger: string) => (
                        <Badge key={trigger} variant="secondary" className="gap-1">
                            {trigger}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => removeItem("leadTriggers", trigger)}
                            />
                        </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Select events that will trigger alerts for this lead
                </p>
            </div>
        </div>
    )
}
