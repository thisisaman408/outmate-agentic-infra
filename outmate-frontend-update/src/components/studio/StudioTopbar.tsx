import { useState, useRef, useCallback } from "react";
import { Bell, Save, Check, Share2, ArrowRight } from "lucide-react";
import { C } from "./constants";
import NotificationPanel from "./NotificationPanel";

interface Props {
  agentName: string;
  onNameChange: (n: string) => void;
  published: boolean;
  onPublish: () => void;
}

export default function StudioTopbar({ agentName, onNameChange, published, onPublish }: Props) {
  const [editing, setEditing] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); };

  return (
    <div className="h-[52px] flex items-center justify-between px-4 border-b shrink-0"
      style={{ background: C.panel, borderColor: C.border08 }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ background: C.primary }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /><path d="M12 2v15M4 7l8 5 8-5" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          </div>
          <span className="text-[13px] font-bold" style={{ color: C.text }}>Outmate</span>
        </div>
        <div className="w-px h-5" style={{ background: C.border07 }} />
        {/* Agent name */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[12px]" style={{ background: C.primary }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#fff" /></svg>
          </div>
          {editing ? (
            <input ref={inputRef} value={agentName} onChange={e => onNameChange(e.target.value)}
              onBlur={() => setEditing(false)} onKeyDown={e => e.key === "Enter" && setEditing(false)}
              className="text-sm font-semibold bg-transparent outline-none border-b"
              style={{ color: C.text, borderColor: C.primary, width: `${Math.max(agentName.length, 10)}ch` }} />
          ) : (
            <button onClick={startEdit} className="text-sm font-semibold" style={{ color: C.text }}>{agentName}</button>
          )}
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={published
              ? { background: "rgba(16,185,129,.12)", color: "#34D399", border: "1px solid rgba(16,185,129,.3)" }
              : { background: "rgba(255,255,255,.07)", color: C.text35 }}>
            {published ? "Published" : "Draft"}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Bell */}
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,.05)" }}>
            <Bell size={15} style={{ color: C.text40 }} />
            {hasUnread && <div className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full border-2" style={{ background: "#EF4444", borderColor: C.panel }} />}
          </button>
          <NotificationPanel open={showNotif} onClose={() => setShowNotif(false)} onMarkAllRead={useCallback(() => setHasUnread(false), [])} />
        </div>

        <button className="h-8 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium border transition-colors"
          style={{ background: "rgba(255,255,255,.05)", borderColor: C.border, color: C.text40 }}>
          <Save size={13} /> Save
        </button>
        <button onClick={onPublish}
          className="h-8 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium border transition-colors"
          style={{ background: "rgba(16,185,129,.12)", borderColor: "rgba(16,185,129,.3)", color: "#34D399" }}>
          <Check size={13} /> Publish
        </button>
        <button className="h-8 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium border transition-colors"
          style={{ background: "rgba(79,70,229,.12)", borderColor: "rgba(79,70,229,.3)", color: "#818CF8" }}>
          <Share2 size={13} /> Share
        </button>
        <button className="h-8 px-3 rounded-md flex items-center gap-1.5 text-xs font-semibold transition-colors"
          style={{ background: C.primary, color: "#fff" }}>
          <ArrowRight size={13} /> Deploy
        </button>
      </div>
    </div>
  );
}
