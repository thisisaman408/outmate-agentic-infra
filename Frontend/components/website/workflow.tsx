"use client"

import { motion } from "framer-motion"

const NODES = [
  { label: "Trigger", sub: "Job change signal detected", icon: "⚡", color: "#CAFF00" },
  { label: "Enrich", sub: "Pull 50+ data fields", icon: "🔬", color: "#7B5CFF" },
  { label: "Score Lead", sub: "AI propensity model", icon: "📊", color: "#4B3FE4" },
  { label: "Generate Email", sub: "Hyper-personalized copy", icon: "✍️", color: "#7B5CFF" },
  { label: "Send Campaign", sub: "Launch via Instantly", icon: "🚀", color: "#CAFF00" },
]

export function Workflow() {
  return (
    <section className="bg-[#0A0A1A] py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">Workflow Builder</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Automate Any GTM Motion.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4B3FE4] to-[#CAFF00]">
              No Code Required.
            </span>
          </h2>
          <p className="text-[#A0A0C0] mt-4 max-w-xl mx-auto" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            Build powerful no-code GTM automations with a visual workflow builder.
            Connect signals to actions seamlessly — in minutes.
          </p>
        </motion.div>

        {/* Workflow diagram */}
        <div className="relative rounded-2xl border border-white/5 bg-[#111127] p-10 overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#4B3FE4]/5 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center justify-center gap-0">
            {NODES.map((node, i) => (
              <div key={node.label} className="flex flex-col md:flex-row items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className="flex flex-col items-center p-5 rounded-2xl border bg-[#0A0A1A] min-w-[130px] group cursor-default transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: `${node.color}30` }}
                  whileHover={{ boxShadow: `0 0 20px ${node.color}20` }}
                >
                  {/* Step badge */}
                  <div
                    className="w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center mb-3 text-black"
                    style={{ backgroundColor: node.color }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-2xl mb-2">{node.icon}</span>
                  <p className="text-xs font-black text-white text-center" style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
                    {node.label}
                  </p>
                  <p className="text-[10px] text-[#A0A0C0]/60 text-center mt-1">{node.sub}</p>
                </motion.div>

                {/* Connector arrow */}
                {i < NODES.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    whileInView={{ opacity: 1, scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 + 0.2, duration: 0.4 }}
                    className="flex items-center justify-center md:w-10 my-2 md:my-0"
                  >
                    <div className="h-px md:w-full w-px md:h-px h-6 bg-gradient-to-r from-white/10 to-white/10 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[#CAFF00] text-xs">→</div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Live indicator */}
          <div className="absolute bottom-4 right-6 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00] animate-pulse" />
            <span className="text-[10px] text-[#CAFF00] font-bold uppercase tracking-widest">Running Live</span>
          </div>
        </div>
      </div>
    </section>
  )
}
