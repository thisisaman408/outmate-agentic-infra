import type { WfNodeData } from "@/data/workflowNodes";

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: "rgba(59,130,246,.15)", text: "#60A5FA" },
  purple: { bg: "rgba(168,85,247,.15)", text: "#C084FC" },
  green: { bg: "rgba(16,185,129,.15)", text: "#34D399" },
  amber: { bg: "rgba(245,158,11,.15)", text: "#FCD34D" },
  gray: { bg: "rgba(255,255,255,.07)", text: "rgba(255,255,255,.4)" },
  red: { bg: "rgba(239,68,68,.12)", text: "#F87171" },
};

function NodeIcon({ type, color }: { type: string; color: string }) {
  switch (type) {
    case "signal":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="8" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="8" y1="14" x2="16" y2="14" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "enrich":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
          <path d="M12 7v5l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "score":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" stroke={color} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case "email":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M3 7l9 6 9-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "crm":
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" fill={color} opacity=".7" />
          <rect x="14" y="3" width="7" height="7" rx="1" fill={color} opacity=".7" />
          <rect x="3" y="14" width="7" height="7" rx="1" fill={color} opacity=".7" />
          <rect x="14" y="14" width="7" height="7" rx="1" fill={color} opacity=".5" />
        </svg>
      );
    default:
      return null;
  }
}

const STATUS: Record<string, { bg: string; text: string; dot?: string; label: string }> = {
  configured: { bg: "rgba(16,185,129,.15)", text: "#34D399", dot: "#34D399", label: "Configured" },
  active: { bg: "rgba(79,70,229,.2)", text: "#818CF8", dot: "#818CF8", label: "Active" },
  pending: { bg: "rgba(255,255,255,.06)", text: "var(--wf-text-tertiary)", label: "Pending" },
};

interface Props {
  node: WfNodeData;
  selected: boolean;
  onClick: () => void;
  isFirst?: boolean;
}

export default function WorkflowNode({ node, selected, onClick, isFirst }: Props) {
  const st = STATUS[node.status];

  return (
    <div
      className="relative w-[300px] rounded-[14px] cursor-default transition-all"
      onClick={onClick}
      style={{
        background: "var(--wf-bg-node)",
        border: `0.5px solid ${selected ? "var(--wf-primary)" : "rgba(255,255,255,.10)"}`,
        boxShadow: selected ? "0 0 0 3px var(--wf-primary-ring)" : undefined,
      }}
    >
      {/* Top port */}
      {!isFirst && (
        <div
          className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-colors"
          style={{ background: "var(--wf-bg-node)", borderColor: "rgba(255,255,255,.15)" }}
        />
      )}

      {/* Topbar */}
      <div
        className="h-9 flex items-center justify-between px-3"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,.06)" }}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--wf-text-hint)", letterSpacing: ".08em" }}>
          Step {node.step}
        </span>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold"
            style={{ background: st.bg, color: st.text, border: `0.5px solid ${st.dot || "rgba(255,255,255,.1)"}25`, letterSpacing: ".04em" }}
          >
            {st.dot && (
              <div
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: st.dot,
                  animation: node.status === "active" ? "copilot-pulse 1.5s ease-in-out infinite" : undefined,
                }}
              />
            )}
            {st.label}
          </div>
          <button
            className="w-[22px] h-[22px] rounded flex items-center justify-center transition-colors"
            style={{ color: "var(--wf-text-tertiary)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5">
        {/* Icon + title */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: node.iconBg }}>
            <NodeIcon type={node.iconType} color={node.iconColor} />
          </div>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--wf-text-primary)" }}>{node.title}</div>
            <div className="text-[10px] mt-px" style={{ color: "rgba(255,255,255,.35)" }}>{node.provider}</div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {node.tags.map((t, i) => {
            const tc = TAG_COLORS[t.color];
            return (
              <span key={i} className="px-[7px] py-[2px] rounded text-[10px] font-medium" style={{ background: tc.bg, color: tc.text }}>
                {t.label}
              </span>
            );
          })}
        </div>

        {/* KV rows */}
        <div className="flex flex-col gap-1">
          {node.kv.map((kv, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-md text-[10px]" style={{ background: "rgba(255,255,255,.04)" }}>
              <span style={{ color: "rgba(255,255,255,.3)" }}>{kv.key}</span>
              <span className="w-[2px] h-[2px] rounded-full shrink-0" style={{ background: "rgba(255,255,255,.15)" }} />
              <span style={{ color: kv.valueColor || "rgba(255,255,255,.6)" }}>{kv.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom port */}
      <div
        className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-colors hover:border-[var(--wf-primary)] hover:bg-[var(--wf-primary)]"
        style={{ background: "var(--wf-bg-node)", borderColor: "rgba(255,255,255,.15)" }}
      />
    </div>
  );
}
