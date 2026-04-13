import { useTheme } from "./tokens";

export function EnrollmentView({ isLive, onToggleLive }: { isLive: boolean; onToggleLive: () => void }) {
  const T = useTheme();

  const metrics = [
    { label: "Target", val: "People" },
    { label: "Runs", val: "0" },
    { label: "Completed", val: "0" },
    { label: "In progress", val: "0" },
    { label: "Failed", val: "0" },
    { label: "Credit usage", val: "N/A", hasInfo: true },
  ];

  return (
    <div className="flex-1 overflow-auto flex flex-col" style={{ background: T.bg }}>
      {/* Inactive banner */}
      {!isLive && (
        <div className="flex items-center justify-between px-6 py-3" style={{
          background: T.text10,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={T.text35} strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="12" stroke={T.text35} strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill={T.text35}/></svg>
            <span className="text-[11px]" style={{ color: T.text50 }}>This workflow is currently inactive. Activate it to start running.</span>
          </div>
          <button onClick={onToggleLive} className="text-[11px] font-medium cursor-pointer" style={{ color: T.primaryText }}>Activate workflow</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[260px] shrink-0 p-5 overflow-y-auto" style={{ borderRight: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: T.text }}>Record runs</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: T.text10, color: T.text50 }}>0</span>
            </div>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: T.text35 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </div>
          <div className="text-[10px] mb-5" style={{ color: T.text35 }}>Max limits: unlimited per workflow</div>

          {/* Pre-qualified card */}
          <div className="rounded-xl p-4" style={{ background: T.primaryMuted, border: `1px solid ${T.primaryRing}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold" style={{ color: T.primaryText }}>Pre-qualified</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={T.primaryText} strokeWidth="2" opacity=".5"/><line x1="12" y1="8" x2="12" y2="12" stroke={T.primaryText} strokeWidth="2" strokeLinecap="round" opacity=".5"/><circle cx="12" cy="16" r="1" fill={T.primaryText} opacity=".5"/></svg>
            </div>
            <div className="text-[9px]" style={{ color: T.text50 }}>Next run: Activate to start running</div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Metrics bar */}
          <div className="flex items-stretch" style={{ borderBottom: `1px solid ${T.border}` }}>
            {metrics.map((m, i) => (
              <div key={m.label} className="flex-1 px-5 py-4" style={{
                borderRight: i < metrics.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <div className="text-[10px] mb-1 flex items-center gap-1.5" style={{ color: T.text35 }}>
                  {m.label}
                  {m.hasInfo && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>}
                </div>
                <div className="text-[16px] font-semibold" style={{ color: T.text }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-[500px]">
              <div className="mb-5 flex justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke={T.primaryText} strokeWidth="2" opacity=".5"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={T.primaryText} strokeWidth="2" strokeLinecap="round" opacity=".5"/>
                </svg>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: T.text35 }}>
                Records will appear once the specified event happens and the enrollment criteria are met. Keep in mind, event triggers might take a bit longer since they depend on the event occurring.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
