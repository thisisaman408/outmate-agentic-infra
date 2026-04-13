import { useState } from "react";
import { Clock, Play } from "lucide-react";
import { C } from "./constants";

export default function ModeBar() {
  const [mode, setMode] = useState<"plan" | "execute">("plan");

  return (
    <div className="h-10 flex items-center justify-between px-4 border-b shrink-0"
      style={{ background: C.panel, borderColor: C.border07 }}>
      {/* Left: Plan / Execute */}
      <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: "rgba(255,255,255,.05)" }}>
        {(["plan", "execute"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="h-7 px-3 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all"
            style={mode === m
              ? { background: "#fff", color: "#111" }
              : { color: C.text40 }}>
            {m === "plan" ? "Plan" : "Execute"}
            <span className="text-[9px] font-bold px-1.5 py-px rounded-full"
              style={m === "plan"
                ? mode === m ? { background: C.primary, color: "#fff" } : { background: "rgba(79,70,229,.2)", color: "#818CF8" }
                : { background: "rgba(16,185,129,.15)", color: "#34D399" }}>
              {m === "plan" ? "DRAFT" : "LIVE"}
            </span>
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
          style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", color: "#FCD34D" }}>
          <Clock size={12} /> ~14 credits / run
        </div>
        <button className="h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium border transition-colors"
          style={{ background: "transparent", borderColor: C.border, color: C.text40 }}>
          <Play size={11} /> Test run
        </button>
        <button className="h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium border transition-colors"
          style={{ background: "transparent", borderColor: C.border, color: C.text40 }}>
          History
        </button>
      </div>
    </div>
  );
}
