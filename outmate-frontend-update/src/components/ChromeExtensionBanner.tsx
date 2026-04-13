import { useState, useEffect, useCallback } from "react";

interface ChromeExtensionBannerProps {
  onInstall: () => void;
}

export default function ChromeExtensionBanner({ onInstall }: ChromeExtensionBannerProps) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("banner_dismissed") === "true");
  const [animating, setAnimating] = useState(false);

  const dismiss = useCallback((install = false) => {
    setAnimating(true);
    if (install) onInstall();
    setTimeout(() => {
      setDismissed(true);
      localStorage.setItem("banner_dismissed", "true");
    }, 300);
  }, [onInstall]);

  if (dismissed) return null;

  return (
    <div
      style={{
        maxHeight: animating ? 0 : 38,
        opacity: animating ? 0 : 1,
        padding: animating ? "0 20px" : "0 20px",
        overflow: "hidden",
        transition: "max-height 0.3s ease, opacity 0.25s ease",
        background: "#18181B",
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: animating ? 0 : 38,
        flexShrink: 0,
      }}
    >
      {/* Left accent strip */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#4F46E5" }} />

      {/* Left section */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {/* Rocket SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11.95A22 22 0 0112 15z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3" />
        </svg>

        <span
          style={{
            fontSize: 8,
            background: "#4F46E5",
            color: "#fff",
            letterSpacing: ".04em",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          NEW
        </span>

        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.65)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>Find your next leads with intent signals</strong>
          {" — Detect buying intent, enrich prospects & automate outreach with AI-powered agents"}
        </span>
      </div>

      {/* Center features */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
        <span>· Intent detection</span>
        <span>· Auto enrichment</span>
        <span>· Smart outreach</span>
        <span>· Pipeline acceleration</span>
      </div>

      {/* Right section */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7 }}>
        <button
          onClick={() => dismiss(true)}
          style={{
            background: "#4F46E5",
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#4338CA")}
          onMouseLeave={e => (e.currentTarget.style.background = "#4F46E5")}
        >
          Get started free
        </button>

        <button
          onClick={() => dismiss(false)}
          style={{
            background: "none",
            border: "none",
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          Remind me later
        </button>

        <button
          onClick={() => dismiss(false)}
          style={{
            width: 22,
            height: 22,
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            color: "rgba(255,255,255,0.25)",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            e.currentTarget.style.color = "rgba(255,255,255,0.5)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "rgba(255,255,255,0.25)";
          }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="8" y2="8" />
            <line x1="8" y1="1" x2="1" y2="8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
