import { useTheme } from "./tokens";

export function CopilotView() {
  const T = useTheme();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: T.canvas }}>
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${T.dotColor} 1.2px, transparent 1.2px)`,
        backgroundSize: "24px 24px",
      }} />
      <div className="relative z-10 flex flex-col items-center max-w-lg text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{
          background: T.primaryMuted,
          border: `1px solid ${T.primaryRing}`,
          boxShadow: `0 0 40px ${T.primaryGlow}`,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke={T.primaryText} strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: T.text }}>AI Co-pilot</h2>
        <p className="text-xs mb-8" style={{ color: T.text50 }}>
          Describe what you want to build and the AI will generate a complete workflow for you.
        </p>
        <div className="w-full rounded-2xl overflow-hidden" style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          boxShadow: T.nodeShadow,
        }}>
          <textarea
            rows={4}
            placeholder="e.g. Create an outbound sequence that enriches leads from Predict Data Room, scores them, and sends personalised emails..."
            className="w-full px-5 py-4 text-xs resize-none focus:outline-none"
            style={{ background: "transparent", color: T.text, }}
          />
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
            <span className="text-[9px]" style={{ color: T.text35 }}>Powered by Outmate AI</span>
            <button className="px-5 py-2 rounded-lg text-[10px] font-semibold text-white cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${T.primary} 0%, #CC9A1D 100%)` }}>
              Generate workflow →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          {["Outbound email cadence", "Lead scoring pipeline", "Multi-channel sequence", "ICP enrichment flow"].map(s => (
            <button key={s} className="px-3 py-1.5 rounded-lg text-[9px] font-medium cursor-pointer transition-colors"
              style={{ background: T.text10, color: T.text50, border: `1px solid ${T.border}` }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
