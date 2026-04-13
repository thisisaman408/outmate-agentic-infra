import { useState } from "react";
import { Minus, Plus, Maximize2, Lock } from "lucide-react";
import { C, type NodeData } from "./constants";
import WorkflowNode from "./WorkflowNode";

interface Props {
  nodes: NodeData[];
  onConfirmNode: (id: number) => void;
}

export default function StudioCanvas({ nodes, onConfirmNode }: Props) {
  const [zoom, setZoom] = useState(120);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const nodePositions = [
    { x: 0, y: 0 },
    { x: 0, y: 220 },
    { x: 0, y: 440 },
  ];

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: C.bg }}>
      {/* Dot grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }} />

      {/* SVG connectors */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs><marker id="dot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6"><circle cx="3" cy="3" r="2" fill="rgba(255,255,255,.15)" /></marker></defs>
        {nodes.slice(0, -1).map((_, i) => {
          const startY = 50 + nodePositions[i].y + 180;
          const endY = 50 + nodePositions[i + 1].y + 6;
          const cx = 50 + 140;
          return (
            <path key={i}
              d={`M${cx} ${startY} C${cx} ${startY + 20}, ${cx} ${endY - 20}, ${cx} ${endY}`}
              fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1.5" strokeDasharray="5,4"
              markerStart="url(#dot)" markerEnd="url(#dot)" />
          );
        })}
      </svg>

      {/* Flow section labels */}
      <div className="absolute z-10" style={{ top: 20, left: "50%", transform: "translateX(-50%)" }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.25)", color: "#60A5FA" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#60A5FA" strokeWidth="2" /><path d="M12 7v5l3 3" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" /></svg>
          When this happens
        </div>
      </div>
      <div className="absolute z-10" style={{ top: 230, left: "50%", transform: "translateX(-50%)" }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.25)", color: "#C084FC" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Then do this
        </div>
      </div>

      {/* Nodes */}
      <div className="absolute inset-0 flex flex-col items-center z-[2]" style={{ paddingTop: 50, gap: 0 }}>
        {nodes.map((node, i) => (
          <div key={node.id}>
            <WorkflowNode node={node} selected={selectedId === node.id}
              onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
              onConfirm={node.status === "building" ? () => onConfirmNode(node.id) : undefined} />
            {i < nodes.length - 1 && (
              <div className="flex justify-center py-2">
                <button className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-sm transition-transform hover:scale-110"
                  style={{ background: C.primary }}>+</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Canvas controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center rounded-[10px] p-[3px] gap-px"
        style={{ background: C.node, border: `1px solid ${C.border}` }}>
        <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: C.text40 }}><Minus size={13} /></button>
        <button onClick={() => setZoom(120)} className="h-7 px-2 text-[11px] font-medium" style={{ color: C.text70 }}>{zoom}%</button>
        <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: C.text40 }}><Plus size={13} /></button>
        <div className="w-px h-4 mx-1" style={{ background: C.border07 }} />
        <button className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: C.text40 }}><Maximize2 size={13} /></button>
        <button className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: C.text40 }}><Lock size={13} /></button>
      </div>
    </div>
  );
}
