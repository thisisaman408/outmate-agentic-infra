import { useState, useRef, useEffect } from "react";
import {
  Mic, MicOff, Paperclip, ArrowUp,
  Bot, Search, Zap, Mail, Sparkles,
  Play, Settings, Code, Bug, TestTube,
  Plus, MoreHorizontal, ChevronRight, GripVertical,
  Check,
  Filter, Clock, MessageSquare, Database,
  Globe, FileText, Users, BarChart3,
  Linkedin, Phone, Target, Brain,
  Webhook, GitBranch, RefreshCw,
  Activity, CheckCircle2, Circle,
  RotateCcw, Copy, ExternalLink,
  Share2, Bell, BellRing, Download,
  Link, ToggleLeft, ToggleRight, AlertTriangle,
  PanelRightOpen, Layers, Send
} from "lucide-react";

/* ── @ mention agents ─────────────────────── */
const mentionAgents = [
  { emoji: "🤖", name: "AI SDR", category: "Outbound Execution" },
  { emoji: "🗂", name: "Prospect Brief", category: "Research & Enrichment" },
  { emoji: "📡", name: "Intent Radar", category: "Signal Detection" },
  { emoji: "✉️", name: "Email Writer", category: "Outbound Execution" },
  { emoji: "💎", name: "Funding Scout", category: "Signal Detection" },
];

/* ── copilot conversation ─────────────────── */
interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  promptChange?: { title: string; applied: boolean };
  followUp?: string[];
}

const initialConversation: CopilotMessage[] = [
  {
    id: "1", role: "assistant",
    content: "I've analyzed your **ICP Outbound Agent** pipeline. Here's the current workflow:\n\n1. **Signal Detection**: Monitor hiring + funding signals for ICP companies\n2. **Waterfall Enrichment**: Multi-provider data enrichment for contacts\n3. **Lead Scoring**: AI-powered qualification with 80+ threshold\n4. **Email Sequence**: 5-step personalized outreach\n5. **CRM Update**: Push qualified leads to Salesforce\n\nThe pipeline looks solid. Would you like to optimize any specific step?",
    followUp: ["I want to add a LinkedIn touchpoint before email", "How can I improve the lead scoring accuracy?", "Add a condition to skip already-contacted leads"],
  },
  { id: "2", role: "user", content: "I want to make the enrichment step use fewer credits while maintaining data quality" },
  {
    id: "3", role: "assistant",
    content: "I'll optimize the **Waterfall Enrichment** step to reduce credit usage.\n\n### Solution\n\nI'll update the enrichment cascade to prioritize free/low-cost providers first:\n\n- ✅ **Tier 1** (Free): LinkedIn public data, company website scraping\n- ✅ **Tier 2** (Low cost): Clearbit Reveal, Hunter.io\n- ✅ **Tier 3** (Premium): ZoomInfo, Lusha — only if Tier 1+2 miss\n\nThis should reduce credit consumption by **~40%** while keeping match rates above 85%.",
    promptChange: { title: "Optimize Waterfall Enrich...", applied: true },
    followUp: ["What's the expected match rate with this setup?", "Can I set a per-lead credit budget cap?", "Show me the enrichment provider priority order"],
  },
];

/* ── canvas nodes ─────────────────────────── */
interface CanvasNode {
  id: string;
  label: string;
  type: "trigger" | "action" | "condition" | "output";
  emoji: string;
  color: string;
  y: number;
  desc: string;
  integration?: string;
  outputPreview?: string;
}

const initialNodes: CanvasNode[] = [
  { id: "n1", label: "Workflow Input Settings", type: "trigger", emoji: "⚡", color: "bg-teal-light", y: 20, desc: "ICP match trigger · Hiring + Funding signals", integration: "Signal Engine", outputPreview: '{"matches": 12, "source": "LinkedIn Jobs"}' },
  { id: "n2", label: "Waterfall Enrich", type: "action", emoji: "✨", color: "bg-indigo-light", y: 170, desc: "Multi-provider data enrichment", integration: "Clearbit + Hunter", outputPreview: '{"enriched": 12, "match_rate": 0.92}' },
  { id: "n3", label: "Lead Scoring", type: "condition", emoji: "🎯", color: "bg-green-light", y: 320, desc: "Score ≥ 80 → qualified path", integration: "AI Scorer", outputPreview: '{"qualified": 8, "avg_score": 84.2}' },
  { id: "n4", label: "Email Sequence", type: "action", emoji: "✉️", color: "bg-purple-light", y: 470, desc: "5-step personalized outreach", integration: "Gmail", outputPreview: '{"drafting": 8, "template": "outbound-v3"}' },
  { id: "n5", label: "CRM Update", type: "output", emoji: "🗂", color: "bg-teal-light", y: 620, desc: "Push to Salesforce pipeline", integration: "Salesforce" },
];

/* ── floating toolbar tools ───────────────── */
const toolbarCategories = [
  {
    name: "Actions",
    items: [
      { label: "Enrich Contact", icon: Sparkles, color: "bg-indigo-light text-indigo" },
      { label: "Send Email", icon: Mail, color: "bg-purple-light text-purple-text" },
      { label: "Send SMS", icon: Phone, color: "bg-teal-light text-teal-text" },
      { label: "LinkedIn Msg", icon: Linkedin, color: "bg-indigo-light text-indigo" },
      { label: "Update CRM", icon: Database, color: "bg-green-light text-green-text" },
      { label: "Web Research", icon: Globe, color: "bg-orange-light text-orange-text" },
      { label: "AI Generate", icon: Brain, color: "bg-purple-light text-purple-text" },
      { label: "Slack Notify", icon: MessageSquare, color: "bg-green-light text-green-text" },
    ],
  },
  {
    name: "Logic",
    items: [
      { label: "If / Else", icon: GitBranch, color: "bg-amber-light text-amber-text" },
      { label: "Filter", icon: Filter, color: "bg-muted text-muted-foreground" },
      { label: "Loop", icon: RefreshCw, color: "bg-teal-light text-teal-text" },
      { label: "Wait", icon: Clock, color: "bg-muted text-muted-foreground" },
    ],
  },
  {
    name: "Triggers",
    items: [
      { label: "Signal", icon: Zap, color: "bg-amber-light text-amber-text" },
      { label: "Schedule", icon: Clock, color: "bg-muted text-muted-foreground" },
      { label: "Webhook", icon: Webhook, color: "bg-orange-light text-orange-text" },
      { label: "Manual", icon: Play, color: "bg-green-light text-green-text" },
    ],
  },
  {
    name: "Outputs",
    items: [
      { label: "Add to List", icon: Users, color: "bg-indigo-light text-indigo" },
      { label: "Report", icon: BarChart3, color: "bg-purple-light text-purple-text" },
      { label: "Export CSV", icon: FileText, color: "bg-muted text-muted-foreground" },
    ],
  },
];

/* ── notifications ────────────────────────── */
const notifications = [
  { id: 1, type: "success" as const, msg: "Agent deployed successfully", time: "2m ago", read: false },
  { id: 2, type: "info" as const, msg: "12 new ICP matches found", time: "5m ago", read: false },
  { id: 3, type: "warning" as const, msg: "Credit usage at 78%", time: "1h ago", read: true },
];

export default function AgentStudioPage() {
  const [copilotMode, setCopilotMode] = useState<"build" | "debug" | "test">("build");
  const [input, setInput] = useState("");
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversation, setConversation] = useState<CopilotMessage[]>(initialConversation);
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 70) + "px";
    }
  }, [input]);
  useEffect(() => { if (input.endsWith("@")) setShowMentionPicker(true); }, [input]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation]);

  const insertMention = (name: string) => {
    setInput(prev => (prev.endsWith("@") ? prev.slice(0, -1) : prev) + `@${name} `);
    setShowMentionPicker(false);
    textareaRef.current?.focus();
  };

  const sendMessage = (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    setConversation(prev => [...prev, { id: Date.now().toString(), role: "user", content }]);
    setInput("");
    setShowMentionPicker(false);
    setTimeout(() => {
      setConversation(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant",
        content: "Great question! I'll analyze the current configuration and suggest optimizations.\n\n### Analysis\n\n- **Signal quality**: 73% conversion rate\n- **Enrichment coverage**: 89% of your ICP\n- **Sequence performance**: Open rates 34%, reply 8%\n\nI recommend adding a **LinkedIn warm-up** step before the email sequence to increase reply rates by ~15%.",
        promptChange: { title: "Add LinkedIn warm-up step", applied: false },
        followUp: ["Apply this change to my pipeline", "What would the new sequence look like?", "Show me comparable benchmarks"],
      }]);
    }, 1200);
  };

  const toggleRecording = () => {
    setIsRecording(r => !r);
    if (!isRecording) setTimeout(() => { setInput("Add a LinkedIn touchpoint before the email sequence"); setIsRecording(false); }, 2000);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ═══════ LEFT: COPILOT ═══════ */}
      <div className="w-[320px] border-r border-border bg-card flex flex-col shrink-0">
        {/* header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Copilot</h2>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-light text-purple-text">Beta</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="New chat"><Plus className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Settings className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* chat */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {conversation.map(msg => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-muted rounded-2xl rounded-br-md px-3.5 py-2.5 max-w-[90%]">
                    <p className="text-[11px] leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-[11px] leading-[1.7] text-foreground">
                    {msg.content.split("\n").map((line, li) => {
                      if (line.startsWith("### ")) return <p key={li} className="text-[12px] font-bold mt-3 mb-1">{line.replace("### ", "")}</p>;
                      if (line.startsWith("- **") || line.startsWith("- ✅")) return <p key={li} className="ml-2 my-0.5">{line}</p>;
                      if (line.trim() === "") return <br key={li} />;
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return <p key={li} className="my-0.5">{parts.map((part, pi) => part.startsWith("**") && part.endsWith("**") ? <strong key={pi}>{part.slice(2, -2)}</strong> : <span key={pi}>{part}</span>)}</p>;
                    })}
                  </div>
                  {msg.promptChange && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground">Prompt Changes</p>
                        <p className="text-[11px] font-medium truncate">{msg.promptChange.title}</p>
                      </div>
                      {msg.promptChange.applied
                        ? <span className="flex items-center gap-1 text-[10px] text-green-text"><Check className="w-3 h-3" /> Applied</span>
                        : <button className="text-[10px] px-2.5 py-1 rounded-md bg-indigo text-primary-foreground hover:opacity-90">Apply</button>}
                    </div>
                  )}
                  {msg.followUp && msg.followUp.length > 0 && (
                    <div className="space-y-1">
                      {msg.followUp.map((q, qi) => (
                        <button key={qi} onClick={() => sendMessage(q)} className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-border hover:bg-muted hover:border-indigo/30 transition-colors">{q}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* input */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex gap-1">
            {(["build", "debug", "test"] as const).map(m => {
              const Icon = m === "build" ? Code : m === "debug" ? Bug : TestTube;
              return (
                <button key={m} onClick={() => setCopilotMode(m)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${copilotMode === m ? "bg-indigo-light text-indigo" : "text-muted-foreground hover:bg-muted"}`}>
                  <Icon className="w-3 h-3" />{m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              );
            })}
          </div>
          <div className="relative">
            {showMentionPicker && (
              <div className="absolute bottom-[calc(100%+4px)] left-0 right-0 z-20 bg-card border border-border rounded-md overflow-hidden shadow-lg">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2.5 py-1.5 border-b border-border tracking-wide">Mention an agent</p>
                {mentionAgents.map(a => (
                  <button key={a.name} onClick={() => insertMention(a.name)} className="w-full flex items-center gap-2 px-2.5 py-[7px] hover:bg-secondary transition-colors text-left">
                    <span className="w-[22px] h-[22px] rounded-md bg-secondary border border-border flex items-center justify-center text-[11px]">{a.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-tight">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="border border-border rounded-md overflow-hidden focus-within:border-[hsl(var(--ring))] transition-colors">
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Write your question here..."
                className="w-full resize-none bg-transparent px-2.5 pt-2 pb-1 text-[11px] outline-none placeholder:text-muted-foreground/60"
                style={{ minHeight: 28, maxHeight: 70 }} rows={1} />
              <div className="flex items-center gap-1 px-2 py-1">
                <button onClick={toggleRecording} className={`w-[26px] h-[26px] rounded-[5px] flex items-center justify-center transition-colors ${isRecording ? "bg-destructive/10 text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                  {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                </button>
                <button onClick={() => setShowMentionPicker(p => !p)} className={`w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-xs font-medium transition-colors ${showMentionPicker ? "text-indigo bg-indigo-light" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>@</button>
                <input type="file" ref={fileInputRef} className="hidden" multiple accept=".csv,.xlsx,.xls,.json,.txt,.pdf" />
                <button onClick={() => fileInputRef.current?.click()} className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><Paperclip className="w-3 h-3" /></button>
                <div className="flex-1" />
                <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center bg-indigo text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-opacity"><ArrowUp className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"><Plus className="w-3 h-3" /> Edit</button>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><span>⚡</span><span>Auto Mode</span><ArrowUp className="w-3 h-3 bg-foreground text-background rounded p-0.5" /></div>
          </div>
        </div>
      </div>

      {/* ═══════ RIGHT: CANVAS ═══════ */}
      <div className="flex-1 bg-background flex flex-col overflow-hidden">
        {/* top bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-light flex items-center justify-center"><Bot className="w-4 h-4 text-indigo" /></div>
            <div>
              <h3 className="text-sm font-semibold">ICP Outbound Agent</h3>
              <p className="text-[10px] text-muted-foreground">5 steps · Last edited 2h ago</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* notifications */}
            <div className="relative">
              <button onClick={() => { setShowNotifications(n => !n); setShowShare(false); }}
                className="relative p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground transition-colors">
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-primary-foreground text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <p className="text-[11px] font-semibold">Notifications</p>
                    <button className="text-[10px] text-indigo">Mark all read</button>
                  </div>
                  {notifications.map(n => (
                    <div key={n.id} className={`flex items-start gap-2 px-3 py-2.5 border-b border-border last:border-none hover:bg-muted/50 ${!n.read ? "bg-indigo-light/20" : ""}`}>
                      {n.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-text mt-0.5" /> : n.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-text mt-0.5" /> : <BellRing className="w-3.5 h-3.5 text-indigo mt-0.5" />}
                      <div className="flex-1"><p className="text-[11px]">{n.msg}</p><p className="text-[9px] text-muted-foreground">{n.time}</p></div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-indigo mt-1" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* share */}
            <div className="relative">
              <button onClick={() => { setShowShare(s => !s); setShowNotifications(false); }}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground"><Share2 className="w-3 h-3" /> Share</button>
              {showShare && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-lg z-30 p-3 space-y-3">
                  <p className="text-[11px] font-semibold">Share Agent</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/50">
                    <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate flex-1">outmate.ai/agents/icp-outbound</span>
                    <button className="text-[10px] text-indigo font-medium">Copy</button>
                  </div>
                  <input className="w-full h-7 px-2 text-[10px] rounded-md border border-border bg-card outline-none focus:border-ring" placeholder="Add email or name..." />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Anyone with link</span>
                    <ToggleRight className="w-5 h-5 text-indigo" />
                  </div>
                  <button className="w-full text-[10px] py-1.5 rounded-md bg-indigo text-primary-foreground hover:opacity-90">Share</button>
                </div>
              )}
            </div>

            <button onClick={() => setShowOutputPanel(p => !p)} className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-border transition-colors ${showOutputPanel ? "bg-indigo-light text-indigo border-indigo/30" : "hover:bg-muted text-muted-foreground"}`}>
              <PanelRightOpen className="w-3 h-3" /> Output
            </button>
            <button className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground"><Play className="w-3 h-3" /> Test run</button>
            <button className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md bg-indigo text-primary-foreground hover:opacity-90"><Zap className="w-3 h-3" /> Deploy</button>
          </div>
        </div>

        {/* canvas + output split */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── CANVAS ── */}
          <div className="flex-1 relative overflow-auto bg-[hsl(var(--muted)/0.3)]"
            style={{ backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            onClick={() => { setSelectedNode(null); setShowShare(false); setShowNotifications(false); }}>

            {/* floating toolbar */}
            {showToolbar && (
              <div className="absolute top-3 left-3 z-10 bg-card border border-border rounded-xl shadow-sm w-[140px] overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
                  <span className="text-[10px] font-semibold flex items-center gap-1"><Layers className="w-3 h-3" /> Toolbox</span>
                  <button onClick={e => { e.stopPropagation(); setShowToolbar(false); }} className="text-muted-foreground hover:text-foreground"><ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-1.5 space-y-2">
                  {toolbarCategories.map(cat => (
                    <div key={cat.name}>
                      <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide px-1 mb-1">{cat.name}</p>
                      <div className="space-y-0.5">
                        {cat.items.map(tool => (
                          <div key={tool.label} draggable
                            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-muted cursor-grab active:cursor-grabbing transition-colors">
                            <div className={`w-5 h-5 rounded ${tool.color} flex items-center justify-center`}>
                              <tool.icon className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-[10px] font-medium">{tool.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!showToolbar && (
              <button onClick={e => { e.stopPropagation(); setShowToolbar(true); }}
                className="absolute top-3 left-3 z-10 p-2 bg-card border border-border rounded-lg shadow-sm hover:bg-muted transition-colors"
                title="Open toolbox">
                <Layers className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* connector lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {nodes.map((node, i) => {
                if (i >= nodes.length - 1) return null;
                const next = nodes[i + 1];
                const xCenter = 220 + 150;
                return <line key={`l-${i}`} x1={xCenter} y1={node.y + 90} x2={xCenter} y2={next.y} stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="6 3" />;
              })}
            </svg>

            {/* nodes */}
            {nodes.map((node, i) => {
              const isSelected = selectedNode === node.id;
              return (
                <div key={node.id} draggable
                  onDragStart={e => { e.stopPropagation(); setDragIdx(i); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.stopPropagation(); if (dragIdx === null || dragIdx === i) return; const u = [...nodes]; const [m] = u.splice(dragIdx, 1); u.splice(i, 0, m); setNodes(u.map((n, idx) => ({ ...n, y: 20 + idx * 150 }))); setDragIdx(null); }}
                  onClick={e => { e.stopPropagation(); setSelectedNode(isSelected ? null : node.id); }}
                  className={`absolute w-[300px] bg-card border rounded-xl cursor-grab active:cursor-grabbing transition-all group ${isSelected ? "border-indigo shadow-md ring-2 ring-indigo/20" : "border-border hover:border-indigo hover:shadow-md"}`}
                  style={{ left: 220, top: node.y, zIndex: isSelected ? 5 : 1 }}>

                  {/* step badge */}
                  <div className="absolute -top-2.5 right-3 text-[9px] font-semibold bg-card border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                    Step {i + 1}
                  </div>

                  {/* node header */}
                  <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    <span className={`w-9 h-9 rounded-lg ${node.color} flex items-center justify-center text-base`}>{node.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold truncate">{node.label}</span>
                        {node.integration && (
                          <span className="text-[9px] px-1.5 py-px rounded-full bg-muted text-muted-foreground shrink-0">{node.integration}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{node.desc}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}><Copy className="w-3 h-3" /></button>
                      <button className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}><MoreHorizontal className="w-3 h-3" /></button>
                    </div>
                  </div>

                  {/* output preview (shown when selected) */}
                  {isSelected && node.outputPreview && (
                    <div className="px-3 pb-3 border-t border-border pt-2 mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] uppercase font-semibold text-muted-foreground">Output</p>
                        <button className="text-[9px] text-indigo hover:text-indigo/80 flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Copy className="w-2.5 h-2.5" /> Copy
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono bg-muted/50 rounded-lg p-2 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(node.outputPreview), null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* connector dot */}
                  {i < nodes.length - 1 && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-card border-2 border-border flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* add step */}
            <div className="absolute flex items-center justify-center" style={{ left: 320, top: nodes[nodes.length - 1].y + 120, zIndex: 1 }}>
              <button className="flex items-center gap-1.5 text-[11px] text-indigo hover:text-indigo/80 border border-dashed border-indigo/30 rounded-lg px-3 py-2 hover:bg-indigo-light/50 transition-colors">
                <Plus className="w-3 h-3" /> Add step
              </button>
            </div>

            {/* bottom zoom bar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <button className="text-[11px] text-muted-foreground hover:text-foreground px-1">−</button>
              <span className="text-[10px] text-muted-foreground font-medium w-10 text-center">120%</span>
              <button className="text-[11px] text-muted-foreground hover:text-foreground px-1">+</button>
              <div className="w-px h-4 bg-border" />
              <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Copy"><Copy className="w-3 h-3" /></button>
              <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Download"><Download className="w-3 h-3" /></button>
            </div>
          </div>

          {/* ── OUTPUT PANEL (slide-in) ── */}
          {showOutputPanel && (
            <div className="w-[300px] border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo" />
                  <span className="text-[11px] font-semibold">Live Output</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1 text-[9px] text-green-text"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--green))] animate-pulse" />Running</span>
                  <button onClick={() => setShowOutputPanel(false)} className="p-1 rounded hover:bg-muted text-muted-foreground ml-1"><ChevronRight className="w-3 h-3" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {nodes.map((node, i) => {
                  const status = i < 3 ? "done" : i === 3 ? "running" : "pending";
                  return (
                    <div key={node.id} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        {status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-text shrink-0" /> :
                         status === "running" ? <RefreshCw className="w-3.5 h-3.5 text-indigo animate-spin shrink-0" /> :
                         <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{node.label}</p>
                        </div>
                        <span className="text-[9px] text-muted-foreground">{status === "done" ? `${(i + 1) * 0.5}s` : status === "running" ? "..." : "—"}</span>
                      </div>
                      {status !== "pending" && node.outputPreview && (
                        <div className="px-3 py-2 border-t border-border bg-muted/30">
                          <pre className="text-[9px] font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(JSON.parse(node.outputPreview), null, 2)}
                          </pre>
                        </div>
                      )}
                      {status === "running" && (
                        <div className="px-3 pb-2"><div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-indigo rounded-full animate-pulse" style={{ width: "60%" }} /></div></div>
                      )}
                    </div>
                  );
                })}

                {/* summary */}
                <div className="border border-[hsl(var(--green)/0.3)] rounded-lg p-3 bg-green-light/30">
                  <p className="text-[10px] font-semibold text-green-text mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Summary</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ l: "Leads", v: "12" }, { l: "Qualified", v: "8" }, { l: "Credits", v: "28" }, { l: "Duration", v: "4.6s" }].map(s => (
                      <div key={s.l} className="bg-card rounded p-1.5 border border-border">
                        <p className="text-[9px] text-muted-foreground">{s.l}</p>
                        <p className="text-sm font-bold">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button className="flex-1 text-[10px] py-1 rounded-md border border-border text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"><Download className="w-3 h-3" /> Export</button>
                    <button className="flex-1 text-[10px] py-1 rounded-md border border-border text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"><Share2 className="w-3 h-3" /> Share</button>
                  </div>
                </div>

                {/* alert settings */}
                <div className="border border-border rounded-lg p-3">
                  <p className="text-[10px] font-semibold mb-2 flex items-center gap-1"><BellRing className="w-3 h-3 text-indigo" /> Alerts</p>
                  {[
                    { label: "On completion", enabled: true },
                    { label: "On error", enabled: true },
                    { label: "Credit limit", enabled: false },
                    { label: "Daily digest", enabled: false },
                  ].map((a, ai) => (
                    <div key={ai} className="flex items-center justify-between py-1.5">
                      <span className="text-[10px]">{a.label}</span>
                      {a.enabled ? <ToggleRight className="w-4 h-4 text-indigo" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
