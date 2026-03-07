"use client"

import { motion } from "framer-motion"

const SIGNAL_TYPES = [
  "Job Change Signals", "Tech Install Data", "Funding Rounds",
  "Intent Data", "News Triggers", "Company Growth",
  "Social Signals", "Website Visitors",
]

const ORBIT_ITEMS = [
  { label: "Job Change", angle: 0, color: "#CAFF00" },
  { label: "Funding", angle: 45, color: "#7B5CFF" },
  { label: "Intent", angle: 90, color: "#CAFF00" },
  { label: "Tech Stack", angle: 135, color: "#4B3FE4" },
  { label: "News", angle: 180, color: "#CAFF00" },
  { label: "Visitor", angle: 225, color: "#7B5CFF" },
  { label: "Social", angle: 270, color: "#CAFF00" },
  { label: "Growth", angle: 315, color: "#4B3FE4" },
]

function RadarViz() {
  const R = 120

  return (
    <div className="relative w-72 h-72 mx-auto">
      {/* Orbit rings */}
      {[1, 0.7, 0.45].map((scale, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border border-white/5"
          style={{ margin: `${(1 - scale) * 50}%` }}
        />
      ))}

      {/* Pulsing core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-[#4B3FE4]/30 border border-[#4B3FE4]/60 flex items-center justify-center"
        >
          <div className="w-10 h-10 rounded-full bg-[#4B3FE4] flex items-center justify-center">
            <span className="text-white text-[10px] font-black">AI</span>
          </div>
        </motion.div>
      </div>

      {/* Orbiting signal nodes */}
      {ORBIT_ITEMS.map((item, i) => {
        const rad = (item.angle * Math.PI) / 180
        const x = Math.cos(rad) * R
        const y = Math.sin(rad) * R
        return (
          <motion.div
            key={item.label}
            className="absolute flex flex-col items-center"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%, -50%)" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
            />
            {/* Connector line */}
            <svg
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: R,
                height: 2,
                transform: `rotate(${item.angle + 180}deg)`,
                transformOrigin: "0 0",
              }}
            >
              <line x1="0" y1="1" x2={R - 14} y2="1" stroke={item.color} strokeWidth="1" strokeOpacity="0.2" />
            </svg>
          </motion.div>
        )
      })}
    </div>
  )
}

export function SignalEngine() {
  return (
    <section className="bg-[#111127] py-28 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#CAFF00]">Signal Engine</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white leading-tight"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            4,000+ Buying Signals.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#CAFF00]">
              All in Real-Time.
            </span>
          </h2>
          <p className="text-[#A0A0C0] leading-relaxed" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            Outmate monitors thousands of signals across the web so your team always knows
            the perfect moment to reach out.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SIGNAL_TYPES.map((sig) => (
              <div key={sig} className="flex items-center gap-2 text-sm text-[#A0A0C0]">
                <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00] shrink-0" />
                {sig}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right — Radar */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex justify-center"
        >
          <RadarViz />
        </motion.div>
      </div>
    </section>
  )
}
