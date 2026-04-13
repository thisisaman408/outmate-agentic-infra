import { MoreHorizontal, Clock } from "lucide-react";
import { C, TAG, type NodeData } from "./constants";

/* SVG icons per node type */
function NodeIcon({ type, color }: { type: string; color: string }) {
  if (type === "signal") return <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={color} /></svg>;
  if (type === "enrich") return <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" /><path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" fill={color} /></svg>;
}

const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  configured: { bg: "rgba(16,185,129,.14)", text: "#34D399", dot: "#34D399", label: "Configured" },
  running: { bg: "rgba(79,70,229,.2)", text: "#818CF8", dot: "#818CF8", label: "Running" },
  building: { bg: "rgba(245,158,11,.15)", text: "#FCD34D", dot: "#FCD34D", label: "Building" },
  pending: { bg: "rgba(255,255,255,.07)", text: "rgba(255,255,255,.3)", dot: "rgba(255,255,255,.3)", label: "Pending" },
};

interface Props {
  node: NodeData;
  selected: boolean;
  onClick: () => void;
  onConfirm?: () => void;
}

export default function WorkflowNode({ node, selected, onClick, onConfirm }: Props) {
  const s = statusStyles[node.status];
  const isBuilding = node.status === "building";

  return (
    <div className="relative w-[280px] rounded-[14px] transition-all cursor-pointer"
      onClick={onClick}
      style={{
        background: C.node,
        border: `0.5px solid ${selected ? C.primary : isBuilding ? "#FCD34D" : C.border}`,
        boxShadow: selected ? `0 0 0 3px rgba(79,70,229,.15)` : undefined,
        animation: isBuilding ? "building-pulse 2s ease-in-out infinite" : undefined,
      }}>
      {/* Top port */}
      <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2"
        style={{ background: C.node, borderColor: "rgba(255,255,255,.15)" }} />

      {/* Topbar */}
      <div className="h-[34px] flex items-center justify-between px-3 border-b" style={{ borderColor: "rgba(255,255,255,.06)" }}>
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.text25 }}>Step {node.id}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: s.bg, color: s.text }}>
            <div className="w-[5px] h-[5px] rounded-full" style={{ background: s.dot, animation: node.status === "running" ? "blink 1.5s ease-in-out infinite" : undefined }} />
            {s.label}
          </div>
          <button className="w-5 h-5 rounded flex items-center justify-center" style={{ color: C.text25 }}>
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-[11px_13px_12px]">
        {/* Icon + title */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0" style={{ background: node.iconBg }}>
            <NodeIcon type={node.iconType} color={node.iconColor} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: C.text }}>{node.title}</div>
            <div className="text-[10px]" style={{ color: C.text30 }}>{node.provider}</div>
          </div>
        </div>
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {node.tags.map((t, i) => (
            <span key={i} className="px-1.5 py-px rounded text-[9px] font-semibold" style={{ background: TAG[t.color]?.bg, color: TAG[t.color]?.text }}>{t.label}</span>
          ))}
        </div>
        {/* KV rows */}
        {node.kv.map((kv, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-[5px] rounded-md mb-1 text-[10px]" style={{ background: "rgba(255,255,255,.04)" }}>
            <span style={{ color: C.text30 }}>{kv.key}</span>
            <span style={{ color: C.text25 }}>·</span>
            <span style={{ color: "rgba(255,255,255,.6)" }}>{kv.value}</span>
          </div>
        ))}
        {/* Credit badge */}
        <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded text-[10px] font-medium w-fit" style={{ background: "rgba(245,158,11,.07)", color: "#FCD34D" }}>
          <Clock size={10} /> {node.creditBadge}
        </div>
      </div>

      {/* Bottom port */}
      <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 hover:bg-[#4F46E5] transition-colors"
        style={{ background: C.node, borderColor: "rgba(255,255,255,.15)" }} />

      {/* Building overlay */}
      {isBuilding && onConfirm && (
        <div className="absolute inset-0 rounded-[14px] flex flex-col items-center justify-center p-4 text-center z-10"
          style={{ background: "rgba(0,0,0,.6)" }}>
          <div className="text-[11px] font-semibold mb-1" style={{ color: "#FCD34D" }}>Agent needs your input</div>
          <div className="text-[10px] mb-3 leading-relaxed" style={{ color: C.text40 }}>
            Should leads scoring below 80 be re-queued after 14 days or permanently skipped?
          </div>
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); onConfirm(); }}
              className="px-3 py-1.5 rounded-md text-[10px] font-semibold"
              style={{ background: C.primary, color: "#fff" }}>Re-queue after 14d</button>
            <button onClick={e => { e.stopPropagation(); onConfirm(); }}
              className="px-3 py-1.5 rounded-md text-[10px] font-semibold border"
              style={{ background: "rgba(255,255,255,.1)", borderColor: C.border, color: C.text70 }}>Skip permanently</button>
          </div>
        </div>
      )}
    </div>
  );
}
