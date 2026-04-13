import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface Message {
  role: "user" | "ai";
  text: string;
  chips?: string[];
}

const SUGGESTIONS = [
  "How much will this workflow cost per lead?",
  "Add a LinkedIn connect step after email opens",
  "What reply rate should I expect from this sequence?",
  "Add a re-engagement loop for non-openers after 21 days",
];

function getAIResponse(msg: string): Message {
  const m = msg.toLowerCase();
  if (m.includes("cost") || m.includes("credit") || m.includes("enrich"))
    return {
      role: "ai",
      text: "Estimated **1.2–2.4 credits per lead** across the waterfall:\n\n• Tier 1 Crustdata: ~0.8 credits (60% match rate)\n• Tier 2 Hunter: ~0.4 credits (fallback 25%)\n• Tier 3 BetterContact: ~1.2 credits (fallback 15%)\n\nAverage blended cost: **~1.4 credits/lead** at scale.",
      chips: ["Optimise waterfall order", "Show credit breakdown", "Set cost cap"],
    };
  if (m.includes("linkedin") || m.includes("connect"))
    return {
      role: "ai",
      text: "I'll insert a LinkedIn connect step between AI Lead Scoring and Email Sequence. This fires when score ≥ 80, sending a personalised connection request via Unipile before the email sequence starts.",
      chips: ["Configure connection message", "Set daily limit"],
    };
  if (m.includes("reply rate"))
    return {
      role: "ai",
      text: "Expected reply rates for this sequence:\n\n• Day 1 cold email ~4–6%\n• Day 3 follow-up ~2–3%\n• LinkedIn touch ~8–12% accept rate\n• Voice AI fallback ~15–20% answer rate\n\nTotal meeting conversion from sequence: ~6–9%.",
      chips: ["Improve subject lines", "A/B test openers"],
    };
  if (m.includes("re-engagement") || m.includes("loop"))
    return {
      role: "ai",
      text: "I'll add a re-engagement branch off the email sequence node. Non-openers after Day 21 enter a 14-day pause, then receive a new angle email. After 3 loops with no response, the lead exits to a quarterly nurture list.",
      chips: ["Set max loops", "Edit nurture criteria"],
    };
  return { role: "ai", text: "Got it. Let me update the workflow to reflect that change.", chips: ["Show updated flow"] };
}

function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <span key={i} className="font-semibold" style={{ color: "var(--wf-text-primary)" }}>
        {p.slice(2, -2)}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function CoPilotPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<"Build" | "Debug" | "Test">("Build");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "36px";
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, getAIResponse(text)]);
    }, 1400);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "36px";
    ta.style.height = Math.min(ta.scrollHeight, 68) + "px";
  };

  return (
    <div
      className="w-[280px] flex flex-col shrink-0"
      style={{ background: "var(--wf-bg-panel)", borderRight: "0.5px solid var(--wf-border-default)" }}
    >
      {/* Header */}
      <div className="px-3.5 py-3" style={{ borderBottom: "0.5px solid var(--wf-border-subtle)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
            style={{ background: "rgba(79,70,229,.25)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2 7h-4l2-7zM12 22l-2-7h4l-2 7zM2 12l7-2v4l-7-2zM22 12l-7 2v-4l7 2z" fill="#818CF8" />
            </svg>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--wf-text-primary)" }}>
            Co-pilot
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-px rounded uppercase"
            style={{ background: "rgba(79,70,229,.2)", color: "#818CF8", letterSpacing: ".06em" }}
          >
            Beta
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-[5px] h-[5px] rounded-full animate-[copilot-pulse_1.5s_ease-in-out_infinite]" style={{ background: "#34D399" }} />
          <span className="text-[10px]" style={{ color: "var(--wf-text-tertiary)" }}>Watching canvas</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2.5 px-3 studio-scroll">
        {/* Greeting */}
        <div
          className="rounded-[10px] p-3 mb-2.5"
          style={{ background: "rgba(255,255,255,.04)", border: "0.5px solid var(--wf-border-default)" }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--wf-text-primary)" }}>
            Building ICP Outbound Army
          </div>
          <div className="text-[11px] leading-relaxed" style={{ color: "var(--wf-text-secondary)" }}>
            5-step workflow using funding + hiring signals. Score leads with Claude, then branch into email outreach and CRM update in parallel.
          </div>
        </div>

        {/* Suggestion chips */}
        {messages.length === 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-left rounded-lg px-2.5 py-2 text-[11px] transition-all"
                style={{
                  border: "0.5px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.03)",
                  color: "var(--wf-text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(79,70,229,.4)";
                  e.currentTarget.style.background = "rgba(79,70,229,.07)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,.10)";
                  e.currentTarget.style.background = "rgba(255,255,255,.03)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end mt-3">
              <div
                className="max-w-[85%] px-3 py-2 text-[11px] text-white leading-relaxed"
                style={{ background: "var(--wf-primary)", borderRadius: "10px 10px 3px 10px" }}
              >
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2 mt-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(79,70,229,.3)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2 7h-4l2-7zM12 22l-2-7h4l-2 7zM2 12l7-2v4l-7-2zM22 12l-7 2v-4l7 2z" fill="#818CF8" />
                </svg>
              </div>
              <div>
                <div
                  className="px-3 py-2.5 text-[11px] leading-[1.6] whitespace-pre-line"
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "0.5px solid rgba(255,255,255,.08)",
                    borderRadius: "10px 10px 10px 3px",
                    color: "var(--wf-text-secondary)",
                  }}
                >
                  {renderText(msg.text)}
                </div>
                {msg.chips && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.chips.map((c) => (
                      <button
                        key={c}
                        className="px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer"
                        style={{
                          background: "rgba(79,70,229,.2)",
                          color: "#818CF8",
                          border: "0.5px solid rgba(79,70,229,.3)",
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Typing */}
        {typing && (
          <div className="flex items-center gap-1 mt-2 pl-7">
            {[0, 0.14, 0.28].map((d, i) => (
              <div
                key={i}
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: "rgba(255,255,255,.25)",
                  animation: `typing-bounce 0.7s ease-in-out ${d}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5" style={{ borderTop: "0.5px solid var(--wf-border-subtle)" }}>
        <div className="flex gap-1 mb-2">
          {(["Build", "Debug", "Test"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2.5 py-1 rounded text-[10px] transition-colors"
              style={
                mode === m
                  ? { background: "rgba(79,70,229,.25)", color: "#818CF8", fontWeight: 600 }
                  : { color: "var(--wf-text-tertiary)" }
              }
            >
              {m}
            </button>
          ))}
        </div>
        <div
          className="rounded-lg px-2.5 py-2 flex flex-col focus-within:border-[rgba(79,70,229,.5)]"
          style={{ background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.10)" }}
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder="Ask co-pilot to modify this workflow..."
            className="w-full bg-transparent border-none outline-none text-[11px] resize-none leading-relaxed"
            style={{ color: "var(--wf-text-primary)", minHeight: 36, maxHeight: 68, fontFamily: "Inter, sans-serif" }}
          />
          <div className="flex items-center justify-end gap-1.5 mt-1.5">
            {/* Mic */}
            <button className="w-6 h-6 flex items-center justify-center rounded" style={{ color: "var(--wf-text-hint)" }}>
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                <rect x="3" y="0" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1 6.5a4.5 4.5 0 009 0M5.5 11v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            {/* @ */}
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-medium"
              style={{ color: "var(--wf-text-hint)" }}
              onClick={() => setInput((p) => p + "@")}
            >
              @
            </button>
            {/* Send */}
            <button
              onClick={() => send(input)}
              className="w-[26px] h-[26px] rounded-md flex items-center justify-center transition-colors"
              style={{ background: "var(--wf-primary)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
