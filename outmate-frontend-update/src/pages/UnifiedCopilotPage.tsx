import { useState, useRef, useCallback } from "react";
import {
  Sparkles, Send, Building2, Users, GitBranch, Mail,
  Search, Bot, FileText, X, ArrowUpCircle, Database,
  BarChart3, Zap, Eye
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestions = [
  { icon: Eye, label: "Find hot website visitors", desc: "Analyze recent high-intent companies", color: "bg-primary/10 text-primary" },
  { icon: Users, label: "Enrich leads", desc: "Run waterfall enrichment on contacts", color: "bg-green-500/10 text-green-600" },
  { icon: GitBranch, label: "Build workflow", desc: "Create automated GTM sequences", color: "bg-amber-500/10 text-amber-600" },
  { icon: Mail, label: "Run outreach", desc: "Launch personalized email campaigns", color: "bg-purple-500/10 text-purple-600" },
  { icon: Building2, label: "Query database", desc: "Search companies and contacts", color: "bg-primary/10 text-primary" },
  { icon: BarChart3, label: "Analyze pipeline", desc: "Review conversion and performance", color: "bg-teal-500/10 text-teal-600" },
];

const mockResponses: Record<string, string> = {
  default: "I found **47 high-intent companies** on your website in the last 7 days. Here's a summary:\n\n- **12** visited pricing page (Hot intent)\n- **23** explored features (Warm intent)\n- **8** downloaded case studies\n- **4** viewed API docs\n\nWould you like me to:\n1. 📋 **Export the full list** to your database\n2. 🔄 **Trigger a workflow** for hot accounts\n3. ✉️ **Draft outreach** for top prospects\n4. 📊 **Show detailed analytics**",
  enrich: "Running waterfall enrichment on your list:\n\n**Pipeline:**\n- ✅ Email verification (Clearbit → Hunter → Apollo)\n- ✅ Phone numbers (ZoomInfo → Lusha)\n- ✅ LinkedIn profiles\n- ✅ Company technographics\n\n**Results:** 89% match rate · 240 credits used\n\nAll enriched data has been saved to your database.",
  workflow: "I've generated a workflow for you:\n\n**Workflow: Hot Visitor → Outreach**\n1. 🎯 Trigger: Website visitor with ICP score ≥ 80\n2. 🔄 Enrich: Waterfall enrichment (email + phone)\n3. 📧 Email: Send personalized sequence\n4. ⏱️ Wait: 3 days\n5. 📞 Call: Assign to SDR queue\n6. 💾 CRM: Update HubSpot deal\n\nWant me to activate this workflow?",
};

export default function UnifiedCopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getResponse = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes("enrich")) return mockResponses.enrich;
    if (lower.includes("workflow") || lower.includes("build")) return mockResponses.workflow;
    return mockResponses.default;
  };

  const sendMessage = useCallback((text?: string) => {
    const content = text || input.trim();
    if (!content) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

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
    }, 1200);

    setTimeout(scrollToBottom, 100);
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Copilot</h1>
            <p className="text-[10px] text-muted-foreground">AI-powered GTM assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">AI Ready</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="max-w-2xl w-full space-y-8">
              {/* Welcome */}
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">What would you like to do?</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Query your database, analyze visitors, build workflows, or run outreach — all from one place.
                </p>
              </div>

              {/* Input */}
              <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything... Find hot visitors, enrich leads, build workflows, run outreach"
                  className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm outline-none min-h-[80px] placeholder:text-muted-foreground/50"
                  rows={3}
                />
                <div className="flex items-center justify-between px-4 pb-3">
                  <span className="text-[10px] text-muted-foreground/50">Powered by Outmate AI</span>
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
                  >
                    <ArrowUpCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Suggestions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.label)}
                    className="text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <p className="text-[13px] font-medium text-foreground mb-0.5">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%]`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="space-y-1">
                        {msg.content.split("\n").map((line, i) => {
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return <p key={i} className="font-semibold my-1">{line.replace(/\*\*/g, "")}</p>;
                          }
                          if (line.startsWith("- ")) {
                            return <p key={i} className="ml-2 my-0.5">{line}</p>;
                          }
                          if (line.trim() === "") return <br key={i} />;
                          return <p key={i} className="my-0.5">{line.replace(/\*\*/g, "")}</p>;
                        })}
                      </div>
                    ) : msg.content}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary-foreground">You</span>
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" style={{ animation: `typing-dot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom input when in chat */}
      {hasMessages && (
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 border border-border rounded-xl bg-card px-4 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue the conversation..."
                className="flex-1 resize-none bg-transparent text-sm outline-none min-h-[36px] max-h-[120px] py-1 placeholder:text-muted-foreground/50"
                rows={1}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-opacity shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
