import { useState } from "react";
import { WORKFLOW_NODES } from "@/data/workflowNodes";
import WorkflowNode from "./WorkflowNode";

/*
  Layout positions (approximate px from canvas top-left):
  N1: center, y=60
  N2: center, y=310
  N3: center, y=560
  N4: left offset, y=830
  N5: right offset, y=830
*/

const NODE_POS = [
  { x: 0, y: 0 },      // N1
  { x: 0, y: 250 },     // N2
  { x: 0, y: 500 },     // N3
  { x: -160, y: 770 },  // N4
  { x: 160, y: 770 },   // N5
];

export default function WorkflowCanvas() {
  const [zoom, setZoom] = useState(120);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"Outline" | "Detail" | "History">("Outline");

  // Center x reference for SVG connectors
  const cx = 0; // relative to center
  const svgW = 800;
  const svgH = 1000;
  const svgCx = svgW / 2;

  // Node bottom/top y positions (approx based on node height ~180px)
  const nodeH = 200;
  const padTop = 60;
  const connectors = [
    // N1 bottom → N2 top
    { x1: svgCx, y1: padTop + nodeH, x2: svgCx, y2: padTop + 250 },
    // N2 bottom → N3 top
    { x1: svgCx, y1: padTop + 250 + nodeH, x2: svgCx, y2: padTop + 500 },
    // N3 bottom → N4 top (left branch)
    { x1: svgCx, y1: padTop + 500 + nodeH, x2: svgCx - 160, y2: padTop + 770 },
    // N3 bottom → N5 top (right branch)
    { x1: svgCx, y1: padTop + 500 + nodeH, x2: svgCx + 160, y2: padTop + 770 },
  ];

  return (
    <div
      className="flex-1 relative overflow-auto"
      style={{ background: "var(--wf-bg-page)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedId(null);
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* SVG connectors */}
      <svg
        className="absolute pointer-events-none"
        width={svgW}
        height={svgH}
        style={{ left: "50%", marginLeft: -svgW / 2, top: 0, zIndex: 1 }}
      >
        <defs>
          <marker id="cdot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6">
            <circle cx="3" cy="3" r="3" fill="rgba(255,255,255,.18)" />
          </marker>
        </defs>
        {connectors.map((c, i) => {
          const my = (c.y1 + c.y2) / 2;
          return (
            <path
              key={i}
              d={`M${c.x1} ${c.y1} C${c.x1} ${my}, ${c.x2} ${my}, ${c.x2} ${c.y2}`}
              fill="none"
              stroke="rgba(255,255,255,.12)"
              strokeWidth="1.5"
              strokeDasharray="5,4"
              markerStart="url(#cdot)"
              markerEnd="url(#cdot)"
            />
          );
        })}
      </svg>

      {/* Section labels */}
      <div className="absolute z-10" style={{ top: 20, left: "50%", transform: "translateX(-50%)" }}>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
          style={{ background: "rgba(59,130,246,.15)", border: "0.5px solid rgba(59,130,246,.3)", color: "#60A5FA" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#60A5FA" strokeWidth="2" />
            <path d="M12 7v5l3 3" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
          </svg>
          When this happens
        </div>
      </div>
      <div className="absolute z-10" style={{ top: padTop + 250 - 24, left: "50%", transform: "translateX(-50%)" }}>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
          style={{ background: "rgba(168,85,247,.12)", border: "0.5px solid rgba(168,85,247,.3)", color: "#C084FC" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Then do this
        </div>
      </div>

      {/* Nodes */}
      <div className="relative z-[3] flex flex-col items-center" style={{ paddingTop: padTop, minHeight: svgH + 60 }}>
        {WORKFLOW_NODES.map((node, i) => (
          <div key={node.id}>
            <div
              style={{
                transform: node.offsetX ? `translateX(${node.offsetX}px)` : undefined,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <WorkflowNode
                node={node}
                selected={selectedId === node.id}
                onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
                isFirst={i === 0}
              />
            </div>

            {/* Add step button between sequential nodes (not between N4/N5 which are parallel) */}
            {i < 2 && (
              <div className="flex justify-center py-3">
                <button
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm transition-all hover:scale-110"
                  style={{ background: "var(--wf-primary)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Spacing between N3 and the parallel pair */}
            {i === 2 && <div style={{ height: 70 }} />}
          </div>
        ))}
      </div>

      {/* Canvas controls */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center rounded-[10px] px-2 py-1 gap-1"
        style={{ background: "var(--wf-bg-node)", border: "0.5px solid var(--wf-border-default)" }}
      >
        <button
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-colors"
          style={{ background: "rgba(255,255,255,.05)", color: "var(--wf-text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <button
          onClick={() => setZoom(120)}
          className="h-7 px-2 text-[11px] font-medium cursor-pointer"
          style={{ color: "var(--wf-text-secondary)" }}
        >
          {zoom}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(200, z + 10))}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-colors"
          style={{ background: "rgba(255,255,255,.05)", color: "var(--wf-text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="w-px h-4 mx-1" style={{ background: "var(--wf-border-default)" }} />
        <button className="h-7 px-2 text-[10px] cursor-pointer" style={{ color: "var(--wf-text-tertiary)" }}>Fit view</button>
        <button className="h-7 px-2 flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--wf-text-tertiary)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" /></svg>
          Lock
        </button>
      </div>

      {/* Bottom-left pill tabs */}
      <div
        className="absolute bottom-4 left-4 z-10 flex items-center rounded-lg p-1 gap-0.5"
        style={{ background: "var(--wf-bg-node)", border: "0.5px solid var(--wf-border-default)" }}
      >
        {(["Outline", "Detail", "History"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setViewMode(t)}
            className="px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer"
            style={{
              background: viewMode === t ? "rgba(255,255,255,.08)" : "transparent",
              color: viewMode === t ? "var(--wf-text-primary)" : "var(--wf-text-tertiary)",
              fontWeight: viewMode === t ? 500 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
