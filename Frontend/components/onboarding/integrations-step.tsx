"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    CheckCircle2,
    Circle,
    Mail,
    Slack,
    Database,
    Send,
    AlertTriangle,
    Loader2,
    ArrowRight,
    ExternalLink,
} from "lucide-react"
import { authService } from "@/lib/auth"

interface Integration {
    id: string
    name: string
    icon: any
    description: string
    priority: "must-have" | "recommended"
    type: "oauth" | "api_key"
    connected: boolean
    skipped: boolean
}

interface IntegrationsStepProps {
    onStatusChange: (connectedCount: number) => void
}

export function IntegrationsStep({ onStatusChange }: IntegrationsStepProps) {
    const [integrations, setIntegrations] = useState<Integration[]>([
        { id: "gmail", name: "Gmail", icon: Mail, description: "Required for sending automated outreach emails.", priority: "must-have", type: "oauth", connected: false, skipped: false },
        { id: "slack", name: "Slack", icon: Slack, description: "Get real-time alerts when leads visit your website.", priority: "must-have", type: "oauth", connected: false, skipped: false },
        { id: "hubspot", name: "HubSpot", icon: Database, description: "Sync companies and contacts directly to your CRM.", priority: "recommended", type: "oauth", connected: false, skipped: false },
        { id: "salesforce", name: "Salesforce", icon: Database, description: "Advanced enterprise CRM integration.", priority: "recommended", type: "oauth", connected: false, skipped: false },
        { id: "outreach", name: "Instantly / Smartlead", icon: Send, description: "Connect your dedicated outreach platform.", priority: "recommended", type: "api_key", connected: false, skipped: false },
    ])

    const [isTesting, setIsTesting] = useState<string | null>(null)
    const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, { service: string, key: string }>>({
        outreach: { service: "instantly", key: "" }
    })
    const [showWarning, setShowWarning] = useState(false)

    const connectedCount = integrations.filter(i => i.connected).length
    
    // Initial status fetch
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch("/api/v1/integrations/status", {
                    headers: authService.getAuthHeaders()
                })
                if (response.ok) {
                    const data = await response.json()
                    const updated = integrations.map(item => ({
                        ...item,
                        connected: data.integrations[item.id]?.connected || false,
                        skipped: data.integrations[item.id]?.skipped || false
                    }))
                    setIntegrations(updated)
                    onStatusChange(data.connected_count)
                }
            } catch (err) {
                console.error("Failed to fetch integration status:", err)
            }
        }
        fetchStatus()
    }, [])

    const handleConnect = async (int: Integration) => {
        if (int.type === "oauth") {
            // Save state for return
            localStorage.setItem("onboarding_return_step", "integrations")
            
            if (int.id === "gmail") {
                // Get Google Auth URL
                const resp = await fetch("/api/v1/auth/google/auth-url?terms_accepted=true")
                const data = await resp.json()
                window.location.href = data.auth_url
            } else if (int.id === "slack") {
                // Placeholder for Slack OAuth redirect
                // In production, this would go to /api/v1/integrations/slack/authorize
                window.location.href = "/api/v1/auth/google/auth-url" // Temporary placeholder
            } else {
                // CRM OAuth
                alert(`Redirecting to ${int.name} OAuth...`)
            }
        }
    }

    const testConnection = async (id: string) => {
        setIsTesting(id)
        try {
            if (id === "outreach") {
                const input = apiKeyInputs.outreach
                const response = await fetch("/api/v1/integrations/test/outreach", {
                    method: "POST",
                    headers: authService.getAuthHeaders(),
                    body: JSON.stringify({
                        service: input.service,
                        api_key: input.key
                    })
                })
                const result = await response.json()
                if (result.success) {
                    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: true } : i))
                } else {
                    alert(result.message || "Connection failed")
                }
            }
        } catch (err) {
            alert("Connection error")
        } finally {
            setIsTesting(null)
        }
    }

    const handleSkip = async (id: string) => {
        try {
            await fetch("/api/v1/integrations/skip", {
                method: "POST",
                headers: authService.getAuthHeaders(),
                body: JSON.stringify({ service: id })
            })
            setIntegrations(prev => prev.map(i => i.id === id ? { ...i, skipped: true } : i))
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="bg-white rounded-xl border p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl font-extrabold text-[#111827]">Connect your tech stack</h3>
                    <p className="text-sm font-semibold text-slate-600">Integrate with your tools to automate outreach and tracking.</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-indigo-600">{connectedCount}</span>
                    <span className="text-sm text-muted-foreground mr-1">/5</span>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Connected</p>
                </div>
            </div>

            <div className="space-y-4 mb-8">
                {integrations.map((int) => (
                    <div key={int.id} className={`p-4 rounded-xl border transition-all ${int.connected ? "bg-green-50/50 border-green-200" : "bg-gray-50/30 border-gray-100"}`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${int.connected ? "bg-green-100 text-green-600" : "bg-white border shadow-sm text-gray-400"}`}>
                                <int.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-sm">{int.name}</span>
                                    {int.priority === "must-have" && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-100 uppercase">Must-have</Badge>
                                    )}
                                    {int.connected && <span className="text-green-600 text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 font-bold uppercase ml-auto">Connected</span>}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{int.description}</p>
                                
                                {!int.connected && (
                                    <div className="mt-3 flex items-center gap-2">
                                        {int.type === "oauth" ? (
                                            <Button size="sm" variant={int.priority === "must-have" ? "default" : "outline"} className="h-8 text-xs gap-2" onClick={() => handleConnect(int)}>
                                                Connect {int.name}
                                                <ExternalLink className="h-3 w-3" />
                                            </Button>
                                        ) : (
                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <select 
                                                        className="h-8 border rounded px-2 text-xs bg-white"
                                                        value={apiKeyInputs.outreach.service}
                                                        onChange={e => setApiKeyInputs({...apiKeyInputs, outreach: {...apiKeyInputs.outreach, service: e.target.value}})}
                                                    >
                                                        <option value="instantly">Instantly</option>
                                                        <option value="smartlead">Smartlead</option>
                                                    </select>
                                                    <Input 
                                                        placeholder="Paste API Key here..." 
                                                        className="h-8 text-xs bg-white" 
                                                        value={apiKeyInputs.outreach.key}
                                                        onChange={e => setApiKeyInputs({...apiKeyInputs, outreach: {...apiKeyInputs.outreach, key: e.target.value}})}
                                                    />
                                                    <Button size="sm" className="h-8 text-xs font-bold" onClick={() => testConnection(int.id)} disabled={isTesting === int.id}>
                                                        {isTesting === int.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {!int.connected && !int.skipped && (
                                            <Button variant="ghost" size="sm" className="h-8 text-[11px] text-muted-foreground hover:bg-gray-100" onClick={() => handleSkip(int.id)}>
                                                Set up later
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showWarning && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 animate-in zoom-in-95">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-amber-900">Are you sure?</h4>
                        <p className="text-[12px] text-amber-800 leading-relaxed">
                            Without <span className="font-bold text-amber-950">Gmail</span>, automated outreach won't work. Connecting these tools now ensures your GTM engine is ready immediately.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" className="text-muted-foreground text-xs" onClick={() => setShowWarning(true)}>
                    Skip all integrations
                </Button>
                
                <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-10 h-10 font-bold gap-2">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
