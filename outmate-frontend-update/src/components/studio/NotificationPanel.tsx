import { useEffect, useRef } from "react";
import { C } from "./constants";

const NOTIFICATIONS = [
  { icon: "green", title: "Agent completed run", sub: "ICP Outbound — 34 leads enriched", time: "2m ago", unread: true },
  { icon: "amber", title: "Signal detected", sub: "Hiring spike at Notion · 12 new roles", time: "8m ago", unread: true },
  { icon: "indigo", title: "SDR activity", sub: "AI SDR sent 28 emails — 3 replies pending", time: "1h ago", unread: false },
  { icon: "red", title: "Credit warning", sub: "Monthly usage at 82% — 540 credits left", time: "3h ago", unread: false },
];

const iconColors: Record<string, string> = { green: "#34D399", amber: "#FCD34D", indigo: "#818CF8", red: "#F87171" };
const iconBgs: Record<string, string> = { green: "rgba(16,185,129,.15)", amber: "rgba(245,158,11,.15)", indigo: "rgba(79,70,229,.2)", red: "rgba(239,68,68,.12)" };

interface Props { open: boolean; onClose: () => void; onMarkAllRead: () => void }

export default function NotificationPanel({ open, onClose, onMarkAllRead }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute top-full right-0 mt-1 z-[100] w-[300px] rounded-xl border py-2"
      style={{ background: "#1A1A22", borderColor: C.border }}>
      <div className="flex items-center justify-between px-3 pb-2 border-b" style={{ borderColor: C.border07 }}>
        <span className="text-xs font-semibold" style={{ color: C.text }}>Notifications</span>
        <button className="text-[10px] font-medium" style={{ color: "#818CF8" }} onClick={onMarkAllRead}>Mark all read</button>
      </div>
      {NOTIFICATIONS.map((n, i) => (
        <div key={i} className="flex items-start gap-2.5 px-3 py-2.5" style={{ background: n.unread ? "rgba(79,70,229,.05)" : "transparent" }}>
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: iconBgs[n.icon] }}>
            <div className="w-2 h-2 rounded-full" style={{ background: iconColors[n.icon] }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium" style={{ color: C.text }}>{n.title}</div>
            <div className="text-[10px] truncate" style={{ color: C.text30 }}>{n.sub}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px]" style={{ color: C.text25 }}>{n.time}</span>
            {n.unread && <div className="w-[6px] h-[6px] rounded-full" style={{ background: "#818CF8" }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
