import { useTheme } from "./tokens";

const NOTIFICATIONS = [
  { id: 1, type: "warning", title: "Enrichment rate dropped", desc: "Waterfall Enrich node success rate fell below 60%", time: "2m ago" },
  { id: 2, type: "success", title: "Workflow activated", desc: "GTM Leadership workflow is now live", time: "15m ago" },
  { id: 3, type: "info", title: "New records enrolled", desc: "47 new contacts entered the pipeline", time: "1h ago" },
  { id: 4, type: "error", title: "HubSpot sync failed", desc: "CRM Push node failed for 3 records — auth expired", time: "2h ago" },
  { id: 5, type: "info", title: "AI model updated", desc: "Lead scoring model retrained with latest data", time: "5h ago" },
];

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const T = useTheme();
  const typeStyles: Record<string, { color: string; bg: string }> = {
    warning: { color: T.amberText, bg: T.amberMuted },
    success: { color: T.greenText, bg: T.greenMuted },
    error: { color: T.redText, bg: T.redMuted },
    info: { color: T.primaryText, bg: T.primaryMuted },
  };

  return (
    <div className="absolute top-[90px] right-5 z-50 w-[340px] rounded-2xl overflow-hidden" style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      boxShadow: T.nodeActiveShadow,
      backdropFilter: "blur(24px)",
    }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <span className="text-xs font-semibold" style={{ color: T.text }}>Notifications</span>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: T.text35 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {NOTIFICATIONS.map(n => {
          const s = typeStyles[n.type] || typeStyles.info;
          return (
            <div key={n.id} className="flex gap-3 px-5 py-3.5 cursor-pointer transition-colors"
              style={{ borderBottom: `1px solid ${T.borderSubtle}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-medium" style={{ color: T.text }}>{n.title}</div>
                <div className="text-[9px] mt-0.5" style={{ color: T.text50 }}>{n.desc}</div>
                <div className="text-[8px] mt-1" style={{ color: T.text35 }}>{n.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
