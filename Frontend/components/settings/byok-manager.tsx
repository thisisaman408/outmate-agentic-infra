"use client"

import { useState, useEffect } from "react"
import { 
    Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog"
import { 
    Key, RefreshCw, Trash2, CheckCircle2, XCircle, AlertCircle, 
    History, ExternalLink, Loader2, Signal, Activity
} from "lucide-react"
import { integrationsApi, type IntegrationStatus, type UsageLog } from "@/lib/api/integrations"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

export function BYOKManager() {
    const { toast } = useToast()
    const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isTesting, setIsTesting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    
    // Modal state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<string | null>(null)
    const [keyInput, setKeyInput] = useState("")
    const [isRotating, setIsRotating] = useState(false)
    const [testResult, setTestResult] = useState<boolean | null>(null)

    // Logs state
    const [logsOpen, setLogsOpen] = useState(false)
    const [usageLogs, setUsageLogs] = useState<UsageLog[]>([])

    useEffect(() => {
        fetchStatus()
    }, [])

    const fetchStatus = async () => {
        try {
            const data = await integrationsApi.getIntegrations()
            setIntegrations(data)
        } catch (error) {
            toast({ title: "Error", description: "Failed to load integrations", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenDialog = (service: string, rotate: boolean = false) => {
        setSelectedService(service)
        setKeyInput("")
        setIsRotating(rotate)
        setTestResult(null)
        setDialogOpen(true)
    }

    const handleTest = async () => {
        if (!selectedService || !keyInput) return
        setIsTesting(true)
        setTestResult(null)
        try {
            const success = await integrationsApi.testConnection(selectedService, keyInput)
            setTestResult(success)
            toast({
                title: success ? "Success" : "Failed",
                description: success ? "Connection active" : "Key rejected by provider",
                variant: success ? "default" : "destructive"
            })
        } catch (error) {
            setTestResult(false)
        } finally {
            setIsTesting(false)
        }
    }

    const handleSave = async () => {
        if (!selectedService || !keyInput) return
        setIsSaving(true)
        try {
            await integrationsApi.updateKey(selectedService, keyInput, isRotating)
            toast({ title: "Success", description: "Integration updated successfully" })
            setDialogOpen(false)
            fetchStatus()
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const handleRevoke = async (service: string) => {
        if (!confirm(`Are you sure you want to revoke your ${service} key? This will fall back to Outmate credits.`)) return
        try {
            await integrationsApi.revokeKey(service)
            toast({ title: "Revoked", description: `Personal key for ${service} removed` })
            fetchStatus()
        } catch (error) {
            toast({ title: "Error", description: "Failed to revoke key", variant: "destructive" })
        }
    }

    const showLogs = async (service?: string) => {
        setLogsOpen(true)
        try {
            const logs = await integrationsApi.getUsageLogs(service)
            setUsageLogs(logs)
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch logs", variant: "destructive" })
        }
    }

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Connected Integrations</CardTitle>
                            <CardDescription>Bring Your Own Key (BYOK) for direct provider access and higher rate limits.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => showLogs()} className="gap-2">
                            <History className="h-4 w-4" /> Global Usage Log
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Service</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Used</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {integrations.map((int) => (
                                <TableRow key={int.service}>
                                    <TableCell className="font-bold capitalize">{int.service.replace("_", ".")}</TableCell>
                                    <TableCell>
                                        <Badge variant={int.mode === "Your Key" ? "default" : "secondary"}>
                                            {int.mode}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {int.status === "connected" ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm font-medium">Active</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                                    <span className="text-sm font-medium uppercase">{int.status}</span>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs font-mono">
                                        {int.last_used ? formatDistanceToNow(new Date(int.last_used), { addSuffix: true }) : "Never"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => showLogs(int.service)} title="Usage Logs">
                                                <Activity className="h-4 w-4" />
                                            </Button>
                                            {int.mode === "Your Key" ? (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(int.service, true)} className="gap-2">
                                                        <RefreshCw className="h-3 w-3" /> Rotate
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRevoke(int.service)} className="text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button size="sm" onClick={() => handleOpenDialog(int.service)} className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 text-xs">
                                                    <Key className="h-3 w-3" /> Add Key
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Config Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="capitalize">{isRotating ? `Rotate ${selectedService} Key` : `Connect ${selectedService}`}</DialogTitle>
                        <DialogDescription>
                            {isRotating ? 
                                "Updating your key. The old key remains active for 30s to ensure zero downtime." : 
                                `Enter your personal ${selectedService} API key. We will test it before saving.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Input 
                                type="password" 
                                placeholder="sk-..." 
                                value={keyInput} 
                                onChange={(e) => setKeyInput(e.target.value)} 
                                className="font-mono text-sm"
                            />
                            {testResult === true && <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connection validated!</p>}
                            {testResult === false && <p className="text-xs text-destructive font-bold flex items-center gap-1"><XCircle className="h-3 w-3" /> Validation failed. Check key.</p>}
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleTest} disabled={isTesting || !keyInput}>
                            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test Connection"}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || testResult !== true} className="bg-green-600 hover:bg-green-700 font-bold">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRotating ? "Rotate Key" : "Save Integration")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Logs Dialog */}
            <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-indigo-600" />
                            Security Audit & Usage Log
                        </DialogTitle>
                        <DialogDescription>Recent API activity and tamper-proof logs for your integrations.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Result</TableHead>
                                    <TableHead>Latency</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usageLogs.map((log, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-medium text-xs uppercase">{log.service}</TableCell>
                                        <TableCell>
                                            <Badge variant={log.success ? "secondary" : "destructive"} className="text-[9px] uppercase px-1 py-0 h-4">
                                                {log.success ? "Success" : "Error"} {log.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-mono">{log.latency}ms</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
