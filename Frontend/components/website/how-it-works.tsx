"use client"

import { motion } from "framer-motion"
import { MessageSquare, Brain, Rocket } from "lucide-react"

const STEPS = [
  {
    icon: MessageSquare,
    color: "#CAFF00",
    step: "01",
    title: "Give a Prompt",
    desc: "Describe your GTM goal in plain English. No SQL, no filters, no complex setup — just talk to Outmate like a teammate.",
  },
  {
    icon: Brain,
    color: "#4B3FE4",
    step: "02",
    title: "Outmate Thinks",
    desc: "AI searches 4,000+ real-time signals, enriches data across 50+ sources, and segments your ICP automatically.",
  },
  {
    icon: Rocket,
    color: "#CAFF00",
    step: "03",
    title: "Execute at Scale",
    desc: "Campaigns, sequences, and workflows launch automatically — personalized for every prospect, at any scale.",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.5 } }),
}

export function HowItWorks() {
  return (
    <section className="bg-[#0A0A1A] py-28 px-6 relative overflow-hidden">
      {/* top divider glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-transparent to-[#4B3FE4]/50" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">How It Works</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Three steps to autonomous GTM
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-16 left-[16.7%] right-[16.7%] h-px bg-gradient-to-r from-transparent via-[#4B3FE4]/30 to-transparent" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
              className="relative flex flex-col items-center text-center group"
            >
              {/* Icon circle */}
              <div
                className="relative mb-6 w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                style={{
                  background: `${step.color}15`,
                  borderColor: `${step.color}30`,
                }}
              >
                <step.icon className="h-7 w-7" style={{ color: step.color }} />
                {/* Step number */}
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center text-black"
                  style={{ background: step.color }}
                >
                  {i + 1}
                </div>
              </div>

              <h3
                className="text-xl font-black text-white mb-3"
                style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
              >
                {step.title}
              </h3>
              <p className="text-[#A0A0C0] text-sm leading-relaxed max-w-xs" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
