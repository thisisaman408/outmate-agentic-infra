import { useTheme } from "./tokens";
import { NodeIcon } from "./icons";
import { ConfigLabel, InputField, SelectField, ToggleRow } from "./form-controls";
import type { WfNode } from "./types";

function TriggerInspector({ node, onToggleChip }: { node: WfNode; onToggleChip: (idx: number) => void }) {
  const T = useTheme();
  return (
    <div className="flex flex-col gap-1">
      <ConfigLabel>Active trigger sources</ConfigLabel>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {node.chips?.map((c, i) => (
          <button key={i} onClick={() => onToggleChip(i)}
            className="text-[9px] font-medium px-2.5 py-[5px] rounded-lg cursor-pointer transition-all duration-200"
            style={{
              background: c.active ? T.primaryMuted : T.text10,
              color: c.active ? T.primaryText : T.text35,
              border: `1px solid ${c.active ? T.primaryRing : T.border}`,
            }}>{c.label}</button>
        ))}
      </div>
      <SelectField label="Schedule" options={["Daily", "Hourly", "Every 6 hours", "Weekly"]} defaultValue="Daily" />
      <ToggleRow label="Business hours only" defaultOn={true} />
      <ToggleRow label="Skip weekends" defaultOn={true} />
    </div>
  );
}

function ActionInspector({ node }: { node: WfNode }) {
  const T = useTheme();
  if (node.title === "Waterfall Enrich") return (
    <div className="flex flex-col gap-1">
      <ConfigLabel>Provider cascade</ConfigLabel>
      {["1. People Data Labs", "2. Hunter.io", "3. Clearbit"].map(p => (
        <div key={p} className="text-[9.5px] px-3.5 py-2.5 rounded-[10px] flex items-center gap-2" style={{
          background: T.text10, color: T.text50, border: `1px solid ${T.border}`,
        }}>
          <span style={{ color: T.text20 }}>⠿</span>{p}
        </div>
      ))}
      <ToggleRow label="Loop on failure" defaultOn={true} />
      <ToggleRow label="Stop after first match" defaultOn={false} />
    </div>
  );
  if (node.title === "Email Sequence") return (
    <div className="flex flex-col gap-1">
      <SelectField label="Sequence" options={["5-step AI personalised cadence", "3-step follow-up", "Custom"]} defaultValue="5-step AI personalised cadence" />
      <SelectField label="Cadence interval" options={["1 day", "2 days", "3 days"]} defaultValue="2 days" />
      <ToggleRow label="Personalise with AI" defaultOn={true} />
    </div>
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9.5px]" style={{ color: T.text50 }}>Configure {node.title} settings.</div>
      {node.tag && <div className="text-[8.5px] mt-1 px-3 py-2 rounded-[10px]" style={{ background: T.text10, color: T.text35 }}>Provider: {node.tag}</div>}
    </div>
  );
}

function ConditionInspector({ node }: { node: WfNode }) {
  const T = useTheme();
  return (
    <div className="flex flex-col gap-1">
      <ConfigLabel>Logic mode</ConfigLabel>
      <div className="flex gap-1.5">
        {["AND", "OR"].map(l => (
          <button key={l} className="text-[9px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer transition-all duration-200" style={{
            background: l === "AND" ? T.primaryMuted : T.text10,
            color: l === "AND" ? T.primaryText : T.text35,
            border: `1px solid ${l === "AND" ? T.primaryRing : T.border}`,
          }}>{l}</button>
        ))}
      </div>
      <ConfigLabel>Branches</ConfigLabel>
      <div className="text-[9.5px] px-3.5 py-2.5 rounded-[10px]" style={{ background: T.greenMuted, color: T.greenText, border: `1px solid ${T.greenBorder}` }}>{node.yesLabel || "Yes"}</div>
      <div className="text-[9.5px] px-3.5 py-2.5 rounded-[10px]" style={{ background: T.redMuted, color: T.redText, border: `1px solid ${T.redBorder}` }}>{node.noLabel || "No"}</div>
    </div>
  );
}

function WaitInspector({ node }: { node: WfNode }) {
  const T = useTheme();
  return (
    <div className="flex flex-col gap-1">
      <ConfigLabel>Delay</ConfigLabel>
      <div className="flex gap-2 mt-1">
        <input type="number" defaultValue={node.waitDays || 3}
          className="w-16 text-[10px] rounded-lg px-3 py-[7px] focus:outline-none"
          style={{ background: T.text10, border: `1px solid ${T.border}`, color: T.text70 }} />
        <select defaultValue="days"
          className="text-[10px] rounded-lg px-3 py-[7px]"
          style={{ background: T.text10, border: `1px solid ${T.border}`, color: T.text70 }}>
          <option>hours</option><option>days</option><option>weeks</option>
        </select>
      </div>
      <ToggleRow label="Business hours only" defaultOn={node.waitBizHours ?? false} />
    </div>
  );
}

function EndInspector({ node }: { node: WfNode }) {
  return (
    <div className="flex flex-col gap-1">
      <InputField label="Exit label" defaultValue={node.title} />
      <SelectField label="Exit reason" options={["Converted", "Disqualified", "No response", "Unsubscribed"]}
        defaultValue={node.endVariant === "converted" ? "Converted" : node.endVariant === "disqualified" ? "Disqualified" : "No response"} />
      <ToggleRow label="Notify owner on exit" defaultOn={false} />
    </div>
  );
}

export function FloatingInspector({ node, onClose, onToggleChip }: { node: WfNode; onClose: () => void; onToggleChip: (idx: number) => void }) {
  const T = useTheme();
  return (
    <div className="absolute right-6 top-20 z-30 w-[350px] max-h-[calc(100vh-160px)] overflow-y-auto rounded-2xl" style={{
      background: T.panelBg,
      border: `1px solid ${T.border}`,
      backdropFilter: "blur(32px)",
      boxShadow: `0 16px 60px rgba(0,0,0,.25), 0 0 0 0.5px ${T.borderSubtle}`,
      scrollbarWidth: "thin",
    }}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{
        background: T.panelBg,
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: "blur(16px)",
      }}>
        <div className="flex items-center gap-3">
          <NodeIcon type={node.icon} size={16} />
          <span className="text-[12.5px] font-semibold tracking-[-0.02em]" style={{ color: T.text }}>{node.title}</span>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150"
          style={{ color: T.text35 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="px-5 py-5">
        {node.type === "trigger" && <TriggerInspector node={node} onToggleChip={onToggleChip} />}
        {node.type === "action" && <ActionInspector node={node} />}
        {node.type === "condition" && <ConditionInspector node={node} />}
        {node.type === "wait" && <WaitInspector node={node} />}
        {node.type === "end" && <EndInspector node={node} />}
      </div>
    </div>
  );
}
