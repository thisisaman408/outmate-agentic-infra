import { useState } from "react";
import { T } from "./tokens";

export function CopilotOverlay({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [generated, setGenerated] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[7vh]"
      style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(16px)" }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="w-[640px] rounded-2xl overflow-hidden" style={{
        background: "rgba(14,14,22,.97)",
        border: `1px solid rgba(255,255,255,.06)`,
        boxShadow: "0 40px 100px rgba(0,0,0,.75), 0 0 0 0.5px rgba(255,255,255,.03), 0 0 100px rgba(79,70,184,.06)",
        backdropFilter: "blur(40px)",
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, #4F46B8 0%, #6358D4 100%)",
              boxShadow: "0 3px 12px rgba(79,70,184,.35)",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" fill="white" /></svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color: T.text }}>AI Copilot</div>
              <div className="text-[10px]" style={{ color: T.text35 }}>Describe your workflow in plain English</div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150"
            style={{ color: T.text35 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. Build an outbound workflow for funded SaaS accounts with enrichment, scoring, and multi-channel outreach..."
            rows={4}
            className="w-full text-[11px] rounded-xl px-5 py-4 resize-none transition-all duration-200 focus:outline-none"
            style={{
              background: "rgba(255,255,255,.025)",
              border: `1px solid ${T.border}`,
              color: T.text70,
              lineHeight: "1.75",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(79,70,184,.35)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,70,184,.08)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
          />

          <button onClick={() => setGenerated(true)}
            className="w-full mt-4 py-3.5 rounded-xl text-[11px] font-semibold text-white transition-all duration-300 cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryHover} 50%, #6358D4 100%)`,
              boxShadow: "0 2px 16px rgba(79,70,184,.3), inset 0 1px 0 rgba(255,255,255,.08)",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(79,70,184,.45), inset 0 1px 0 rgba(255,255,255,.1)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 16px rgba(79,70,184,.3), inset 0 1px 0 rgba(255,255,255,.08)")}
          >✦ Generate workflow</button>

          {/* Suggested prompts */}
          <div className="mt-7">
            <div className="text-[8px] uppercase font-bold mb-3 tracking-[.14em]" style={{ color: T.text20 }}>Suggested prompts</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Build outbound workflow for funded SaaS accounts",
                "Create visitor intent follow-up sequence",
                "Set up lead enrichment + scoring + CRM push",
                "Re-engagement workflow for no-response leads",
              ].map(s => (
                <button key={s} onClick={() => setPrompt(s)}
                  className="text-left text-[9px] px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-200 leading-relaxed"
                  style={{ background: "rgba(255,255,255,.02)", color: T.text50, border: `1px solid ${T.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primaryMuted; e.currentTarget.style.borderColor = T.primaryRing; e.currentTarget.style.color = T.primaryText; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.02)"; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text50; }}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="text-[8px] uppercase font-bold mb-3 tracking-[.14em]" style={{ color: T.text20 }}>Quick actions</div>
            <div className="flex flex-wrap gap-2">
              {["Suggest triggers", "Suggest integrations", "Optimize workflow", "Add exit paths"].map(a => (
                <button key={a}
                  className="text-[9px] font-medium px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
                  style={{ color: T.text50, background: "rgba(255,255,255,.02)", border: `1px solid ${T.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primaryMuted; e.currentTarget.style.color = T.primaryText; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.02)"; e.currentTarget.style.color = T.text50; }}
                >{a}</button>
              ))}
            </div>
          </div>

          {/* Generated result */}
          {generated && (
            <div className="mt-6 p-5 rounded-xl" style={{ background: T.primaryMuted, border: `1px solid ${T.primaryRing}` }}>
              <div className="text-[10.5px] font-semibold mb-2.5" style={{ color: T.primaryText }}>✦ Workflow generated</div>
              <div className="flex flex-col gap-1.5 text-[9.5px]" style={{ color: T.text50 }}>
                <div>→ Trigger: Funding alert + Predict Data Room</div>
                <div>→ Enrich with PDL + Clearbit</div>
                <div>→ Score with AI (threshold: 80)</div>
                <div>→ If score ≥80 → Email + LinkedIn + CRM</div>
                <div>→ If no reply → Wait + Voice AI</div>
                <div>→ Exit: converted / disqualified / no response</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
