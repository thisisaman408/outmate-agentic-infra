import { useState } from "react";

const TABS = ["Workflow", "Settings", "Enrollment", "History"];

export default function SubTabs() {
  const [active, setActive] = useState(0);

  return (
    <div
      className="h-10 flex items-end px-4 shrink-0"
      style={{ background: "var(--wf-bg-panel)", borderBottom: "0.5px solid var(--wf-border-default)" }}
    >
      {TABS.map((t, i) => {
        const isActive = i === active;
        return (
          <button
            key={t}
            onClick={() => setActive(i)}
            className="flex items-center gap-1.5 px-3 pb-2 transition-colors relative"
            style={{ color: isActive ? "#fff" : "var(--wf-text-tertiary)", fontWeight: isActive ? 600 : 500 }}
          >
            <span
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{
                background: isActive ? "rgba(79,70,229,.3)" : "rgba(255,255,255,.08)",
                color: isActive ? "#818CF8" : "var(--wf-text-hint)",
              }}
            >
              {i + 1}
            </span>
            <span className="text-xs">{t}</span>
            {isActive && (
              <div className="absolute bottom-0 left-3 right-3 h-0.5" style={{ background: "var(--wf-primary)" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
