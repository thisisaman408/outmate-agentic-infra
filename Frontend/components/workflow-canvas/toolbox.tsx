import { useState } from "react";
import { useTheme, TB } from "./tokens";
import { NodeIcon } from "./icons";
import { TOOLBOX_SECTIONS, INTEGRATIONS } from "./data";
import type { WfNode, ThemeMode } from "./types";

function IntegrationLogos() {
  const colors = ["#FF5C35", "#00A1E0", "#E01E5A", "#6366F1"];
  return (
    <div className="flex items-center -space-x-1 ml-auto">
      {colors.map((c, i) => (
        <div key={i} className="w-[14px] h-[14px] rounded-full border border-white/80" style={{ background: c, zIndex: 4 - i }} />
      ))}
    </div>
  );
}

const ICON_TO_NODE: Record<string, Partial<WfNode>> = {
  condition: { type: "condition", icon: "condition", conditionSubtitle: "Define your condition" },
  wait: { type: "wait", icon: "wait", waitDays: 1 },
  end: { type: "end", icon: "end", endVariant: "disqualified" },
  enrich: { type: "action", icon: "enrich" },
  score: { type: "action", icon: "score" },
  email: { type: "action", icon: "email" },
  crm: { type: "action", icon: "crm" },
  linkedin: { type: "action", icon: "linkedin" },
  slack: { type: "action", icon: "slack" },
  ai: { type: "action", icon: "ai" },
  voice: { type: "action", icon: "voice" },
};

export function ToolboxPanel({ onAddNode, themeMode }: { onAddNode?: (node: WfNode) => void; themeMode?: ThemeMode }) {
  const T = useTheme();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (t: string) => setCollapsed(p => ({ ...p, [t]: !p[t] }));
  const q = search.toLowerCase();

  const isLight = themeMode !== "dark";
  // Use theme-aware colors for toolbox
  const tbColors = isLight ? TB : {
    bg: T.surface,
    border: T.border,
    searchBg: T.text10,
    searchBorder: T.border,
    textPrimary: T.text,
    textSecondary: T.text70,
    textMuted: T.text50,
    sectionLabel: T.text50,
    hoverBg: T.surfaceHover,
    selectedBg: T.surfaceElevated,
    cardGradient: T.nodeBg,
    cardBorder: T.border,
  };

  const filtered = TOOLBOX_SECTIONS.map(s => ({
    ...s, items: s.items.filter(it => it.label.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)),
  })).filter(s => s.items.length > 0);

  const filteredInteg = INTEGRATIONS.filter(it => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q));

  const handleAddItem = (item: { label: string; iconType: string; desc: string }) => {
    if (!onAddNode) return;
    const base = ICON_TO_NODE[item.iconType] || { type: "action" as const, icon: item.iconType };
    const node: WfNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.label,
      subtitle: item.desc,
      ...base,
    } as WfNode;
    onAddNode(node);
  };

  return (
    <div className="w-[250px] shrink-0 flex flex-col overflow-hidden" style={{
      background: tbColors.bg,
      borderRight: `1px solid ${tbColors.border}`,
    }}>
      <div className="px-4 pt-4 pb-3">
        <div className="text-[11px] font-bold tracking-[-0.01em] mb-0.5" style={{ color: tbColors.textPrimary }}>Build</div>
        <div className="text-[8.5px] mb-3" style={{ color: tbColors.textMuted }}>Click to add to workflow</div>
        <div className="relative">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tbColors.textMuted }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes..."
            className="w-full text-[10px] rounded-[10px] pl-8 pr-3 py-[8px] focus:outline-none transition-all duration-200"
            style={{ background: tbColors.searchBg, border: `1px solid ${tbColors.searchBorder}`, color: tbColors.textPrimary }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-5" style={{ scrollbarWidth: "thin" }}>
        {filtered.map(sec => (
          <div key={sec.title} className="mb-1">
            <button onClick={() => toggle(sec.title)}
              className="flex items-center justify-between w-full px-2 py-2 rounded text-[9px] font-bold uppercase cursor-pointer tracking-[.1em]"
              style={{ color: tbColors.sectionLabel }}>
              <div className="flex items-center gap-2">
                <span>{sec.title}</span>
                {(sec as any).badge && (
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md normal-case tracking-normal"
                    style={{ background: T.primary, color: "#fff" }}>{(sec as any).badge}</span>
                )}
              </div>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ transform: collapsed[sec.title] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 200ms ease", color: tbColors.textMuted }}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {!collapsed[sec.title] && (
              <div className="flex flex-col gap-0.5">
                {sec.items.map(item => (
                  <div key={item.label}
                    onClick={() => handleAddItem(item)}
                    className="flex items-center gap-2.5 px-2.5 py-[8px] rounded-[10px] cursor-pointer transition-all duration-200 active:scale-[0.97]"
                    style={{ border: `1px solid transparent` }}
                    onMouseEnter={e => { e.currentTarget.style.background = tbColors.hoverBg; e.currentTarget.style.borderColor = tbColors.border; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <div className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0" style={{ background: item.iconBg }}>
                      <NodeIcon type={item.iconType} size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium truncate" style={{ color: tbColors.textPrimary }}>{item.label}</div>
                      <div className="text-[8px] truncate" style={{ color: tbColors.textMuted }}>{item.desc}</div>
                    </div>
                    {(item as any).hasLogos && <IntegrationLogos />}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredInteg.length > 0 && (
          <div className="mb-2">
            <button onClick={() => toggle("Integrations")}
              className="flex items-center justify-between w-full px-2 py-2 rounded text-[9px] font-bold uppercase cursor-pointer tracking-[.1em]"
              style={{ color: tbColors.sectionLabel }}>
              <span>Integrations</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ transform: collapsed["Integrations"] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 200ms ease", color: tbColors.textMuted }}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {!collapsed["Integrations"] && (
              <div className="flex flex-col gap-0.5">
                {filteredInteg.map(integ => (
                  <div key={integ.name}
                    className="flex items-center gap-2.5 px-2.5 py-[8px] rounded-[10px] cursor-pointer transition-all duration-200"
                    style={{ border: `1px solid transparent` }}
                    onMouseEnter={e => { e.currentTarget.style.background = tbColors.hoverBg; e.currentTarget.style.borderColor = tbColors.border; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                    onClick={() => {
                      if (onAddNode) {
                        const node: WfNode = {
                          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          title: integ.name,
                          subtitle: `${integ.category} integration`,
                          type: "action",
                          icon: "crm",
                        };
                        onAddNode(node);
                      }
                    }}
                  >
                    <div className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0 text-[8px] font-bold text-white" style={{ background: integ.iconBg }}>
                      {integ.iconLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium truncate" style={{ color: tbColors.textPrimary }}>{integ.name}</span>
                        {integ.featured && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: T.primaryMuted, color: T.primaryText }}>★</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] truncate" style={{ color: tbColors.textMuted }}>{integ.category}</span>
                        {integ.connected && <>
                          <span className="w-[4px] h-[4px] rounded-full" style={{ background: T.green }} />
                          <span className="text-[7px] font-medium" style={{ color: T.green }}>Connected</span>
                        </>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
