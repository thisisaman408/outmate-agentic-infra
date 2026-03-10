"use client"

import { motion } from "framer-motion"

const LOGOS_ROW1 = [
  "Salesforce", "HubSpot", "Instantly", "Lemlist", "Explorium",
  "Crustdata", "Airscale", "Slack", "Unipile", "BetterContact",
  "Salesforce", "HubSpot", "Instantly", "Lemlist", "Explorium",
]

const LOGOS_ROW2 = [
  "Apollo", "Clay", "Outreach", "Salesloft", "ZoomInfo",
  "LinkedIn", "Gmail", "Zapier", "Make", "Clearbit",
  "Apollo", "Clay", "Outreach", "Salesloft", "ZoomInfo",
]

function LogoRow({ logos, reverse = false }: { logos: string[]; reverse?: boolean }) {
  return (
    <div className="relative flex overflow-hidden py-2">
      <motion.div
        className="flex gap-6 shrink-0"
        animate={{ x: reverse ? ["0%", "50%"] : ["0%", "-50%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        {[...logos, ...logos].map((logo, i) => (
          <div
            key={`${logo}-${i}`}
            className="flex items-center justify-center h-10 px-6 rounded-xl border border-white/8 bg-[#111127] text-xs font-bold text-[#A0A0C0]/50 tracking-widest uppercase whitespace-nowrap shrink-0"
          >
            {logo}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export function Integrations() {
  return (
    <section id="integrations" className="bg-[#0A0A1A] py-28 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">Integrations</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Works With Your Entire Stack.
          </h2>
          <p className="text-[#A0A0C0] mt-4" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            Connect Outmate to your CRM, outreach tools, data providers, and communication stack.
          </p>
        </motion.div>

        <div className="space-y-4">
          <LogoRow logos={LOGOS_ROW1} />
          <LogoRow logos={LOGOS_ROW2} reverse />
        </div>
      </div>
    </section>
  )
}
