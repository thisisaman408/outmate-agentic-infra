import { useState, useRef, useEffect, useCallback } from "react";

/* ─── types ─── */
interface Notification {
  dot: string;
  title: string;
  body: string;
  time: string;
  cta: string;
}

interface BriefItem {
  dot: string;
  title: string;
  body: string;
  cta: string;
}

interface ChatMsg {
  role: "user" | "ai";
  text: string;
}

/* ─── data ─── */
const NOTIFICATIONS: Notification[] = [
  { dot: "#991B1B", title: "Hot visitor — BigStep Tech", body: "Rithik Kumar (CTO, ICP 84) hit your pricing page 4 min ago. Never contacted.", time: "4 min ago", cta: "Open prospect brief →" },
  { dot: "#4F46E5", title: "Daily brief ready", body: "7 actions: 2 hot visitors, 1 champion job change, 1 meeting in 2 hrs, 3 low open rate sequences.", time: "8:00 AM today", cta: "View Daily Brief →" },
  { dot: "#92400E", title: "Meeting in 28 minutes — Rajiv Mehta", body: "CloudBase · Pre-call brief ready with 3 objections flagged.", time: "28 min", cta: "Open Meeting Prep →" },
  { dot: "#065F46", title: "Reply: Interested — Ananya Sharma", body: "Replied to Day 3 email. Asked about team pricing. Response drafted and ready.", time: "1 hr ago", cta: "Review + approve reply →" },
  { dot: "#92400E", title: "Sequence health drop", body: "Intent Outreach v2 dropped to 3.1% open rate (was 8.4%). 3 rewrites ready.", time: "2 hrs ago", cta: "Open Campaign Optimizer →" },
  { dot: "#5B21B6", title: "Champion moved jobs", body: "Priya Sharma joined Growify as VP Sales. ICP 91. Warm re-intro drafted.", time: "3 hrs ago", cta: "Review warm re-intro →" },
];

const BRIEF_ITEMS: BriefItem[] = [
  { dot: "#991B1B", title: "BigStep Tech hit your pricing page", body: "Rithik Kumar (CTO) · ICP score 84 · 3 pages viewed · Never contacted", cta: "Open prospect brief →" },
  { dot: "#5B21B6", title: "Champion moved jobs — act within 48 hrs", body: "Priya Sharma → VP Sales at Growify · ICP 91 · Warm re-intro drafted", cta: "Review re-intro →" },
  { dot: "#4F46E5", title: "Call with Rajiv Mehta in 2 hours", body: "CloudBase · Meeting prep brief ready · 3 objections pre-loaded", cta: "Open brief →" },
  { dot: "#065F46", title: "Reply: Interested — Ananya Sharma", body: "Replied to Day 3 outreach · Asked about team pricing for 20+ seats", cta: "Review + approve reply →" },
  { dot: "#065F46", title: "2 new funded companies matched your ICP", body: "Series A · Both in SaaS · Enrichment + outreach queued", cta: "Review before send →" },
  { dot: "#92400E", title: "Sequence open rate dropped — Intent Outreach v2", body: "3.1% open rate (was 8.4%) · 3 subject line rewrites ready", cta: "Open Campaign Optimizer →" },
  { dot: "#888780", title: "Email domain warmth dropped to 72", body: "Warm-up agent paused high-volume sends · Check deliverability", cta: "View deliverability →" },
];

const DEALS = [
  { company: "Acme Corp", stage: "Proposal", date: "28/03/2026", value: "$10,000", warn: false },
  { company: "CloudBase", stage: "Negotiation", date: "16/03/2026", value: "$18,000", warn: true, warnText: "12 days no activity" },
  { company: "FinNext Technologies", stage: "Discovery", date: "19/03/2026", value: "$9,000", warn: true, warnText: "9 days no activity" },
  { company: "Growify", stage: "Proposal Sent", date: "25/03/2026", value: "$6,500", warn: false },
];

/* ─── chat response logic ─── */
function getChatResponse(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("contact today") || m.includes("who should"))
    return "Based on today's signals:\n1. BigStep Tech (ICP 84, on site now)\n2. Priya Sharma job change (ICP 91, 48hr window)\n3. Ananya Sharma reply needs your approval.\n\nWant me to draft outreach for any of these?";
  if (m.includes("call") || m.includes("prep") || m.includes("meeting"))
    return "Your next call is with Rajiv Mehta at CloudBase in 28 minutes. Brief is ready with 3 objections flagged. Opening Meeting Prep now.";
  if (m.includes("stuck") || m.includes("pipeline") || m.includes("deals"))
    return "2 deals at risk:\n• CloudBase ($18k, 12 days stuck in Negotiation)\n• FinNext ($9k, 9 days no activity in Discovery)\n\nI've drafted a re-engage angle for each. Want to see them?";
  if (m.includes("email") || m.includes("sequence") || m.includes("open rate"))
    return "Intent Outreach v2 dropped to 3.1% open rate. I have 3 subject line rewrites ready. Want to review them in Campaign Optimizer?";
  return "Got it. Let me pull that from your pipeline data. Give me a moment...";
}

/* ─── inline styles ─── */
const S = {
  page: "#0C0C0F",
  panel: "#111114",
  node: "#1A1A20",
  border: "rgba(255,255,255,.08)",
  borderSubtle: "rgba(255,255,255,.06)",
  borderStrong: "rgba(255,255,255,.12)",
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  text: "#fff",
  text70: "rgba(255,255,255,.7)",
  text55: "rgba(255,255,255,.55)",
  text40: "rgba(255,255,255,.4)",
  text30: "rgba(255,255,255,.3)",
  text25: "rgba(255,255,255,.25)",
};

/* ═════════════════ COMPONENT ═════════════════ */
export default function CoPilotV2Page() {
  const [tab, setTab] = useState<"brief" | "meeting" | "campaign" | "pipeline">("brief");
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatTyping, setChatTyping] = useState(false);

  // Campaign pre-fill state
  const [campSubject, setCampSubject] = useState("Quick question about your outreach stack");
  const [campOpen, setCampOpen] = useState("3");
  const [campReply, setCampReply] = useState("1");

  // Meeting prep form
  const [meetCompany, setMeetCompany] = useState("");
  const [meetDomain, setMeetDomain] = useState("");
  const [meetName, setMeetName] = useState("");
  const [meetTitle, setMeetTitle] = useState("");

  const bellRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Click-outside for notification dropdown
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node) &&
          bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatTyping]);

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    setChatMsgs(prev => [...prev, { role: "user", text: text.trim() }]);
    setChatInput("");
    setChatTyping(true);
    setTimeout(() => {
      setChatMsgs(prev => [...prev, { role: "ai", text: getChatResponse(text) }]);
      setChatTyping(false);
    }, 900);
  }, []);

  const TABS = [
    { id: "brief" as const, label: "Daily Brief" },
    { id: "meeting" as const, label: "Meeting Prep" },
    { id: "campaign" as const, label: "Campaign Optimizer" },
    { id: "pipeline" as const, label: "Pipeline Alerts" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: S.page, fontFamily: "Inter, sans-serif" }}>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: S.panel, borderColor: S.border }}>
        <div className="flex items-center gap-2.5">
          {/* ✦ icon */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(79,70,229,.25)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#818CF8"/></svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: S.text }}>Co-Pilot</span>
          <span className="text-[11px]" style={{ color: S.text40 }}>AI-powered sales intelligence</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Bell */}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setNotifOpen(p => !p)}
              className="w-9 h-9 rounded-lg flex items-center justify-center relative transition-colors"
              style={{ background: "rgba(255,255,255,.06)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 2a4 4 0 00-4 4v3a4 4 0 01-1 2.7V13h10v-1.3A4 4 0 0114 9V6a4 4 0 00-4-4zM9 15h2a1 1 0 01-2 0z" fill="rgba(255,255,255,.6)"/>
              </svg>
              <div className="absolute flex items-center justify-center" style={{ top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: S.primary, fontSize: 9, fontWeight: 700, color: "#fff" }}>3</div>
            </button>
            {/* Notification dropdown */}
            {notifOpen && (
              <div ref={notifRef} className="absolute z-[100]" style={{ top: "calc(100% + 8px)", right: 0, width: 360, background: S.node, border: `0.5px solid ${S.borderStrong}`, borderRadius: 12, overflow: "hidden" }}>
                <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderBottom: `0.5px solid ${S.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Notifications</span>
                  <button style={{ fontSize: 11, color: "#4F46E5", cursor: "pointer", background: "none", border: "none" }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {NOTIFICATIONS.map((n, i) => (
                    <div key={i} className="flex gap-2.5 items-start cursor-pointer transition-colors" style={{ padding: "11px 14px", borderBottom: `0.5px solid ${S.borderSubtle}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <div className="shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", background: n.dot, marginTop: 4 }} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 12, fontWeight: 500, color: S.text, marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: S.text55, lineHeight: 1.4 }}>{n.body}</div>
                        <div style={{ fontSize: 10, color: S.text30, marginTop: 4 }}>{n.time}</div>
                        <span style={{ fontSize: 10, color: "#818CF8", fontWeight: 500, marginTop: 3, display: "block", cursor: "pointer" }}>{n.cta}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 14px", borderTop: `0.5px solid ${S.border}`, textAlign: "center", fontSize: 11, color: "#818CF8", cursor: "pointer" }}>View all notifications</div>
              </div>
            )}
          </div>
          {/* Credits */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,.06)", fontSize: 11, color: S.text70 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,.4)" strokeWidth="1.3"/><path d="M8 4v4l2.5 1.5" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" strokeLinecap="round"/></svg>
            85 credits
          </div>
          {/* Settings */}
          <button className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,.06)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.10)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="rgba(255,255,255,.5)" strokeWidth="1.5"/>
              <path d="M10 1.5l1.3 2.2a1 1 0 00.9.5h2.5l-.8 2.4a1 1 0 00.2 1l1.7 1.9-2 1.4a1 1 0 00-.5.9v2.5l-2.4-.8a1 1 0 00-1 .2L10 15.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b" style={{ background: S.panel, borderColor: S.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-5 py-2.5 text-xs font-medium transition-colors relative"
            style={{ color: tab === t.id ? S.text : S.text40, fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: S.primary }} />}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-3xl mx-auto">

          {/* ════ DAILY BRIEF ════ */}
          {tab === "brief" && (
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: 12, color: S.text40 }}>Friday, 28 March 2026</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: S.text }}>7 actions for today</span>
                </div>
                <button className="px-2.5 py-1 rounded-md transition-colors" style={{ fontSize: 11, color: S.text40, border: `0.5px solid rgba(255,255,255,.1)`, background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M14 8A6 6 0 114.8 4.2" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 1v3.5h3.5" stroke="rgba(255,255,255,.4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Refresh
                  </span>
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {BRIEF_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl cursor-pointer transition-colors" style={{ background: "rgba(255,255,255,.04)", border: `0.5px solid ${S.border}`, borderRadius: 10, padding: "11px 13px" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}>
                    <div className="shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, marginTop: 5 }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 500, color: S.text }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: S.text55, lineHeight: 1.4, marginTop: 2 }}>{item.body}</div>
                      <span style={{ fontSize: 10, color: "#818CF8", fontWeight: 500, marginTop: 3, display: "block" }}>{item.cta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ MEETING PREP ════ */}
          {tab === "meeting" && (
            <div>
              {/* Upcoming meeting card */}
              <div className="flex flex-col gap-2 rounded-xl mb-2.5" style={{ background: "rgba(16,185,129,.08)", border: "0.5px solid rgba(16,185,129,.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", animation: "pulse-notif 1.5s ease-in-out infinite" }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#34D399" }}>Brief ready — Rajiv Mehta · CloudBase · in 28 min</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(52,211,153,.7)", lineHeight: 1.4 }}>3 objections flagged · Company news from last 7 days pulled · CRM history: 2 prior touchpoints</div>
                <button className="self-start mt-1 transition-colors" style={{ background: "rgba(16,185,129,.15)", color: "#34D399", border: "0.5px solid rgba(16,185,129,.3)", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>View Meeting Brief</button>
              </div>

              {/* Auto-trigger banner */}
              <div className="flex items-start gap-2.5 rounded-xl mb-3.5" style={{ background: "rgba(79,70,229,.12)", border: "0.5px solid rgba(79,70,229,.3)", borderRadius: 10, padding: "11px 14px" }}>
                <svg width="16" height="16" viewBox="0 0 16 17" fill="none" className="shrink-0 mt-0.5">
                  <rect x="2" y="3" width="12" height="12" rx="2" stroke="#818CF8" strokeWidth="1.5" fill="none"/>
                  <path d="M8 2v2M4 7h8" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#818CF8" }}>Auto-trigger connected</div>
                  <div style={{ fontSize: 11, color: "rgba(129,140,248,.8)", marginTop: 2, lineHeight: 1.4 }}>Co-Pilot will auto-generate a brief 30 minutes before any Google Calendar meeting. The form below is for on-demand briefs.</div>
                </div>
              </div>

              {/* Form card */}
              <div className="rounded-xl" style={{ background: "rgba(255,255,255,.04)", border: `0.5px solid ${S.border}`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 14 }}>On-demand Meeting Prep</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Company Name", value: meetCompany, set: setMeetCompany, ph: "e.g. CloudBase" },
                    { label: "Domain", value: meetDomain, set: setMeetDomain, ph: "e.g. cloudbase.io" },
                    { label: "Prospect Name", value: meetName, set: setMeetName, ph: "e.g. Rajiv Mehta" },
                    { label: "Title", value: meetTitle, set: setMeetTitle, ph: "e.g. VP Engineering" },
                  ].map((f, i) => (
                    <div key={i}>
                      <label style={{ fontSize: 10, fontWeight: 500, color: S.text40, display: "block", marginBottom: 4 }}>{f.label}</label>
                      <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                        className="w-full outline-none"
                        style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid rgba(255,255,255,.10)`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: S.text, fontFamily: "Inter, sans-serif" }} />
                    </div>
                  ))}
                </div>
                <button className="transition-colors" style={{ background: S.primary, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Generate Pre-Call Brief</button>
              </div>
            </div>
          )}

          {/* ════ CAMPAIGN OPTIMIZER ════ */}
          {tab === "campaign" && (
            <div>
              {/* Alert banner */}
              <div className="flex items-start gap-2.5 rounded-xl mb-3.5" style={{ background: "rgba(245,158,11,.10)", border: "0.5px solid rgba(245,158,11,.25)", borderRadius: 10, padding: "11px 14px" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                  <path d="M8 3L15 14H1L8 3z" stroke="#FCD34D" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                  <path d="M8 8v3M8 12.5v.5" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#FCD34D" }}>Sequence health alert — Intent Outreach v2</div>
                  <div style={{ fontSize: 11, color: "rgba(252,211,77,.75)", marginTop: 2, lineHeight: 1.4 }}>Open rate dropped from 8.4% to 3.1% this week. Form below is pre-filled with your sequence data. 3 rewrites ready after analysis.</div>
                </div>
              </div>

              {/* Form card */}
              <div className="rounded-xl" style={{ background: "rgba(255,255,255,.04)", border: `0.5px solid ${S.border}`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 14 }}>Optimize Campaign</div>
                <div className="flex flex-col gap-3 mb-3">
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: S.text40, display: "block", marginBottom: 4 }}>Subject Line</label>
                    <input value={campSubject} onChange={e => setCampSubject(e.target.value)}
                      className="w-full outline-none"
                      style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid rgba(255,255,255,.10)`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: S.text, fontFamily: "Inter, sans-serif" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: S.text40, display: "block", marginBottom: 4 }}>Open Rate %</label>
                      <input value={campOpen} onChange={e => setCampOpen(e.target.value)}
                        className="w-full outline-none"
                        style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid rgba(255,255,255,.10)`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: S.text, fontFamily: "Inter, sans-serif" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: S.text40, display: "block", marginBottom: 4 }}>Reply Rate %</label>
                      <input value={campReply} onChange={e => setCampReply(e.target.value)}
                        className="w-full outline-none"
                        style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid rgba(255,255,255,.10)`, borderRadius: 7, padding: "7px 10px", fontSize: 11, color: S.text, fontFamily: "Inter, sans-serif" }} />
                    </div>
                  </div>
                </div>
                <button className="transition-colors" style={{ background: S.primary, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Analyze + Rewrite</button>
              </div>
            </div>
          )}

          {/* ════ PIPELINE ALERTS ════ */}
          {tab === "pipeline" && (
            <div>
              {/* CRM sync banner */}
              <div className="flex items-center justify-between rounded-xl mb-3" style={{ background: "rgba(16,185,129,.08)", border: "0.5px solid rgba(16,185,129,.2)", borderRadius: 10, padding: "10px 14px" }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", animation: "pulse-notif 1.5s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, color: "rgba(52,211,153,.8)" }}>HubSpot synced · 12 active deals pulled · Last sync: 2 min ago</span>
                </div>
                <button style={{ fontSize: 10, color: "#34D399", border: "0.5px solid rgba(16,185,129,.3)", borderRadius: 5, padding: "3px 9px", background: "transparent", cursor: "pointer" }}>Sync now</button>
              </div>

              {/* Deals table */}
              <div className="rounded-xl" style={{ background: "rgba(255,255,255,.04)", border: `0.5px solid ${S.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Enter Your Deals</span>
                  <button className="flex items-center gap-1.5 transition-colors" style={{ background: S.primary, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Detect Risks
                    <span style={{ background: "rgba(239,68,68,.2)", color: "#F87171", borderRadius: 4, padding: "1px 5px", fontSize: 9, marginLeft: 4 }}>2 at risk</span>
                  </button>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-4 gap-2 mb-1.5" style={{ fontSize: 9, fontWeight: 600, color: S.text25, textTransform: "uppercase", letterSpacing: ".06em", padding: "0 8px" }}>
                  <span>Company</span><span>Stage</span><span>Close Date</span><span>Value</span>
                </div>
                {/* Rows */}
                {DEALS.map((d, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-4 gap-2 rounded-lg items-center" style={{ padding: "8px 8px", fontSize: 11, color: S.text70, background: d.warn ? "rgba(239,68,68,.05)" : "transparent" }}>
                      <div className="flex items-center gap-1.5">
                        {d.warn && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F87171" }} />}
                        <span style={{ fontWeight: 500, color: S.text }}>{d.company}</span>
                      </div>
                      <span>{d.stage}</span>
                      <span>{d.date}</span>
                      <span>{d.value}</span>
                    </div>
                    {d.warn && d.warnText && (
                      <div style={{ fontSize: 9, color: "#F87171", paddingLeft: 22, marginTop: -2, marginBottom: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}>
                          <path d="M8 3L15 14H1L8 3z" stroke="#F87171" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                        </svg>
                        {d.warnText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING BUTTON ── */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed z-[200] flex items-center justify-center transition-transform hover:scale-105"
          style={{ bottom: 24, right: 24, width: 48, height: 48, borderRadius: 14, background: S.primary, border: "none", cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#fff"/></svg>
        </button>
      )}

      {/* ── CHAT OVERLAY ── */}
      {chatOpen && (
        <div className="fixed z-[200] flex flex-col" style={{ bottom: 80, right: 24, width: 380, height: 520, background: S.panel, border: `0.5px solid ${S.borderStrong}`, borderRadius: 16 }}>
          {/* Header */}
          <div className="flex items-center justify-between shrink-0" style={{ height: 52, borderBottom: `0.5px solid ${S.border}`, padding: "0 14px" }}>
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center" style={{ background: "rgba(79,70,229,.3)" }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#818CF8"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Ask Outmate</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(79,70,229,.2)", color: "#818CF8", borderRadius: 4, padding: "1px 5px" }}>BETA</span>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ width: 24, height: 24, background: "none", border: "none", cursor: "pointer", color: S.text40, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => (e.currentTarget.style.color = S.text70)}
              onMouseLeave={e => (e.currentTarget.style.color = S.text40)}>×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ padding: 12, scrollbarWidth: "thin" }}>
            {/* Greeting */}
            <div className="flex gap-2 items-start">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(79,70,229,.3)" }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#818CF8"/></svg>
              </div>
              <div style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid ${S.border}`, borderRadius: "10px 10px 10px 3px", padding: "10px 12px", fontSize: 11, color: S.text70, lineHeight: 1.5, maxWidth: "88%" }}>
                Hi Gautam. You have 7 actions today. BigStep Tech (ICP 84) is on your site right now and has never been contacted. Want me to draft an outreach?
              </div>
            </div>
            {/* Quick chips */}
            {chatMsgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5 ml-7">
                {["Who should I contact today?", "Prep me for my next call", "Show stuck deals"].map((c, i) => (
                  <button key={i} onClick={() => sendChat(c)}
                    style={{ background: "rgba(79,70,229,.15)", border: "0.5px solid rgba(79,70,229,.3)", color: "#818CF8", borderRadius: 6, padding: "4px 9px", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>{c}</button>
                ))}
              </div>
            )}
            {/* Messages */}
            {chatMsgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2 items-start"}>
                {m.role === "ai" && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(79,70,229,.3)" }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#818CF8"/></svg>
                  </div>
                )}
                <div style={{
                  ...(m.role === "user"
                    ? { background: S.primary, color: "#fff", borderRadius: "10px 10px 3px 10px" }
                    : { background: "rgba(255,255,255,.05)", border: `0.5px solid ${S.border}`, color: S.text70, borderRadius: "10px 10px 10px 3px" }),
                  padding: "10px 12px", fontSize: 11, lineHeight: 1.5, maxWidth: "88%", whiteSpace: "pre-wrap" as const,
                }}>{m.text}</div>
              </div>
            ))}
            {chatTyping && (
              <div className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(79,70,229,.3)" }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 0l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z" fill="#818CF8"/></svg>
                </div>
                <div className="flex gap-1 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,.05)" }}>
                  {[0, 1, 2].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: S.text30, animation: `typing-dot 0.7s ease-in-out ${d * 0.14}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 flex items-center gap-2" style={{ borderTop: `0.5px solid ${S.border}`, padding: "10px 12px" }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
              placeholder="Ask anything about your pipeline..."
              className="flex-1 outline-none resize-none"
              rows={1}
              style={{ background: "rgba(255,255,255,.05)", border: `0.5px solid rgba(255,255,255,.10)`, borderRadius: 8, padding: "8px 10px", fontSize: 11, color: S.text, fontFamily: "Inter, sans-serif", minHeight: 36, maxHeight: 60 }} />
            <button onClick={() => sendChat(chatInput)}
              className="shrink-0 flex items-center justify-center transition-colors"
              style={{ width: 32, height: 32, background: S.primary, borderRadius: 8, border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = S.primaryHover)}
              onMouseLeave={e => (e.currentTarget.style.background = S.primary)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 14l12-6L2 2v5l8 1-8 1v5z" fill="#fff"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
