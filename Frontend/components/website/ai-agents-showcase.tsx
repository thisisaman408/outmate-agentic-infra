"use client"

import { motion } from "framer-motion"
import { Search, PenTool, BarChart3 } from "lucide-react"

const AGENTS = [
  {
    icon: Search,
    name: "Research Agent",
    color: "#4B3FE4",
    tagline: "Deep Account Intelligence",
    desc: "Deep-dives into target accounts, maps org charts, finds key stakeholders and buying triggers — automatically delivering a full account brief before your first call.",
    capabilities: ["Org chart mapping", "Stakeholder discovery", "Buying trigger identification", "Competitive intelligence"],
  },
  {
    icon: PenTool,
    name: "Outreach Agent",
    color: "#CAFF00",
    tagline: "Hyper-Personalized Messaging",
    desc: "Crafts hyper-personalized messages for email and LinkedIn based on enriched context, signal data, and persona fit — at scale, in seconds.",
    capabilities: ["Email sequence writing", "LinkedIn personalization", "A/B variant generation", "Tone & style adaptation"],
  },
  {
    icon: BarChart3,
    name: "Analysis Agent",
    color: "#7B5CFF",
    tagline: "Self-Optimizing GTM",
    desc: "Tracks campaign performance, learns what converts in your market, and self-optimizes your GTM motion — continuously improving response rates.",
    capabilities: ["Performance analytics", "Conversion attribution", "Self-optimization loops", "ICP scoring refinement"],
  },
]

export function AIAgentsShowcase() {
  return (
    <section className="bg-[#111127] py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">AI Agents</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Autonomous agents that work
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#CAFF00]">
              while you sleep.
            </span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="group relative p-8 rounded-2xl border border-white/5 bg-[#0A0A1A] cursor-default transition-all duration-300 hover:border-white/15"
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border transition-all duration-300 group-hover:scale-110"
                style={{ background: `${agent.color}12`, borderColor: `${agent.color}25` }}
              >
                <agent.icon className="h-7 w-7" style={{ color: agent.color }} />
              </div>

              {/* Badge */}
              <div
                className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold mb-3 border"
                style={{ color: agent.color, borderColor: `${agent.color}30`, background: `${agent.color}10` }}
              >
                {agent.tagline}
              </div>

              <h3
                className="text-xl font-black text-white mb-3"
                style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
              >
                {agent.name}
              </h3>
              <p className="text-[#A0A0C0] text-sm leading-relaxed mb-5" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
                {agent.desc}
              </p>

              {/* Capabilities */}
              <div className="space-y-2 border-t border-white/5 pt-5">
                {agent.capabilities.map((cap) => (
                  <div key={cap} className="flex items-center gap-2 text-xs text-[#A0A0C0]">
                    <div className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
                    {cap}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
