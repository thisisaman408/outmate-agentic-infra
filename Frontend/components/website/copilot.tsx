"use client"

import { motion } from "framer-motion"

const CHAT = [
  {
    role: "user",
    text: "Which accounts should I prioritize this week?",
  },
  {
    role: "ai",
    text: `Based on intent signals and recent activity, here are your top 3 accounts:

**1. Acme Corp** — Intent score 94/100
   • 3 team members visited pricing page in the last 48h
   • VP of Sales posted about "SDR tooling" on LinkedIn
   • Recommended action: Send personalized outreach today

**2. TechFlow Inc** — Intent score 87/100
   • Recently raised $12M Series A (3 days ago)
   • Headcount growing 40% QoQ — hiring 5 SDRs
   • Recommended action: Congratulate + pitch enrichment

**3. Nexus AI** — Intent score 81/100
   • CTO just changed jobs — new CTO onboarding
   • Evaluating 3 competitors per Bombora data
   • Recommended action: Strike while evaluating`,
  },
  {
    role: "user",
    text: "Draft outreach for the top 3",
  },
  {
    role: "ai",
    text: `Here are 3 personalized emails — ready to send:

**Acme Corp →** "Hey [Name], noticed your team has been deep in pricing research. We've helped similar RevOps teams at [similar company] cut time-to-close by 30%..."

**TechFlow Inc →** "Congrats on the Series A! As you scale your GTM, the difference between good and great often comes down to the signals you're acting on..."

**Nexus AI →** "Hope the onboarding is going well. Many new CTOs we work with use the first 90 days to run a quick GTM audit — happy to share what's working..."`,
  },
]

export function Copilot() {
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
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#CAFF00]">Outmate Copilot</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white leading-tight"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Your AI GTM Teammate,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#CAFF00]">
              Always On.
            </span>
          </h2>
          <p className="text-[#A0A0C0] leading-relaxed" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            Ask Outmate Copilot anything — get instant analysis, account prioritization,
            personalized outreach, and campaign recommendations in seconds.
          </p>
          <ul className="space-y-3">
            {["Prioritize pipeline by intent score", "Draft personalized outreach at scale", "Analyze campaign performance & suggest fixes"].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-[#A0A0C0]">
                <div className="h-5 w-5 rounded-full bg-[#CAFF00]/10 border border-[#CAFF00]/30 flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00]" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Right — Chat mockup */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/8 bg-[#0A0A1A] overflow-hidden"
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-[#4B3FE4] flex items-center justify-center">
              <span className="text-white text-xs font-black">O</span>
            </div>
            <span className="text-sm font-semibold text-white">Outmate Copilot</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00] animate-pulse" />
              <span className="text-[10px] text-[#CAFF00]">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="p-5 space-y-4 max-h-[440px] overflow-y-auto">
            {CHAT.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-[#4B3FE4] text-white rounded-br-sm"
                      : "bg-[#111127] border border-white/8 text-[#A0A0C0] rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input bar */}
          <div className="px-5 py-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#111127] border border-white/8">
              <input
                className="flex-1 bg-transparent text-xs text-[#A0A0C0] placeholder:text-[#A0A0C0]/40 outline-none"
                placeholder="Ask Outmate anything..."
                readOnly
              />
              <button className="h-6 w-6 rounded-lg bg-[#4B3FE4] flex items-center justify-center shrink-0">
                <span className="text-white text-xs">↑</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
