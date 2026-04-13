import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Star } from "lucide-react";
import { C, type ChatMessage } from "./constants";

/* ── AI response logic ── */
function getAIResponse(msg: string): { text: string; chips?: string[] } {
  const m = msg.toLowerCase();
  if (m.includes("credit") || m.includes("cost"))
    return { text: "Here's your per-step credit breakdown:\n\n• Signal trigger — 0 cr (free)\n• Waterfall enrichment — 1–3 cr\n• AI lead scoring — 2 cr\n• Email sequence — 1 cr\n• CRM update — 0 cr\n\nTotal: ~14 credits per lead processed.", chips: ["Reduce cost", "See monthly projection"] };
  if (m.includes("linkedin"))
    return { text: "I'll insert a LinkedIn outreach step between AI Scoring and Email Sequence. This typically improves reply rates by 18–24% for ICP-matched leads.", chips: ["Add step now", "Show reply impact"] };
  if (m.includes("integrat"))
    return { text: "Connected: Crustdata, Gmail, HubSpot\nMissing: LinkedIn/Unipile, Salesforce, G2 Intent\n\nYou'll need LinkedIn/Unipile to enable the LinkedIn outreach step.", chips: ["Connect LinkedIn", "Connect Salesforce"] };
  if (m.includes("reply rate"))
    return { text: "Expected reply rates for this workflow:\n\n• Cold email only: 3–5%\n• With signal targeting: 8–12%\n• With personalisation: 12–18%\n\nYour current config estimates ~14% reply rate.", chips: ["Improve rate", "A/B test setup"] };
  if (m.includes("checklist") || m.includes("todo"))
    return { text: "Build checklist:\n✓ Signal trigger configured\n✓ Enrichment waterfall set\n⟳ AI scoring — needs confirmation\n○ Email sequence — pending\n○ CRM integration — not connected", chips: ["Fix scoring", "Connect CRM"] };
  if (m.includes("cooldown") || m.includes("loop") || m.includes("14-day"))
    return { text: "Re-engagement loop: leads below threshold enter a 14-day cooldown, then re-enter the signal check. If score improves above 80, they proceed to outreach.", chips: ["Enable loop", "Skip instead"] };
  return { text: "I can help you build and optimize this agent. Try asking about credit costs, integrations, or expected reply rates.", chips: ["Estimate credits", "Show checklist"] };
}

const SUGGESTIONS = [
  { icon: "◎", text: "Estimate credit cost" },
  { icon: "◈", text: "Add LinkedIn step" },
  { icon: "⊞", text: "Required integrations" },
  { icon: "▦", text: "Expected reply rate" },
  { icon: "✓", text: "Show build checklist" },
];

interface Props {
  agentName: string;
  showConfirmation: boolean;
  onConfirm: () => void;
}

export default function CoPilotPanel({ agentName, showConfirmation, onConfirm }: Props) {
  const [leftTab, setLeftTab] = useState<"copilot" | "preview" | "feedback">("copilot");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [inputMode, setInputMode] = useState<"build" | "debug" | "test">("build");
  const [rating, setRating] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: "user", text: text.trim() }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTyping(true);
    setTimeout(() => {
      const resp = getAIResponse(text);
      setMessages(prev => [...prev, { role: "ai", text: resp.text, chips: resp.chips }]);
      setTyping(false);
    }, 1200);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleMic = () => {
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      const transcript = "What's the estimated credit cost per lead?";
      setInput(transcript);
      setTimeout(() => sendMessage(transcript), 200);
    }, 2200);
  };

  const TABS = [
    { id: "copilot" as const, label: "Co-pilot" },
    { id: "preview" as const, label: "Preview" },
    { id: "feedback" as const, label: "Feedback" },
  ];

  return (
    <div className="w-[296px] shrink-0 flex flex-col border-r" style={{ background: C.panel, borderColor: C.border07 }}>
      {/* Tabs */}
      <div className="flex border-b shrink-0" style={{ borderColor: C.border07 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setLeftTab(t.id)}
            className="flex-1 h-9 text-[11px] font-medium transition-colors relative"
            style={{ color: leftTab === t.id ? "#fff" : C.text30 }}>
            {t.label}
            {leftTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.primary }} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {leftTab === "copilot" && (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 studio-scroll">
              {/* Greeting */}
              <div className="rounded-[10px] p-3 border" style={{ background: "rgba(255,255,255,.04)", borderColor: C.border08 }}>
                <div className="text-xs font-semibold mb-1" style={{ color: C.text }}>Building {agentName}</div>
                <div className="text-[10px] leading-relaxed" style={{ color: C.text30 }}>I'll help you configure each step. Use the suggestions below or ask me anything.</div>
              </div>
              {/* Suggestions */}
              {messages.length === 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.text25 }}>Quick actions</div>
                  <div className="flex flex-col gap-[5px]">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s.text)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] transition-colors text-left"
                        style={{ background: "rgba(255,255,255,.03)", borderColor: C.border08, color: C.text70 }}>
                        <span className="w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] shrink-0"
                          style={{ background: "rgba(79,70,229,.15)", color: "#818CF8" }}>{s.icon}</span>
                        <span className="flex-1">{s.text}</span>
                        <span style={{ color: C.text25 }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex gap-2"}>
                  {msg.role === "ai" && (
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 text-[10px]"
                      style={{ background: C.primary, color: "#fff" }}>✦</div>
                  )}
                  <div>
                    <div className="px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap"
                      style={msg.role === "user"
                        ? { background: C.primary, color: "#fff", borderRadius: "9px 9px 3px 9px" }
                        : { background: "rgba(255,255,255,.04)", border: `1px solid ${C.border08}`, color: C.text70, borderRadius: "9px 9px 9px 3px" }}>
                      {msg.text}
                    </div>
                    {msg.chips && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {msg.chips.map((chip, j) => (
                          <button key={j} onClick={() => sendMessage(chip)}
                            className="px-2 py-1 rounded-md text-[10px] font-medium"
                            style={{ background: "rgba(79,70,229,.2)", color: "#818CF8", border: "1px solid rgba(79,70,229,.3)" }}>
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-2 items-end">
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px]" style={{ background: C.primary, color: "#fff" }}>✦</div>
                  <div className="flex gap-1 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,.04)" }}>
                    {[0, 1, 2].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: C.text30, animation: `typing-bounce 0.7s ease-in-out ${d * 0.14}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>
            {/* Input */}
            <div className="border-t p-2" style={{ borderColor: C.border07 }}>
              <div className="flex gap-1 mb-2">
                {(["build", "debug", "test"] as const).map(m => (
                  <button key={m} onClick={() => setInputMode(m)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium capitalize border"
                    style={inputMode === m
                      ? { background: "rgba(79,70,229,.2)", color: "#818CF8", borderColor: "rgba(79,70,229,.3)" }
                      : { background: "transparent", color: C.text30, borderColor: "transparent" }}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-1 rounded-lg border p-1.5" style={{ background: "rgba(255,255,255,.05)", borderColor: C.border }}>
                <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 68) + "px"; }}
                  onKeyDown={handleKey} placeholder="Ask, type, or use voice..." rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-[11px] resize-none leading-relaxed"
                  style={{ color: C.text70, maxHeight: 68 }} />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={handleMic} className="w-6 h-6 rounded flex items-center justify-center transition-all"
                    style={recording ? { background: "rgba(239,68,68,.2)", color: "#F87171", animation: "mic-pulse 1s ease-in-out infinite" } : { color: C.text30 }}>
                    <svg width="11" height="13" viewBox="0 0 11 13" fill="none"><rect x="3" y="0.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.2" /><path d="M1 6.5a4.5 4.5 0 009 0M5.5 10.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  </button>
                  <button onClick={() => { setInput(prev => prev + "@"); textareaRef.current?.focus(); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium" style={{ color: C.text30 }}>@</button>
                  <button onClick={() => sendMessage(input)}
                    className="w-[26px] h-[26px] rounded flex items-center justify-center"
                    style={{ background: C.primary }}>
                    <Send size={11} color="#fff" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {leftTab === "preview" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 studio-scroll">
            <div className="rounded-[10px] p-4 border" style={{ background: "rgba(79,70,229,.1)", borderColor: "rgba(79,70,229,.2)" }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: C.primary }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#fff" /></svg>
              </div>
              <div className="text-sm font-bold text-center" style={{ color: C.text }}>{agentName}</div>
              <div className="text-[10px] text-center" style={{ color: C.text40 }}>Outbound sales automation</div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[["3", "Steps"], ["~14", "Credits/run"], ["~14%", "Reply rate"]].map(([v, l]) => (
                <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                  <div className="text-sm font-bold" style={{ color: C.text }}>{v}</div>
                  <div className="text-[9px]" style={{ color: C.text30 }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {["Signal Engine trigger", "Waterfall enrichment", "AI lead scoring"].map((n, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.04)" }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "rgba(255,255,255,.08)", color: C.text40 }}>{i + 1}</div>
                  <span className="text-[11px] font-medium" style={{ color: C.text70 }}>{n}</span>
                </div>
              ))}
            </div>
            {showConfirmation && (
              <div className="rounded-[9px] p-3 border" style={{ background: "rgba(245,158,11,.08)", borderColor: "rgba(245,158,11,.3)" }}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: "#FCD34D" }}>Agent needs your input</div>
                <div className="text-[10px] mb-2.5 leading-relaxed" style={{ color: C.text40 }}>
                  Should leads scoring below 80 be re-queued after 14 days or permanently skipped?
                </div>
                <div className="flex gap-2">
                  <button onClick={onConfirm} className="flex-1 py-1.5 rounded-md text-[10px] font-semibold" style={{ background: C.primary, color: "#fff" }}>Re-queue after 14d</button>
                  <button onClick={onConfirm} className="flex-1 py-1.5 rounded-md text-[10px] font-semibold border" style={{ background: "rgba(255,255,255,.1)", borderColor: C.border, color: C.text70 }}>Skip permanently</button>
                </div>
              </div>
            )}
          </div>
        )}

        {leftTab === "feedback" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4 studio-scroll">
            <div>
              <div className="text-[11px] font-semibold mb-2" style={{ color: C.text }}>Rate this agent</div>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRating(n)}>
                    <Star size={20} fill={n <= rating ? "#FCD34D" : "transparent"} stroke={n <= rating ? "#FCD34D" : "rgba(255,255,255,.2)"} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              <textarea placeholder="What's working? What should improve?" rows={3}
                className="w-full rounded-md p-2.5 text-[11px] resize-none outline-none border"
                style={{ background: "rgba(255,255,255,.05)", borderColor: C.border, color: C.text70 }} />
              <button className="w-full mt-2 py-2 rounded-md text-[11px] font-semibold" style={{ background: C.primary, color: "#fff" }}>Submit feedback</button>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.text25 }}>Recent feedback</div>
              {[
                { text: "Reduced our outbound effort by 80%. The signal detection is incredibly accurate.", positive: true },
                { text: "Reply rate jumped from 4% to 13% after switching to this agent.", positive: true },
                { text: "Need better LinkedIn step — currently missing Unipile integration.", positive: false },
              ].map((fb, i) => (
                <div key={i} className="rounded-lg p-2.5 border mb-2 text-[10px] leading-relaxed"
                  style={{ background: "rgba(255,255,255,.04)", borderColor: C.border07, color: C.text40 }}>
                  {fb.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
