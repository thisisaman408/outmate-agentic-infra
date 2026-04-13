export function NodeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const s = size;
  switch (type) {
    case "signal": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="#818CF8" strokeWidth="2" fill="none"/><line x1="8" y1="10" x2="16" y2="10" stroke="#818CF8" strokeWidth="1.5"/><line x1="8" y1="14" x2="16" y2="14" stroke="#818CF8" strokeWidth="1.5"/></svg>;
    case "enrich": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#60A5FA" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "score": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" stroke="#FBBF24" strokeWidth="2" fill="none"/></svg>;
    case "email": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#34D399" strokeWidth="2"/><path d="M3 7l9 6 9-6" stroke="#34D399" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "crm": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" fill="#60A5FA" opacity=".6"/><rect x="14" y="3" width="7" height="7" rx="1" fill="#60A5FA" opacity=".6"/><rect x="3" y="14" width="7" height="7" rx="1" fill="#60A5FA" opacity=".6"/><rect x="14" y="14" width="7" height="7" rx="1" fill="#60A5FA" opacity=".4"/></svg>;
    case "linkedin": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#60A5FA" strokeWidth="2"/><path d="M8 11v5M8 8v.01M12 16v-3.5c0-1.38 1.12-2.5 2.5-2.5S17 11.12 17 12.5V16" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "condition": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3l9 9-9 9-9-9z" stroke="#FBBF24" strokeWidth="2" fill="none"/></svg>;
    case "wait": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#FBBF24" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "end": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#F87171" strokeWidth="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "end-ok": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#34D399" strokeWidth="2"/><path d="M8 12l3 3 5-5" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "ai": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#C084FC" strokeWidth="2" fill="none"/><path d="M9 9h6v6H9z" stroke="#C084FC" strokeWidth="1.5"/></svg>;
    case "slack": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M14.5 2A1.5 1.5 0 0013 3.5V8h1.5A1.5 1.5 0 0016 6.5v-3A1.5 1.5 0 0014.5 2z" fill="#FBBF24" opacity=".7"/><path d="M3 14.5A1.5 1.5 0 004.5 16H8v-1.5A1.5 1.5 0 006.5 13h-3A1.5 1.5 0 003 14.5z" fill="#34D399" opacity=".7"/><path d="M21 9.5A1.5 1.5 0 0019.5 8H16v1.5A1.5 1.5 0 0017.5 11h3A1.5 1.5 0 0021 9.5z" fill="#60A5FA" opacity=".7"/><path d="M9.5 22A1.5 1.5 0 0011 20.5V16H9.5A1.5 1.5 0 008 17.5v3A1.5 1.5 0 009.5 22z" fill="#F87171" opacity=".7"/></svg>;
    case "voice": return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="#C084FC" strokeWidth="2"/><path d="M5 10a7 7 0 0014 0" stroke="#C084FC" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="#C084FC" strokeWidth="2" strokeLinecap="round"/></svg>;
    default: return null;
  }
}

export function Waveform() {
  return (
    <div className="flex items-center gap-[2px] ml-1">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="w-[2px] rounded-full" style={{
          background: "#818CF8", height: `${6 + Math.random() * 8}px`,
          animation: `waveBar 0.6s ease-in-out ${i * 0.08}s infinite alternate`,
        }} />
      ))}
      <style>{`@keyframes waveBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
    </div>
  );
}
