import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { makeTheme, ThemeContext, TB } from "@/components/workflow-canvas/tokens";
import type { TopMode, ThemeMode, WfNode } from "@/components/workflow-canvas/types";
import { initialNodes } from "@/components/workflow-canvas/data";
import { RenderNode, VConn, SectionLabel } from "@/components/workflow-canvas/nodes";
import { FloatingInspector } from "@/components/workflow-canvas/inspector";
import { ToolboxPanel } from "@/components/workflow-canvas/toolbox";
import { SettingsView } from "@/components/workflow-canvas/settings-view";
import { EnrollmentView } from "@/components/workflow-canvas/enrollment-view";
import { CopilotView } from "@/components/workflow-canvas/copilot-view";
import { NotificationsPanel } from "@/components/workflow-canvas/notifications-panel";
import { findNode } from "@/components/workflow-canvas/helpers";
import { toast } from "sonner";

export default function WorkflowCanvasPage() {
  const [workflowName, setWorkflowName] = useState("GTM Leadership Email Engagement Alert");
  const [isLive, setIsLive] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<TopMode>("workflow");
  const [nodes, setNodes] = useState(initialNodes);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<"outline" | "detail">("detail");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showNotifications, setShowNotifications] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const T = useMemo(() => makeTheme(themeMode), [themeMode]);
  const isLight = themeMode === "light";

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const handleSelectNode = useCallback((id: string) => {
    setSelectedNode(prev => prev === id ? null : id);
  }, []);

  const handleAddNode = useCallback((node: WfNode) => {
    setNodes(prev => {
      const newNodes = [...prev];
      const lastEndIdx = newNodes.map((n, i) => ({ n, i })).filter(x => x.n.type === "end").pop()?.i;
      if (lastEndIdx !== undefined && lastEndIdx === newNodes.length - 1) {
        newNodes.splice(lastEndIdx, 0, node);
      } else {
        newNodes.push(node);
      }
      return newNodes;
    });
    toast.success(`Added "${node.title}" to workflow`);
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setSelectedNode(null);
    toast.success("Node removed");
  }, []);

  const toggleChip = (idx: number) => {
    setNodes(prev => {
      const next = [...prev];
      const trigger = next[0];
      if (trigger.chips) { trigger.chips = [...trigger.chips]; trigger.chips[idx] = { ...trigger.chips[idx], active: !trigger.chips[idx].active }; }
      return next;
    });
  };

  const handleSave = () => toast.success("Workflow saved successfully");
  const toggleLive = () => setIsLive(!isLive);
  const sel = selectedNode ? findNode(nodes, selectedNode) : null;

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains("canvas-bg")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    setSelectedNode(null);
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    const onUp = () => setIsPanning(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isPanning, panStart]);

  const onCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(40, Math.min(200, z - e.deltaY * 0.5)));
    }
  };

  const resetView = () => { setZoom(100); setPanOffset({ x: 0, y: 0 }); };
  const compact = viewMode === "outline";

  const TAB_CONFIG: { mode: TopMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: "workflow", label: "Workflow",
      icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    },
    {
      mode: "enrollment", label: "Outcome",
      icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      mode: "settings", label: "Settings",
      icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>,
    },
    {
      mode: "copilot", label: "Co-pilot",
      icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>,
    },
  ];

  return (
    <ThemeContext.Provider value={T}>
      <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: T.bg, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {/* ── Upper top bar ── */}
        <header className="h-[48px] flex items-center px-5 shrink-0 relative z-40" style={{
          background: T.headerBg,
          borderBottom: `1px solid ${T.border}`,
          backdropFilter: "blur(24px)",
        }}>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: T.text35 }}>
              <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".5"/>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
            </svg>
            <span className="text-[9px] font-medium uppercase tracking-[.12em]" style={{ color: T.text35 }}>Workflows</span>
            <span className="text-[10px]" style={{ color: T.text20 }}>›</span>
            {editingName ? (
              <input ref={nameRef} autoFocus value={workflowName} onChange={e => setWorkflowName(e.target.value)}
                onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                className="text-[12.5px] font-semibold bg-transparent outline-none px-2 py-1 rounded-lg tracking-[-0.02em]"
                style={{ color: T.text, border: `1px solid ${T.primaryRing}`, boxShadow: `0 0 0 3px ${T.primaryGlow}`, width: Math.max(240, workflowName.length * 7.5) }} />
            ) : (
              <span onClick={() => setEditingName(true)}
                className="text-[12.5px] font-semibold cursor-pointer px-2 py-1 rounded-lg transition-all duration-200 tracking-[-0.02em]"
                style={{ color: T.text }}
              >{workflowName}</span>
            )}

            <button onClick={toggleLive}
              className="ml-2 text-[8px] font-bold px-2.5 py-[4px] rounded-full flex items-center gap-1.5 cursor-pointer transition-all duration-300 uppercase tracking-[.06em]"
              style={{
                background: isLive ? T.greenMuted : T.text10,
                color: isLive ? T.greenText : T.text50,
                border: `1px solid ${isLive ? T.greenBorder : T.border}`,
              }}>
              <div className="w-[4px] h-[4px] rounded-full" style={{ background: isLive ? T.greenText : T.text35 }} />
              {isLive ? "Live" : "Draft"}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification bell */}
            <button onClick={() => setShowNotifications(!showNotifications)}
              className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center cursor-pointer transition-colors relative"
              style={{ color: T.text35, border: `1px solid ${T.border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: T.red }} />
            </button>

            {/* 3-dot */}
            <button className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: T.text35, border: `1px solid ${T.border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
            </button>

            {/* Theme toggle */}
            <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}
              className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center transition-all duration-200 cursor-pointer"
              style={{ color: T.text50, border: `1px solid ${T.border}` }}
              title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            >
              {isLight ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              )}
            </button>

            <button className="h-[30px] px-4 rounded-[8px] text-[10px] font-medium cursor-pointer transition-colors"
              style={{ color: T.text70, border: `1px solid ${T.border}` }}
            >Share</button>

            <button onClick={handleSave}
              className="h-[30px] px-4 rounded-[8px] text-[10px] font-medium cursor-pointer flex items-center gap-1.5 transition-colors"
              style={{ color: T.text70, border: `1px solid ${T.border}` }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2"/></svg>
              Save
            </button>

            <button onClick={toggleLive}
              className="h-[30px] px-5 rounded-[8px] text-[10px] font-semibold text-white transition-all duration-300 cursor-pointer tracking-[.01em] flex items-center gap-1.5"
              style={{
                background: `linear-gradient(135deg, ${T.primary} 0%, #CC9A1D 100%)`,
                boxShadow: "0 2px 12px rgba(184,134,11,.3), inset 0 1px 0 rgba(255,255,255,.1)",
              }}
            >
              Launch workflow
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </header>

        {/* ── Sub-tab bar: Workflow / Outcome / Settings / Co-pilot ── */}
        <div className="h-[38px] flex items-center px-5 shrink-0" style={{
          background: T.headerBg,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <nav className="flex items-center gap-1">
            {TAB_CONFIG.map(({ mode, label, icon }) => (
              <button key={mode} onClick={() => { setActiveMode(mode); if (mode !== "workflow") setSelectedNode(null); }}
                className="px-4 py-[6px] rounded-lg text-[10.5px] font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                style={{
                  background: activeMode === mode ? T.primaryMuted : "transparent",
                  color: activeMode === mode ? T.primaryText : T.text50,
                  border: activeMode === mode ? `1px solid ${T.primaryRing}` : "1px solid transparent",
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Main area ── */}
        <div className="flex flex-1 overflow-hidden relative">
          {activeMode === "workflow" && <ToolboxPanel onAddNode={handleAddNode} themeMode={themeMode} />}

          {activeMode === "workflow" && (
            <div ref={canvasRef}
              className="flex-1 overflow-hidden relative"
              style={{ background: T.canvas, cursor: isPanning ? "grabbing" : "grab" }}
              onMouseDown={onCanvasMouseDown}
              onWheel={onCanvasWheel}
            >
              {/* Dot grid */}
              <div className="canvas-bg absolute inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, ${T.dotColor} 1.2px, transparent 1.2px)`,
                backgroundSize: "24px 24px",
                backgroundPosition: `${panOffset.x % 24}px ${panOffset.y % 24}px`,
              }} />

              {/* Subtle vignette */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: isLight
                  ? "radial-gradient(ellipse 80% 70% at center, transparent 0%, rgba(245,245,240,.3) 100%)"
                  : "radial-gradient(ellipse 80% 70% at center, transparent 0%, rgba(30,30,34,.4) 100%)",
              }} />

              {/* Draft banner */}
              {!isLive && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-xl" style={{
                  background: T.primaryMuted,
                  border: `1px solid ${T.primaryRing}`,
                  backdropFilter: "blur(12px)",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 22h20L12 2z" stroke={T.primaryText} strokeWidth="2" fill="none" opacity=".5"/></svg>
                  <span className="text-[10px] font-medium" style={{ color: T.primaryText, opacity: 0.7 }}>Draft mode — activate to start enrolling</span>
                  <button onClick={toggleLive} className="ml-3 text-[10px] font-semibold cursor-pointer" style={{ color: T.primaryText }}>Activate →</button>
                </div>
              )}

              {/* Canvas content */}
              <div className="absolute inset-0" style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                transformOrigin: "center top",
                transition: isPanning ? "none" : "transform 300ms cubic-bezier(.4,0,.2,1)",
              }}>
                <div className="flex flex-col items-center py-20 px-8 pointer-events-auto" style={{ minWidth: 900 }}>
                  <div className="mb-8">
                    <SectionLabel color="blue" icon={
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                    }>When this happens</SectionLabel>
                  </div>

                  <div className="flex flex-col items-center w-full" style={{ maxWidth: 780 }}>
                    <RenderNode node={nodes[0]} selected={selectedNode} onSelect={handleSelectNode} compact={compact} />
                  </div>

                  <VConn height={compact ? 28 : 48} />

                  <div className="mb-8">
                    <SectionLabel color="purple" icon={
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }>Then do this</SectionLabel>
                  </div>

                  {nodes.slice(1).map((node, i) => (
                    <div key={node.id} className="flex flex-col items-center w-full" style={{ maxWidth: 780 }}>
                      <RenderNode node={node} selected={selectedNode} onSelect={handleSelectNode} compact={compact} />
                      {i < nodes.length - 2 && <VConn height={compact ? 28 : 48} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom-left: Outline / Detail toggle */}
              <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2">
                <div className="flex items-center rounded-lg overflow-hidden" style={{
                  background: T.zoomBg,
                  border: `1px solid ${T.border}`,
                  backdropFilter: "blur(24px)",
                  boxShadow: isLight ? "0 2px 12px rgba(0,0,0,.06)" : "0 4px 20px rgba(0,0,0,.4)",
                }}>
                  <button onClick={() => setViewMode("outline")}
                    className="px-3.5 py-[7px] text-[10px] font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      background: viewMode === "outline" ? (isLight ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.1)") : "transparent",
                      color: viewMode === "outline" ? T.text : T.text50,
                    }}>Outline</button>
                  <button onClick={() => setViewMode("detail")}
                    className="px-3.5 py-[7px] text-[10px] font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      background: viewMode === "detail" ? (isLight ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.1)") : "transparent",
                      color: viewMode === "detail" ? T.text : T.text50,
                    }}>Detail</button>
                </div>
              </div>

              {/* Floating zoom dock */}
              <div className="absolute bottom-6 right-6 z-20 flex items-center rounded-xl p-1.5 gap-0.5" style={{
                background: T.zoomBg,
                border: `1px solid ${T.border}`,
                backdropFilter: "blur(24px)",
                boxShadow: isLight ? "0 2px 16px rgba(0,0,0,.06)" : "0 8px 40px rgba(0,0,0,.5)",
              }}>
                <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-[13px] font-light" style={{ color: T.text50 }}>−</button>
                <button onClick={() => setZoom(100)} className="h-8 px-3 rounded-lg text-[10px] font-medium cursor-pointer" style={{ color: T.text70 }}>{zoom}%</button>
                <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-[13px] font-light" style={{ color: T.text50 }}>+</button>
                <div className="w-px h-5 mx-1" style={{ background: T.border }} />
                <button onClick={resetView} className="h-8 px-3 rounded-lg text-[9px] font-medium cursor-pointer" style={{ color: T.text50 }}>Fit</button>
                <button onClick={resetView} className="h-8 px-3 rounded-lg text-[9px] font-medium cursor-pointer" style={{ color: T.text35 }}>Reset</button>
              </div>

              {sel && <FloatingInspector node={sel} onClose={() => setSelectedNode(null)} onToggleChip={toggleChip} />}
            </div>
          )}

          {activeMode === "settings" && <SettingsView workflowName={workflowName} onNameChange={setWorkflowName} />}
          {activeMode === "enrollment" && <EnrollmentView isLive={isLive} onToggleLive={toggleLive} />}
          {activeMode === "copilot" && <CopilotView />}

          {/* Notifications overlay */}
          {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
