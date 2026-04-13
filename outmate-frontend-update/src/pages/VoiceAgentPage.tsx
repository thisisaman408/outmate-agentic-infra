import { useState } from "react";
import { BarChart3, Upload, Plus, Pause, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const stats = [
  { label: "Calls made", value: "247", sub: "+34 today", subColor: "text-green" },
  { label: "Meetings booked", value: "18", sub: "7.3% booking rate", subColor: "text-green" },
  { label: "Avg call duration", value: "2:14", sub: "min:sec", subColor: "text-muted-foreground" },
  { label: "Signal-triggered", value: "89", sub: "36% of all calls", subColor: "text-green" },
];

const triggers = [
  { icon: "$", label: "Funding round detected", desc: "Call within 24h of Series A–C announced", color: "bg-amber-light text-amber-text", on: true },
  { icon: "VP", label: "New VP / C-suite hired", desc: "GTM leader joins ICP company — call within 48h", color: "bg-indigo-light text-indigo-text", on: true },
  { icon: "H", label: "Hiring spike — Sales / GTM", desc: "Company posts 3+ GTM roles in 30 days", color: "bg-green-light text-green-text", on: true },
  { icon: "W", label: "Website visitor — pricing page", desc: "ICP company visits pricing, no demo booked", color: "bg-purple-light text-purple-text", on: false },
  { icon: "T", label: "Tech stack change", desc: "Competitor tool removed or replaced", color: "bg-destructive/10 text-destructive", on: false },
];

const recentCalls = [
  { name: "Sarah R.", company: "Stripe competitor", signal: "Funding signal", outcome: "Booked", outcomeColor: "bg-green-light text-green-text", duration: "3:42" },
  { name: "Marcus K.", company: "Series B SaaS", signal: "New VP Sales hired", outcome: "Call back", outcomeColor: "bg-amber-light text-amber-text", duration: "1:18" },
  { name: "Anita L.", company: "Fintech", signal: "GTM hiring spike", outcome: "Booked", outcomeColor: "bg-green-light text-green-text", duration: "4:07" },
  { name: "David J.", company: "HR Tech", signal: "Funding round", outcome: "Voicemail", outcomeColor: "bg-muted text-muted-foreground", duration: "0:28" },
  { name: "Priya W.", company: "Dev tools", signal: "Pricing page visit", outcome: "No answer", outcomeColor: "bg-destructive/10 text-destructive", duration: "0:00" },
  { name: "Tom C.", company: "E-commerce", signal: "Tech stack change", outcome: "Booked", outcomeColor: "bg-green-light text-green-text", duration: "2:55" },
];

const crmToggles = [
  { label: "Auto-create HubSpot contact after call", on: true },
  { label: "Log call transcript to CRM", on: true },
  { label: "Send follow-up email after voicemail", on: true },
  { label: "Add \"booked\" contacts to Slack alert", on: false },
];

const barHeights = [18, 32, 12, 40, 24, 36, 16, 28, 20];

export default function VoiceAgentPage() {
  const [agentActive, setAgentActive] = useState(true);
  const [triggerStates, setTriggerStates] = useState(triggers.map(t => t.on));
  const [crmStates, setCrmStates] = useState(crmToggles.map(t => t.on));

  const toggleTrigger = (i: number) => {
    setTriggerStates(prev => prev.map((v, idx) => idx === i ? !v : v));
  };
  const toggleCrm = (i: number) => {
    setCrmStates(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  return (
    <div className="p-6 max-w-[960px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green" />
            </span>
            <span className="text-xs font-medium text-green-text">Agent live</span>
          </div>
          <h1 className="text-[22px] font-medium text-foreground">Voice AI Agent</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Autonomous outbound calling — triggered by signals, powered by your GTM context</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm"><BarChart3 className="h-4 w-4 mr-1.5" />View analytics</Button>
          <Button variant="ghost" size="sm"><Upload className="h-4 w-4 mr-1.5" />Upload list</Button>
          <Button size="sm" className="bg-indigo text-primary-foreground hover:bg-indigo/90"><Plus className="h-4 w-4 mr-1.5" />New campaign</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className={`text-xs mt-0.5 ${s.subColor}`}>{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Agent config */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Agent configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice visualizer */}
            <div className="flex items-end justify-center gap-1 h-[52px]">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-sm bg-indigo"
                  style={{
                    height: `${h}px`,
                    animation: `voice-bar 1.2s ease-in-out ${i * 0.1}s infinite`,
                    ["--bar-height" as string]: `${h}px`,
                  }}
                />
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${agentActive ? "bg-green" : "bg-muted-foreground"}`} />
                <span className="font-medium">{agentActive ? "Agent is active" : "Agent paused"}</span>
                <span className="text-muted-foreground">· 0 calls in queue</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={agentActive ? "text-destructive hover:text-destructive" : "text-green hover:text-green"}
                onClick={() => setAgentActive(!agentActive)}
              >
                {agentActive ? <><Pause className="h-3.5 w-3.5 mr-1" />Pause</> : <><Play className="h-3.5 w-3.5 mr-1" />Resume</>}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Voice persona</label>
                <Select defaultValue="alex">
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alex">Alex (Neutral EN-US)</SelectItem>
                    <SelectItem value="priya">Priya (Warm EN-IN)</SelectItem>
                    <SelectItem value="james">James (Direct EN-GB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Call objective</label>
                <Select defaultValue="discovery">
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discovery">Book discovery call</SelectItem>
                    <SelectItem value="qualify">Qualify inbound</SelectItem>
                    <SelectItem value="reengage">Re-engage cold</SelectItem>
                    <SelectItem value="followup">Follow up on signal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max calls / day</label>
                <Input type="number" defaultValue={50} className="h-9 text-xs" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signal triggers */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Signal triggers</CardTitle>
            <p className="text-[10px] text-muted-foreground">Call fires when signal detected</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {triggers.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${t.color}`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.desc}</p>
                </div>
                <Switch
                  checked={triggerStates[i]}
                  onCheckedChange={() => toggleTrigger(i)}
                  className="scale-[0.8]"
                />
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-2">
              <Plus className="h-3.5 w-3.5 mr-1" />Add custom signal trigger
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Call script */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Call script</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-indigo">
              <Sparkles className="h-3.5 w-3.5 mr-1" />AI rewrite
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs defaultValue="opening">
              <TabsList className="h-8">
                <TabsTrigger value="opening" className="text-xs h-7 px-3">Opening</TabsTrigger>
                <TabsTrigger value="objection" className="text-xs h-7 px-3">Objection handling</TabsTrigger>
                <TabsTrigger value="closing" className="text-xs h-7 px-3">Closing</TabsTrigger>
              </TabsList>
              <TabsContent value="opening">
                <Textarea
                  className="min-h-[90px] text-xs bg-muted border-none resize-none"
                  defaultValue={`Hi {{first_name}}, this is Alex calling from Outmate.\n\nI saw that {{company_name}} recently {{signal_event}} — congratulations on that. We work with GTM teams at companies like yours who are scaling outbound...`}
                />
              </TabsContent>
              <TabsContent value="objection">
                <Textarea className="min-h-[90px] text-xs bg-muted border-none resize-none" defaultValue="I understand your concern. Many of our customers felt the same way before seeing how..." />
              </TabsContent>
              <TabsContent value="closing">
                <Textarea className="min-h-[90px] text-xs bg-muted border-none resize-none" defaultValue="Would it make sense to schedule a quick 15-minute call with our team to explore this further?" />
              </TabsContent>
            </Tabs>
            <div className="flex flex-wrap gap-1.5">
              {[
                { var: "first_name", color: "bg-indigo-light text-indigo-text" },
                { var: "company_name", color: "bg-indigo-light text-indigo-text" },
                { var: "signal_event", color: "bg-amber-light text-amber-text" },
                { var: "icp_pain", color: "bg-green-light text-green-text" },
              ].map(v => (
                <button key={v.var} className={`text-[10px] font-medium px-2 py-0.5 rounded ${v.color}`}>
                  + {v.var}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fallback if no answer</label>
              <Select defaultValue="voicemail">
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voicemail">Leave voicemail + send follow-up email</SelectItem>
                  <SelectItem value="retry">Try again in 4 hours</SelectItem>
                  <SelectItem value="linkedin">Add to LinkedIn sequence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Recent calls */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent calls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentCalls.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-light text-indigo-text flex items-center justify-center text-[10px] font-bold shrink-0">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{c.name} · {c.company}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{c.signal}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${c.outcomeColor}`}>{c.outcome}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{c.duration}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Performance */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Connected rate", value: 34, color: "bg-indigo" },
              { label: "Voicemail rate", value: 28, color: "bg-amber" },
              { label: "Booking rate", value: 7.3, color: "bg-green" },
              { label: "No answer", value: 38, color: "bg-muted-foreground" },
            ].map(p => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-medium text-foreground">{p.value}%</span>
                </div>
                <div className="h-1 rounded-sm bg-muted w-full">
                  <div className={`h-full rounded-sm ${p.color}`} style={{ width: `${p.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Call list source */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Call list source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select defaultValue="outmate">
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outmate">Outmate Database — live segment</SelectItem>
                <SelectItem value="csv">Uploaded CSV</SelectItem>
                <SelectItem value="hubspot">HubSpot list</SelectItem>
              </SelectContent>
            </Select>
            <div className="bg-muted rounded-md p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">ICP filter</p>
              <p className="text-xs text-foreground">Series A–C · SaaS · 20–200 employees · EU + US</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">In queue</p>
              <p className="text-lg font-bold text-foreground">163 <span className="text-xs font-normal text-muted-foreground">contacts</span></p>
            </div>
          </CardContent>
        </Card>

        {/* CRM + follow-up */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">CRM + follow-up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {crmToggles.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground">{t.label}</span>
                <Switch
                  checked={crmStates[i]}
                  onCheckedChange={() => toggleCrm(i)}
                  className="scale-[0.8] shrink-0"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
