const C = {
  panel: "var(--wf-bg-panel)",
  border: "var(--wf-border-default)",
  borderStrong: "var(--wf-border-strong)",
  primary: "var(--wf-primary)",
  primaryHover: "var(--wf-primary-hover)",
  text: "var(--wf-text-primary)",
  text2: "var(--wf-text-secondary)",
  text3: "var(--wf-text-tertiary)",
  text4: "var(--wf-text-hint)",
};

export default function TopBar() {
  return (
    <div
      className="h-[50px] flex items-center px-4 shrink-0"
      style={{ background: C.panel, borderBottom: `0.5px solid ${C.border}` }}
    >
      {/* Left: breadcrumb + name */}
      <div className="flex items-center gap-0">
        <span className="text-[11px] cursor-pointer" style={{ color: C.text4 }}>Workflows</span>
        <span className="text-[11px] mx-1" style={{ color: "rgba(255,255,255,.15)" }}> › </span>
        <span className="text-[11px] cursor-pointer" style={{ color: C.text4 }}>ICP Outbound Army</span>
        <span className="text-[11px] mx-1" style={{ color: "rgba(255,255,255,.15)" }}> › </span>
        <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,.8)" }}>Edit workflow</span>
      </div>

      <div className="mx-3 h-4" style={{ width: "0.5px", background: C.border }} />

      <span className="text-sm font-semibold" style={{ color: C.text }}>ICP Outbound Army</span>
      <span
        className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
        style={{ color: C.text3, background: "rgba(255,255,255,.07)", letterSpacing: ".04em" }}
      >
        Draft
      </span>

      {/* Right */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Undo */}
        <button className="w-8 h-8 rounded-md flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 14L4 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.text2 }} /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.text2 }} /></svg>
        </button>
        {/* Redo */}
        <button className="w-8 h-8 rounded-md flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 14l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.text2 }} /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.text2 }} /></svg>
        </button>

        <div className="mx-1 h-4" style={{ width: "0.5px", background: C.border }} />

        {/* Share */}
        <button className="h-8 px-3 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-colors" style={{ border: `0.5px solid ${C.borderStrong}`, color: C.text2 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Share
        </button>
        {/* Test run */}
        <button className="h-8 px-3 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-colors" style={{ border: `0.5px solid ${C.borderStrong}`, color: C.text2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="currentColor" /></svg>
          Test run
        </button>
        {/* Launch */}
        <button className="h-8 px-3.5 rounded-md flex items-center gap-1.5 text-xs font-semibold text-white transition-colors" style={{ background: C.primary }}>
          Launch workflow
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
