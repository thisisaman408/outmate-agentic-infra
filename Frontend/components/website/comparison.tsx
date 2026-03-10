"use client"

import { motion } from "framer-motion"
import { Check, X, Minus } from "lucide-react"

const ROWS = [
  "NLP Prompt Interface",
  "4,000+ Buying Signals",
  "AI Copilot",
  "Autonomous AI Agents",
  "Visual Workflow Builder",
  "Deep Prospect Enrichment",
  "Business Enrichment",
]

const COMPETITORS = [
  { name: "Outmate", highlight: true, values: [true, true, true, true, true, true, true] },
  { name: "ZoomInfo", highlight: false, values: [false, "partial", false, false, false, true, true] },
  { name: "Clay", highlight: false, values: ["partial", false, false, false, true, true, false] },
  { name: "Apollo", highlight: false, values: [false, "partial", false, false, false, true, false] },
  { name: "Persana", highlight: false, values: ["partial", false, false, "partial", false, "partial", false] },
]

function Cell({ value }: { value: boolean | "partial" }) {
  if (value === true) return <Check className="h-5 w-5 text-[#CAFF00] mx-auto" />
  if (value === "partial") return <Minus className="h-5 w-5 text-[#A0A0C0]/50 mx-auto" />
  return <X className="h-4 w-4 text-[#A0A0C0]/30 mx-auto" />
}

export function Comparison() {
  return (
    <section className="bg-[#111127] py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">vs. The Alternatives</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Why Teams Switch to Outmate
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto rounded-2xl border border-white/8"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-xs text-[#A0A0C0] font-semibold uppercase tracking-widest w-48">
                  Feature
                </th>
                {COMPETITORS.map((c) => (
                  <th key={c.name} className="text-center px-4 py-4">
                    <div
                      className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold ${
                        c.highlight
                          ? "bg-[#4B3FE4] text-white"
                          : "text-[#A0A0C0]/60"
                      }`}
                      style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
                    >
                      {c.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <tr
                  key={row}
                  className={`border-b border-white/5 transition-colors hover:bg-white/2 ${
                    ri % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-[#A0A0C0]" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
                    {row}
                  </td>
                  {COMPETITORS.map((c) => (
                    <td key={c.name} className="text-center px-4 py-4">
                      <Cell value={c.values[ri]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  )
}
