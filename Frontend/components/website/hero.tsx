"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, ArrowRight, Sparkles, Flame, CheckCircle2, Mail } from "lucide-react"

const PLACEHOLDERS = [
  "Find SaaS companies using Salesforce that recently raised Series B...",
  "Enrich my prospect list with LinkedIn data and verified emails...",
  "Launch a personalized campaign for fintech companies hiring SDRs...",
  "Show me high-intent accounts in my ICP with job change signals...",
  "Research all Series A companies in EU that use HubSpot + Stripe...",
]

const FLOATING_CARDS = [
  { icon: Flame, color: "#FF4D4D", text: "Intent signal detected", sub: "Acme Corp just visited your pricing page", delay: 0 },
  { icon: CheckCircle2, color: "#CAFF00", text: "47 contacts enriched", sub: "LinkedIn + verified email data added", delay: 1.2 },
  { icon: Mail, color: "#7B5CFF", text: "Campaign launched", sub: "150 personalized sequences sent", delay: 2.4 },
]

const COMPANY_LOGOS = ["Stripe", "Figma", "Linear", "Notion", "Rippling", "Brex"]

function NLPPromptBox() {
  const [value, setValue] = useState("")
  const [placeholder, setPlaceholder] = useState("")
  const [phIdx, setPhIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (focused) return
    const current = PLACEHOLDERS[phIdx]
    let timer: ReturnType<typeof setTimeout>

    if (!deleting && charIdx < current.length) {
      timer = setTimeout(() => {
        setPlaceholder(current.slice(0, charIdx + 1))
        setCharIdx((c) => c + 1)
      }, 38)
    } else if (!deleting && charIdx === current.length) {
      timer = setTimeout(() => setDeleting(true), 2200)
    } else if (deleting && charIdx > 0) {
      timer = setTimeout(() => {
        setPlaceholder(current.slice(0, charIdx - 1))
        setCharIdx((c) => c - 1)
      }, 18)
    } else if (deleting && charIdx === 0) {
      setDeleting(false)
      setPhIdx((i) => (i + 1) % PLACEHOLDERS.length)
    }
    return () => clearTimeout(timer)
  }, [charIdx, deleting, phIdx, focused])

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Gradient border glow */}
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
          focused
            ? "bg-gradient-to-r from-[#4B3FE4] via-[#7B5CFF] to-[#CAFF00] p-px opacity-100"
            : "bg-gradient-to-r from-[#4B3FE4]/40 to-[#7B5CFF]/20 p-px opacity-60"
        }`}
        style={{ filter: focused ? "blur(0px)" : undefined }}
      >
        <div className="h-full w-full rounded-2xl bg-[#111127]" />
      </div>

      <div className="relative flex items-center h-[72px] px-5 gap-3">
        <Sparkles className="h-5 w-5 text-[#4B3FE4] shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white placeholder:text-[#A0A0C0]/60 text-base outline-none min-w-0"
          style={{ fontFamily: "var(--font-inter, sans-serif)" }}
        />
        <Link
          href="/auth/signup"
          className="shrink-0 flex items-center gap-2 h-11 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#4B3FE4] to-[#CAFF00]/80 hover:from-[#5B4FF4] hover:to-[#DAFF20] transition-all shadow-lg shadow-[#4B3FE4]/30 whitespace-nowrap"
        >
          Run Outmate <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stat chips below box */}
      <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
        {["4,000+ Signals", "50+ Enrichment Sources", "AI-Powered Execution"].map((stat) => (
          <div key={stat} className="flex items-center gap-1.5 text-xs text-[#A0A0C0]">
            <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00]" />
            {stat}
          </div>
        ))}
      </div>
    </div>
  )
}

function FloatingDashboard() {
  return (
    <div className="relative h-[340px] w-full max-w-sm mx-auto">
      {FLOATING_CARDS.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20, x: i % 2 === 0 ? -10 : 10 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          transition={{ delay: card.delay + 0.8, duration: 0.6, ease: "easeOut" }}
          className="absolute left-0 right-0 glass-card rounded-2xl px-4 py-3 border border-white/10 bg-[#111127]/80 backdrop-blur-lg"
          style={{ top: `${i * 112}px` }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <card.icon className="h-5 w-5" style={{ color: card.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{card.text}</p>
              <p className="text-xs text-[#A0A0C0] mt-0.5">{card.sub}</p>
            </div>
            <div className="ml-auto">
              <div className="h-2 w-2 rounded-full bg-[#CAFF00] animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// Pre-generated star data — static so server and client render identically (no hydration mismatch)
const STARS = [
  { w: 1.4, h: 1.2, l: 12.3, t: 8.7, op: 0.22, dur: 3.1, del: 0.4 },
  { w: 2.1, h: 1.8, l: 27.6, t: 23.4, op: 0.31, dur: 2.6, del: 1.1 },
  { w: 1.2, h: 2.4, l: 43.9, t: 61.2, op: 0.18, dur: 4.0, del: 0.7 },
  { w: 1.8, h: 1.4, l: 58.1, t: 15.8, op: 0.27, dur: 3.4, del: 1.8 },
  { w: 2.3, h: 1.1, l: 71.4, t: 42.6, op: 0.35, dur: 2.9, del: 0.2 },
  { w: 1.1, h: 1.9, l: 84.7, t: 78.3, op: 0.21, dur: 3.7, del: 1.5 },
  { w: 2.6, h: 2.2, l: 5.2,  t: 53.1, op: 0.16, dur: 4.2, del: 0.9 },
  { w: 1.5, h: 1.6, l: 19.8, t: 87.5, op: 0.29, dur: 3.0, del: 1.3 },
  { w: 1.9, h: 1.3, l: 35.6, t: 32.9, op: 0.38, dur: 2.8, del: 0.5 },
  { w: 1.3, h: 2.7, l: 50.4, t: 74.1, op: 0.24, dur: 3.6, del: 1.7 },
  { w: 2.8, h: 1.7, l: 64.2, t: 6.3,  op: 0.19, dur: 4.1, del: 0.3 },
  { w: 1.6, h: 2.0, l: 78.9, t: 95.4, op: 0.33, dur: 2.7, del: 1.0 },
  { w: 1.0, h: 1.5, l: 92.3, t: 48.7, op: 0.26, dur: 3.3, del: 1.9 },
  { w: 2.4, h: 2.8, l: 8.7,  t: 69.2, op: 0.14, dur: 4.4, del: 0.6 },
  { w: 1.7, h: 1.0, l: 23.1, t: 11.6, op: 0.41, dur: 2.5, del: 1.2 },
  { w: 2.0, h: 2.3, l: 38.4, t: 84.3, op: 0.23, dur: 3.8, del: 0.8 },
  { w: 1.4, h: 1.7, l: 53.7, t: 27.8, op: 0.36, dur: 3.1, del: 1.6 },
  { w: 2.9, h: 1.4, l: 67.5, t: 56.4, op: 0.17, dur: 4.3, del: 0.1 },
  { w: 1.2, h: 2.1, l: 81.8, t: 18.9, op: 0.30, dur: 2.9, del: 1.4 },
  { w: 2.2, h: 1.8, l: 96.1, t: 91.7, op: 0.25, dur: 3.5, del: 0.7 },
  { w: 1.8, h: 2.5, l: 3.4,  t: 37.6, op: 0.20, dur: 4.0, del: 1.1 },
  { w: 1.5, h: 1.2, l: 17.9, t: 63.4, op: 0.39, dur: 2.7, del: 0.3 },
  { w: 2.6, h: 1.9, l: 32.2, t: 4.8,  op: 0.15, dur: 3.9, del: 1.8 },
  { w: 1.1, h: 2.6, l: 46.8, t: 47.3, op: 0.32, dur: 3.2, del: 0.5 },
  { w: 1.9, h: 1.3, l: 61.3, t: 82.1, op: 0.28, dur: 2.6, del: 1.5 },
  { w: 2.7, h: 2.0, l: 75.6, t: 13.5, op: 0.13, dur: 4.5, del: 0.9 },
  { w: 1.3, h: 1.6, l: 89.9, t: 71.8, op: 0.37, dur: 3.0, del: 1.2 },
  { w: 2.3, h: 2.9, l: 14.2, t: 92.6, op: 0.22, dur: 3.7, del: 0.4 },
  { w: 1.6, h: 1.1, l: 28.5, t: 40.7, op: 0.43, dur: 2.8, del: 1.7 },
  { w: 2.0, h: 2.4, l: 44.1, t: 19.3, op: 0.18, dur: 4.2, del: 0.2 },
  { w: 1.7, h: 1.8, l: 59.4, t: 66.9, op: 0.34, dur: 3.4, del: 1.0 },
  { w: 2.5, h: 1.5, l: 73.7, t: 34.2, op: 0.21, dur: 3.1, del: 1.6 },
  { w: 1.0, h: 2.2, l: 88.0, t: 58.7, op: 0.40, dur: 2.9, del: 0.6 },
  { w: 1.4, h: 1.9, l: 9.3,  t: 80.4, op: 0.26, dur: 3.6, del: 1.3 },
  { w: 2.8, h: 1.6, l: 24.6, t: 25.1, op: 0.15, dur: 4.1, del: 0.8 },
  { w: 1.2, h: 2.7, l: 39.9, t: 51.8, op: 0.33, dur: 3.3, del: 1.9 },
  { w: 2.1, h: 1.3, l: 55.2, t: 9.5,  op: 0.27, dur: 2.7, del: 0.1 },
  { w: 1.6, h: 2.0, l: 70.5, t: 76.2, op: 0.38, dur: 3.8, del: 1.4 },
  { w: 2.4, h: 2.6, l: 85.8, t: 45.9, op: 0.20, dur: 4.4, del: 0.7 },
  { w: 1.9, h: 1.4, l: 98.1, t: 29.6, op: 0.31, dur: 3.0, del: 1.1 },
]

function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-[#4B3FE4]/15 blur-[120px]" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#7B5CFF]/10 blur-[100px]" />
      <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-[#4B3FE4]/8 blur-[80px]" />
      {/* Star dots — positions pre-seeded to avoid SSR/client hydration mismatch */}
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ width: s.w, height: s.h, left: `${s.l}%`, top: `${s.t}%`, opacity: s.op }}
          animate={{ opacity: [s.op * 0.4, s.op * 1.6, s.op * 0.4] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.del }}
        />
      ))}
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16 bg-[#0A0A1A] overflow-hidden">
      <BackgroundOrbs />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — text + input */}
          <div className="space-y-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#4B3FE4]/40 bg-[#4B3FE4]/10 text-[#A0A0FF] text-xs font-semibold">
                <Zap className="h-3.5 w-3.5 text-[#CAFF00]" />
                The All-in-One Autonomous GTM AI Platform
              </div>
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight text-white"
              style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
            >
              Your Entire{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#CAFF00]">
                GTM Motion.
              </span>
              <br />
              One Prompt Away.
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-[#A0A0C0] leading-relaxed max-w-xl"
              style={{ fontFamily: "var(--font-inter, sans-serif)" }}
            >
              Outmate's AI understands your GTM goals and autonomously executes signals,
              enrichment, campaigns, and outreach — all from a single prompt.
            </motion.p>

            {/* NLP Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <NLPPromptBox />
            </motion.div>

            {/* Trust bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-3"
            >
              <p className="text-xs text-[#A0A0C0]">Trusted by 500+ revenue teams</p>
              <div className="flex items-center gap-5 flex-wrap">
                {COMPANY_LOGOS.map((name) => (
                  <div key={name} className="text-xs font-semibold text-[#A0A0C0]/50 tracking-widest uppercase">
                    {name}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right — Floating dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="hidden lg:block"
          >
            <FloatingDashboard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
