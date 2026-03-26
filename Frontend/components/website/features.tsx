"use client"

import { motion } from "framer-motion"
import { Zap, Search, Megaphone, Bot, RefreshCw, Brain } from "lucide-react"

const FEATURES = [
  {
    icon: Zap,
    title: "Signal Engine",
    desc: "4,000+ real-time buying signals including intent data, job changes, funding events, tech installs, news triggers, and social activity.",
    accent: "#CAFF00",
  },
  {
    icon: Search,
    title: "Deep Enrichment",
    desc: "Enrich businesses and prospects with 100+ data fields from 50+ providers including Explorium, Crustdata, Airscale, BetterContact, and Unipile.",
    accent: "#4B3FE4",
  },
  {
    icon: Megaphone,
    title: "AI Campaigns",
    desc: "Generate hyper-personalized multi-channel campaigns and outreach sequences automatically based on enriched signals.",
    accent: "#7B5CFF",
  },
  {
    icon: Bot,
    title: "Outmate Copilot",
    desc: "Your AI GTM assistant. Ask any question, get instant analysis, recommendations, and actionable next steps.",
    accent: "#CAFF00",
  },
  {
    icon: RefreshCw,
    title: "Workflows & Automation",
    desc: "Build powerful no-code GTM automations with a visual workflow builder. Connect signals to actions seamlessly.",
    accent: "#4B3FE4",
  },
  {
    icon: Brain,
    title: "AI Agents",
    desc: "Deploy autonomous AI agents that research accounts, personalize at scale, and execute outbound end-to-end.",
    accent: "#7B5CFF",
  },
]

export function Features() {
  return (
    <section id="platform" className="bg-[#0A0A1A] py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">Platform</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Everything your GTM needs.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4B3FE4] to-[#CAFF00]">
              All in one platform.
            </span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="group relative p-7 rounded-2xl border border-white/5 bg-[#111127] cursor-default transition-all duration-300 hover:border-white/15 hover:shadow-xl"
              style={{ boxShadow: undefined }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at 50% 0%, ${feat.accent}08 0%, transparent 60%)` }}
              />

              <div className="relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border"
                  style={{ background: `${feat.accent}12`, borderColor: `${feat.accent}25` }}
                >
                  <feat.icon className="h-6 w-6" style={{ color: feat.accent }} />
                </div>
                <h3
                  className="text-lg font-black text-white mb-3"
                  style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
                >
                  {feat.title}
                </h3>
                <p className="text-[#A0A0C0] text-sm leading-relaxed" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
