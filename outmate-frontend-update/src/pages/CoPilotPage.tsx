import { useState, useRef, useCallback } from "react";
import {
  Paperclip, AtSign, Mic, MicOff, Send, ArrowUpCircle,
  Building2, Users, Zap, Sparkles, Bot, FileUp, Search,
  BarChart3, Mail, Phone, Globe, BookOpen, MoreHorizontal,
  ChevronRight, X, Upload, FileText, Database
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; type: string }[];
  timestamp: Date;
}

const savedPrompts = [
  { icon: Building2, label: "Find companies matching my ICP", desc: "Search 200M+ companies with NLP filters", color: "bg-indigo-light text-indigo" },
  { icon: Users, label: "Enrich leads with waterfall data", desc: "Multi-provider enrichment for contacts", color: "bg-green-light text-green" },
  { icon: Zap, label: "Set up hiring & funding signals", desc: "Real-time alerts on 36 signal types", color: "bg-orange-light text-orange" },
  { icon: Bot, label: "Run outbound sequence agent", desc: "Autonomous multi-channel outreach", color: "bg-purple-light text-purple" },
  { icon: Mail, label: "Draft personalized email sequence", desc: "AI-powered email copy for prospects", color: "bg-indigo-light text-indigo" },
  { icon: BarChart3, label: "Analyze pipeline & conversion", desc: "Deep dive into GTM performance data", color: "bg-teal-light text-teal" },
];

const quickAgents = [
  { icon: Search, name: "ICP Search", desc: "Find ideal companies" },
  { icon: Sparkles, name: "Enrichment", desc: "Enrich contact data" },
  { icon: Zap, name: "Signal Tracker", desc: "Monitor buying signals" },
  { icon: Mail, name: "Email Writer", desc: "Draft outreach emails" },
  { icon: Phone, name: "Call Prep", desc: "Pre-call research" },
  { icon: Globe, name: "Web Research", desc: "Company deep dive" },
];

const mockResponses: Record<string, string> = {
  default: "I found **47 Series B SaaS companies** in the US that are currently hiring VP of Sales. Here's a summary:\n\n- **23** in San Francisco Bay Area\n- **12** in New York Metro\n- **8** in Austin/Dallas\n- **4** in other cities\n\nWould you like me to:\n1. 📋 **Export the full list** with company details\n2. 👤 **Find decision makers** at these companies\n3. ✉️ **Draft a personalized sequence** for outreach\n4. 🔔 **Set up a signal** to track new matches",
  enrich: "I'll run waterfall enrichment on your list. Here's the plan:\n\n**Enrichment Pipeline:**\n- ✅ Email verification (Clearbit → Hunter → Apollo)\n- ✅ Phone numbers (ZoomInfo → Lusha)\n- ✅ LinkedIn profiles\n- ✅ Company technographics\n\n**Estimated results:** 85-92% match rate\n**Credits cost:** ~240 credits\n\nShall I proceed?",
  signal: "I've configured your signal tracker:\n\n**Signal: VP Sales Hiring at Series B SaaS**\n- 🎯 Trigger: Job posting for VP/Director Sales\n- 🏢 Filter: Series B, SaaS, 50-500 employees\n- 📍 Region: United States\n- ⚡ Frequency: Real-time alerts\n\n**Expected volume:** ~12-18 signals/week\n\nThe signal is now **live**. You'll get notifications in your dashboard and via email.",
};

export default function CoPilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getResponse = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();
    if (lower.includes("enrich")) return mockResponses.enrich;
    if (lower.includes("signal") || lower.includes("track")) return mockResponses.signal;
    return mockResponses.default;
  };

  const sendMessage = useCallback((text?: string) => {
    const content = text || input.trim();
    if (!content && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setIsTyping(true);
    setShowAgentPicker(false);

    // Simulate AI response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getResponse(content),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, response]);
      setIsTyping(false);
      setTimeout(scrollToBottom, 100);
    }, 1500);

    setTimeout(scrollToBottom, 100);
  }, [input, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Simulate voice input
      setTimeout(() => {
        setInput("Find Series B SaaS companies hiring VP Sales in the US");
        setIsRecording(false);
      }, 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments = Array.from(files).map(f => ({ name: f.name, type: f.type || "file" }));
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Co-pilot</h1>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-light text-amber-text">Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground">
            Agent Builder ↗
          </button>
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground">
            <Bot className="w-3.5 h-3.5" />
            <span>GPT 5.2</span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Empty state - like the reference image */
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="max-w-2xl w-full space-y-8">
              {/* Welcome */}
              <div className="text-center space-y-2">
                <span className="inline-flex text-xs px-3 py-1 rounded-full border border-border text-muted-foreground">
                  Starter plan · <span className="text-indigo ml-1 font-medium cursor-pointer">Upgrade</span>
                </span>
                <h2 className="text-2xl font-bold">What can we help with today?</h2>
              </div>

              {/* Input box */}
              <div className="border border-border rounded-2xl bg-card p-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything, and add agents to chat with @"
                  className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm outline-none min-h-[80px] placeholder:text-muted-foreground/60"
                  rows={3}
                />
                {/* Attachments preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pb-2">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 text-xs">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between px-3 pb-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      accept=".csv,.xlsx,.xls,.json,.txt,.pdf"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      title="Attach files"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowAgentPicker(!showAgentPicker)}
                      className={`p-2 rounded-lg hover:bg-muted transition-colors ${showAgentPicker ? "text-indigo bg-indigo-light" : "text-muted-foreground"}`}
                      title="Mention an agent"
                    >
                      <AtSign className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleRecording}
                      className={`p-2 rounded-lg transition-colors ${
                        isRecording ? "bg-destructive/10 text-destructive animate-pulse" : "hover:bg-muted text-muted-foreground"
                      }`}
                      title={isRecording ? "Stop recording" : "Voice command"}
                    >
                      {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() && attachments.length === 0}
                      className="p-1.5 rounded-lg bg-foreground text-background disabled:opacity-30 transition-opacity"
                    >
                      <ArrowUpCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Agent picker dropdown */}
              {showAgentPicker && (
                <div className="border border-border rounded-xl bg-card p-3 -mt-4">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 px-1">Quick agents</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {quickAgents.map((agent, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInput(prev => prev + `@${agent.name} `);
                          setShowAgentPicker(false);
                          textareaRef.current?.focus();
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-light flex items-center justify-center shrink-0">
                          <agent.icon className="w-3.5 h-3.5 text-indigo" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{agent.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{agent.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Try @-ing your agents */}
              <div className="flex items-center gap-3 justify-center text-muted-foreground">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="text-sm">Try @-ing your agents</span>
              </div>

              {/* Saved prompts */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold">Saved prompts</h3>
                  <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handlePromptClick(prompt.label)}
                      className="text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group relative"
                    >
                      <div className={`w-8 h-8 rounded-lg ${prompt.color} flex items-center justify-center mb-3`}>
                        <prompt.icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-medium mb-1">{prompt.label}</p>
                      <p className="text-xs text-muted-foreground">{prompt.desc}</p>
                      <button className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick upload section */}
              <div className="border border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">Upload leads, signals, or data files</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drop CSV, Excel, or JSON files to import into your database
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-light flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-indigo" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                      {msg.attachments.map((att, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] bg-indigo-light text-indigo px-2 py-1 rounded-full">
                          <FileText className="w-3 h-3" /> {att.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-foreground text-background rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none">
                        {msg.content.split("\n").map((line, i) => {
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return <p key={i} className="font-semibold my-1">{line.replace(/\*\*/g, "")}</p>;
                          }
                          if (line.startsWith("- ")) {
                            return <p key={i} className="ml-2 my-0.5">{line}</p>;
                          }
                          if (line.trim() === "") return <br key={i} />;
                          return <p key={i} className="my-1">{line.replace(/\*\*/g, "")}</p>;
                        })}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-indigo flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary-foreground">G</span>
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-light flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-indigo" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom input - shown when in chat mode */}
      {hasMessages && (
        <div className="border-t border-border bg-card px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 text-xs">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 border border-border rounded-xl bg-card p-1">
              <div className="flex items-center gap-0.5 px-1 pb-1">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept=".csv,.xlsx,.xls,.json,.txt,.pdf" />
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Attach files">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button onClick={() => setShowAgentPicker(!showAgentPicker)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Mention agent">
                  <AtSign className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your co-pilot..."
                className="flex-1 resize-none bg-transparent py-2.5 text-sm outline-none min-h-[40px] max-h-[120px] placeholder:text-muted-foreground/60"
                rows={1}
              />
              <div className="flex items-center gap-0.5 px-1 pb-1">
                <button
                  onClick={toggleRecording}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isRecording ? "bg-destructive/10 text-destructive animate-pulse" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-1 rounded-lg bg-foreground text-background disabled:opacity-30"
                >
                  <ArrowUpCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
