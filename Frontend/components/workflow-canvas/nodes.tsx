import { useTheme } from "./tokens";
import { NodeIcon } from "./icons";
import type { WfNode } from "./types";

/* ── Connection handle ── */
function Handle({ position }: { position: "top" | "bottom" }) {
  const T = useTheme();
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
      style={{
        [position === "top" ? "top" : "bottom"]: -4,
        width: T.handleSize,
        height: T.handleSize,
        borderRadius: "50%",
        background: T.primary,
        border: `2px solid ${T.handleBorder}`,
        boxShadow: `0 0 8px ${T.handleGlow}`,
        cursor: "crosshair",
      }}
    />
  );
}

/* ── Vertical connector ── */
export function VConn({ height = 44 }: { height?: number }) {
  const T = useTheme();
  return (
    <div className="flex flex-col items-center" style={{ height: height + 8 }}>
      <div style={{ width: 1.5, height, background: `linear-gradient(180deg, ${T.connectorActive} 0%, ${T.connectorColor} 100%)`, borderRadius: 1 }} />
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.connectorActive, boxShadow: `0 0 8px ${T.primaryGlow}`, marginTop: -1 }} />
    </div>
  );
}

export function MergeDot() {
  const T = useTheme();
  return (
    <div className="flex items-center justify-center my-2">
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.primaryMuted, border: `2px solid ${T.connectorActive}`, boxShadow: `0 0 12px ${T.primaryGlow}` }} />
    </div>
  );
}

/* ── Section label pill ── */
export function SectionLabel({ color, icon, children }: { color: "blue" | "purple"; children: React.ReactNode; icon: React.ReactNode }) {
  const T = useTheme();
  const s = color === "blue"
    ? { bg: T.primaryMuted, border: T.primaryRing, text: T.primaryText }
    : { bg: T.primaryMuted, border: T.primaryRing, text: T.primaryText };
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-semibold tracking-[.04em] uppercase"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {icon}{children}
    </div>
  );
}

/* ── Node wrapper with handles ── */
function NodeShell({ selected, onClick, children, variant = "default", maxW = 520, compact = false }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; variant?: "default" | "condition" | "wait" | "end-ok" | "end-bad"; maxW?: number; compact?: boolean;
}) {
  const T = useTheme();
  const borderColors: Record<string, { idle: string; hover: string; active: string }> = {
    default: { idle: T.nodeBorder, hover: T.nodeHoverBorder, active: T.nodeActiveBorder },
    condition: { idle: T.amberBorder, hover: "rgba(245,200,66,.18)", active: "rgba(245,200,66,.3)" },
    wait: { idle: T.amberBorder, hover: "rgba(245,200,66,.15)", active: "rgba(245,200,66,.25)" },
    "end-ok": { idle: T.greenBorder, hover: "rgba(52,211,153,.2)", active: "rgba(52,211,153,.35)" },
    "end-bad": { idle: T.redBorder, hover: "rgba(248,113,113,.15)", active: "rgba(248,113,113,.25)" },
  };
  const bc = borderColors[variant] || borderColors.default;

  return (
    <div onClick={onClick}
      className="relative group cursor-pointer transition-all duration-300"
      style={{
        background: T.nodeBg,
        border: `1px ${variant === "end-bad" ? "dashed" : "solid"} ${selected ? bc.active : bc.idle}`,
        borderRadius: compact ? 12 : 16,
        boxShadow: selected ? T.nodeActiveShadow : T.nodeShadow,
        maxWidth: maxW,
        width: "100%",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = bc.hover; e.currentTarget.style.boxShadow = T.nodeHoverShadow; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = bc.idle; e.currentTarget.style.boxShadow = T.nodeShadow; e.currentTarget.style.transform = "translateY(0)"; } }}
    >
      <Handle position="top" />
      {children}
      <Handle position="bottom" />
    </div>
  );
}

/* ── Trigger ── */
export function TriggerNode({ node, selected, onClick, compact }: { node: WfNode; selected: boolean; onClick: () => void; compact?: boolean }) {
  const T = useTheme();
  if (compact) {
    return (
      <NodeShell selected={selected} onClick={onClick} maxW={400} compact>
        <div className="px-4 py-3 flex items-center gap-3">
          <NodeIcon type="signal" size={14} />
          <span className="text-[11px] font-semibold" style={{ color: T.text }}>{node.title}</span>
          <span className="text-[7px] font-bold px-2 py-1 rounded-md ml-auto uppercase tracking-[.06em]" style={{ background: T.primaryMuted, color: T.primaryText }}>Trigger</span>
        </div>
      </NodeShell>
    );
  }
  return (
    <NodeShell selected={selected} onClick={onClick} maxW={540}>
      <div className="p-5">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
            background: T.primaryMuted,
            border: `1px solid ${T.primaryRing}`,
            boxShadow: `0 0 20px ${T.primaryGlow}`,
          }}>
            <NodeIcon type="signal" size={16} />
          </div>
          <div className="flex-1">
            <span className="text-[13px] font-semibold tracking-[-0.02em]" style={{ color: T.text }}>{node.title}</span>
            <div className="text-[10px] mt-0.5" style={{ color: T.text35 }}>{node.subtitle}</div>
          </div>
          <span className="text-[7.5px] font-bold px-3 py-[5px] rounded-lg tracking-[.08em] uppercase" style={{
            background: T.primaryMuted, color: T.primaryText, border: `1px solid ${T.primaryRing}`,
          }}>Trigger</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {node.chips?.map((c, i) => (
            <span key={i} className="text-[9px] font-medium px-[10px] py-[5px] rounded-lg cursor-pointer transition-all duration-200" style={{
              background: c.active ? T.primaryMuted : T.text10,
              color: c.active ? T.primaryText : T.text35,
              border: `1px solid ${c.active ? T.primaryRing : T.text10}`,
            }}>{c.label}</span>
          ))}
        </div>
      </div>
    </NodeShell>
  );
}

/* ── Action ── */
export function ActionNode({ node, selected, onClick, compact }: { node: WfNode; selected: boolean; onClick: () => void; compact?: boolean }) {
  const T = useTheme();
  const iconStyles: Record<string, { bg: string; border: string }> = {
    crm: { bg: "rgba(59,130,246,.07)", border: "rgba(59,130,246,.1)" },
    linkedin: { bg: "rgba(59,130,246,.07)", border: "rgba(59,130,246,.1)" },
    email: { bg: "rgba(52,211,153,.06)", border: "rgba(52,211,153,.08)" },
    ai: { bg: "rgba(192,132,252,.06)", border: "rgba(192,132,252,.08)" },
    voice: { bg: "rgba(192,132,252,.06)", border: "rgba(192,132,252,.08)" },
    slack: { bg: "rgba(251,191,36,.05)", border: "rgba(251,191,36,.07)" },
    score: { bg: "rgba(251,191,36,.05)", border: "rgba(251,191,36,.07)" },
    enrich: { bg: "rgba(96,165,250,.06)", border: "rgba(96,165,250,.08)" },
  };
  const is = iconStyles[node.icon] || { bg: "rgba(59,130,246,.06)", border: "rgba(59,130,246,.08)" };

  if (compact) {
    return (
      <NodeShell selected={selected} onClick={onClick} compact>
        <div className="px-4 py-2.5 flex items-center gap-2.5">
          <NodeIcon type={node.icon} size={12} />
          <span className="text-[10px] font-medium" style={{ color: T.text }}>{node.title}</span>
        </div>
      </NodeShell>
    );
  }

  return (
    <NodeShell selected={selected} onClick={onClick}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: is.bg, border: `1px solid ${is.border}` }}>
            <NodeIcon type={node.icon} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[11.5px] font-medium tracking-[-0.01em]" style={{ color: T.text }}>{node.title}</span>
              {node.tag && (
                <span className="text-[8px] font-medium px-2 py-[3px] rounded-md" style={{
                  background: T.text10, color: T.text50, border: `1px solid ${T.text10}`,
                }}>{node.tag}</span>
              )}
            </div>
            {node.subtitle && <div className="text-[9.5px] mt-0.5" style={{ color: T.text35 }}>{node.subtitle}</div>}
          </div>
          {node.loopBadge && (
            <span className="text-[7.5px] font-semibold px-2.5 py-[4px] rounded-md" style={{ background: T.primaryMuted, color: T.primaryText }}>↻ Loop</span>
          )}
        </div>
      </div>
    </NodeShell>
  );
}

/* ── Condition ── */
export function ConditionNode({ node, selected, onClick, compact }: { node: WfNode; selected: boolean; onClick: () => void; compact?: boolean }) {
  const T = useTheme();
  if (compact) {
    return (
      <NodeShell selected={selected} onClick={onClick} variant="condition" maxW={320} compact>
        <div className="px-4 py-2.5 flex items-center gap-2.5">
          <NodeIcon type="condition" size={12} />
          <span className="text-[10px] font-medium" style={{ color: T.amberText }}>{node.title}</span>
        </div>
      </NodeShell>
    );
  }
  return (
    <NodeShell selected={selected} onClick={onClick} variant="condition" maxW={480}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{
            background: T.amberMuted, border: `1px solid ${T.amberBorder}`,
          }}>
            <NodeIcon type="condition" size={14} />
          </div>
          <div>
            <span className="text-[11.5px] font-medium" style={{ color: T.amberText }}>{node.title}</span>
            {node.conditionSubtitle && <div className="text-[9px] mt-0.5" style={{ color: T.text35 }}>{node.conditionSubtitle}</div>}
          </div>
        </div>
      </div>
    </NodeShell>
  );
}

/* ── Wait ── */
export function WaitNode({ node, selected, onClick, compact }: { node: WfNode; selected: boolean; onClick: () => void; compact?: boolean }) {
  const T = useTheme();
  return (
    <NodeShell selected={selected} onClick={onClick} variant="wait" maxW={220} compact={compact}>
      <div className={compact ? "px-3 py-2 flex items-center gap-2" : "px-4 py-3 flex items-center gap-3"}>
        <NodeIcon type="wait" size={compact ? 10 : 12} />
        <span className={compact ? "text-[9px] font-medium" : "text-[10.5px] font-medium"} style={{ color: T.amberText }}>{node.title}</span>
      </div>
    </NodeShell>
  );
}

/* ── End ── */
export function EndNode({ node, selected, onClick, compact }: { node: WfNode; selected: boolean; onClick: () => void; compact?: boolean }) {
  const T = useTheme();
  const ok = node.endVariant === "converted";
  const c = ok ? { text: T.greenText, icon: "end-ok" as const } : { text: T.redText, icon: "end" as const };
  return (
    <NodeShell selected={selected} onClick={onClick} variant={ok ? "end-ok" : "end-bad"} maxW={220} compact={compact}>
      <div className={compact ? "px-3 py-2 flex items-center gap-2" : "px-4 py-3 flex items-center gap-3"}>
        <NodeIcon type={c.icon} size={compact ? 10 : 14} />
        <span className={compact ? "text-[9px] font-medium" : "text-[10.5px] font-medium"} style={{ color: c.text }}>{node.title}</span>
      </div>
    </NodeShell>
  );
}

/* ── Branch label ── */
function BranchLabel({ type, label }: { type: "yes" | "no"; label: string }) {
  const T = useTheme();
  const s = type === "yes"
    ? { bg: T.greenMuted, color: T.greenText, border: T.greenBorder }
    : { bg: T.redMuted, color: T.redText, border: T.redBorder };
  return (
    <span className="text-[8px] font-bold px-3.5 py-[5px] rounded-lg mt-3 mb-3 uppercase tracking-[.06em]" style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{label}</span>
  );
}

/* ── Recursive renderer ── */
export function RenderNode({ node, selected, onSelect, compact = false }: { node: WfNode; selected: string | null; onSelect: (id: string) => void; compact?: boolean }) {
  const T = useTheme();
  const sel = selected === node.id;
  const click = () => onSelect(node.id);

  if (node.type === "trigger") return <TriggerNode node={node} selected={sel} onClick={click} compact={compact} />;
  if (node.type === "wait") return <WaitNode node={node} selected={sel} onClick={click} compact={compact} />;
  if (node.type === "end") return <EndNode node={node} selected={sel} onClick={click} compact={compact} />;

  if (node.type === "condition") {
    return (
      <div className="flex flex-col items-center">
        <ConditionNode node={node} selected={sel} onClick={click} compact={compact} />
        {(node.yesBranch || node.noBranch) && (
          <>
            <VConn height={compact ? 20 : 28} />
            <div style={{
              width: "100%", maxWidth: 780, height: 1.5, borderRadius: 1,
              background: `linear-gradient(90deg, transparent 0%, ${T.connectorColor} 10%, ${T.connectorActive} 50%, ${T.connectorColor} 90%, transparent 100%)`,
            }} />
            <div className="flex w-full" style={{ maxWidth: 780, gap: compact ? 24 : 48 }}>
              <div className="flex-1 flex flex-col items-center">
                <BranchLabel type="yes" label={node.yesLabel || "Yes"} />
                {node.yesBranch?.map((child, i) => (
                  <div key={child.id} className="flex flex-col items-center w-full">
                    {i > 0 && <VConn height={compact ? 20 : 32} />}
                    <RenderNode node={child} selected={selected} onSelect={onSelect} compact={compact} />
                  </div>
                ))}
              </div>
              <div className="flex-1 flex flex-col items-center">
                <BranchLabel type="no" label={node.noLabel || "No"} />
                {node.noBranch?.map((child, i) => (
                  <div key={child.id} className="flex flex-col items-center w-full">
                    {i > 0 && <VConn height={compact ? 20 : 32} />}
                    <RenderNode node={child} selected={selected} onSelect={onSelect} compact={compact} />
                  </div>
                ))}
              </div>
            </div>
            <VConn height={compact ? 20 : 28} />
            <MergeDot />
          </>
        )}
      </div>
    );
  }

  return <ActionNode node={node} selected={sel} onClick={click} compact={compact} />;
}
