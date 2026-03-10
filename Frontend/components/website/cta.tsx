"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"

const PLACEHOLDERS_SHORT = [
  "Find Series B SaaS companies using Salesforce...",
  "Enrich my prospects with verified emails...",
  "Launch personalized campaigns for fintech SDR buyers...",
]

export function CTA() {
  return (
    <section className="relative bg-[#0A0A1A] py-28 px-6 overflow-hidden">
      {/* Purple glow backdrop */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4B3FE4]/8 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#4B3FE4]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2
            className="text-4xl lg:text-6xl font-black text-white leading-tight"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Your Next Pipeline Starts
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#CAFF00]">
              With One Prompt.
            </span>
          </h2>
        </motion.div>

        {/* Mini prompt box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#4B3FE4]/50 to-[#CAFF00]/20 p-px">
            <div className="h-full w-full rounded-2xl bg-[#111127]" />
          </div>
          <div className="relative flex items-center h-16 px-5 gap-3">
            <Sparkles className="h-4 w-4 text-[#4B3FE4] shrink-0" />
            <span className="flex-1 text-sm text-[#A0A0C0]/50 text-left">
              {PLACEHOLDERS_SHORT[0]}
            </span>
            <Link
              href="/auth/signup"
              className="shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-[#4B3FE4] to-[#CAFF00]/80 hover:from-[#5B4FF4] hover:to-[#DAFF20] transition-all shadow-lg shadow-[#4B3FE4]/30"
            >
              Start Free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-2xl font-bold text-white bg-gradient-to-r from-[#4B3FE4] to-[#7B5CFF] hover:from-[#5B4FF4] hover:to-[#8B6FFF] transition-all shadow-2xl shadow-[#4B3FE4]/30 hover:shadow-[#4B3FE4]/50 hover:scale-[1.02]"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Start Free Trial
          </Link>
          <a
            href="#"
            className="inline-flex items-center justify-center h-14 px-10 rounded-2xl font-bold text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Book a Demo
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-xs text-[#A0A0C0]/50"
          style={{ fontFamily: "var(--font-inter, sans-serif)" }}
        >
          No credit card required · 2-minute setup · Cancel anytime
        </motion.p>
      </div>
    </section>
  )
}
