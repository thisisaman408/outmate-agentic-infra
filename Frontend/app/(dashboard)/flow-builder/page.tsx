"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Plus, 
  Workflow, 
  Zap, 
  Database, 
  Bot, 
  Send, 
  ChevronRight, 
  Settings2,
  MoreVertical,
  Activity,
  ArrowLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export default function FlowBuilderPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  
  const steps = [
    { id: "trigger", title: "Trigger", icon: <Zap className="h-4 w-4" />, description: "When an event occurs..." },
    { id: "enrich", title: "Enrich", icon: <Database className="h-4 w-4" />, description: "Enrich with 15+ sources" },
    { id: "research", title: "Research", icon: <Bot className="h-4 w-4" />, description: "AI Agent research" },
    { id: "send", title: "Action", icon: <Send className="h-4 w-4" />, description: "Send to GTM stack" }
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <Workflow className="h-3.5 w-3.5 text-primary" />
              New Flow Builder
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Unsaved Draft</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Save Draft</Button>
          <Button size="sm" className="bg-gradient-to-r from-primary to-violet-600 border-none shadow-md">
            Activate Flow
          </Button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 grid grid-cols-[300px_1fr_300px] bg-muted/20">
        {/* Left Library */}
        <div className="border-r bg-background p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">Triggers</h3>
            <div className="grid grid-cols-1 gap-2">
              {['Hiring Signal', 'Funding Round', 'Domain Change', 'Tech Install'].map((t) => (
                <div key={t} className="p-3 rounded-lg border bg-muted/10 hover:bg-muted/30 cursor-pointer transition-all border-dashed">
                  <p className="text-xs font-medium">{t}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">AI Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              {['Company Profile', 'Person Research', 'Draft Email', 'Find Similar'].map((t) => (
                <div key={t} className="p-3 rounded-lg border bg-muted/10 hover:bg-muted/30 cursor-pointer transition-all border-dashed">
                  <p className="text-xs font-medium">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="p-8 flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-2xl space-y-4">
            {steps.map((step, i) => (
              <div key={step.id} className="flex flex-col items-center">
                <Card className={cn(
                  "w-full border-2 transition-all cursor-pointer group",
                  activeStep === i ? "border-primary ring-4 ring-primary/5" : "border-border/60 hover:border-primary/40"
                )} onClick={() => setActiveStep(i)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                      activeStep === i ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{step.title}</h4>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-20" />
                  </CardContent>
                </Card>
                {i < steps.length - 1 && (
                  <div className="h-8 w-0.5 bg-border/60 my-1 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-border" />
                  </div>
                )}
              </div>
            ))}
            <Button variant="ghost" className="w-full border-2 border-dashed h-12 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5">
              <Plus className="h-4 w-4 mr-2" />
              Add Flow Step
            </Button>
          </div>
        </div>

        {/* Right Configuration */}
        <div className="border-l bg-background p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-1">Configuration</h3>
            <p className="text-[11px] text-muted-foreground uppercase">{steps[activeStep].title} Settings</p>
          </div>
          
          <div className="space-y-4">
             <div className="space-y-1.5">
               <label className="text-xs font-medium opacity-60">Step Name</label>
               <Input placeholder="Enter name..." defaultValue={steps[activeStep].title} className="text-xs h-8" />
             </div>
             <div className="space-y-1.5">
               <label className="text-xs font-medium opacity-60">Execution Mode</label>
               <div className="flex gap-2">
                 <Badge className="bg-primary/10 text-primary border-primary/20">Sequential</Badge>
                 <Badge variant="outline" className="opacity-50">Parallel</Badge>
               </div>
             </div>
             <div className="space-y-1.5 pt-4">
               <div className="rounded-lg border bg-violet-500/5 p-4 border-violet-500/20">
                 <div className="flex items-center gap-2 mb-2">
                   <Activity className="h-3 w-3 text-violet-500" />
                   <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">AI Intelligence</span>
                 </div>
                 <p className="text-[11px] text-violet-900/60 leading-relaxed italic">
                    "This step will use GPT-4o to analyze company signals before proceeding to personalization."
                 </p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
