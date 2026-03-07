"use client"

import { motion } from "framer-motion"
import { Building2, User } from "lucide-react"

const BUSINESS_FIELDS = [
  "Firmographics & headcount",
  "Full technology stack",
  "Org chart & hierarchy",
  "Funding data & investors",
  "Intent signals & job postings",
  "Revenue estimates",
  "News & trigger events",
]

const PROSPECT_FIELDS = [
  "Verified business emails (BetterContact)",
  "Direct phone numbers",
  "LinkedIn data (Crustdata / Airscale)",
  "Job history & seniority",
  "Social activity scoring",
  "Department & reporting line",
  "Persona fit scoring",
]

const PARTNERS = ["Explorium", "Crustdata", "Airscale", "BetterContact", "Unipile"]

export function Enrichment() {
  return (
    <section className="bg-[#0A0A1A] py-28 px-6">
      <div className="max-w-7xl mx-auto space-y-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">Enrichment</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            The Deepest B2B Enrichment Layer.
          </h2>
          <p className="text-[#A0A0C0] mt-4 max-w-xl mx-auto" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            100+ data fields per record, sourced from 50+ best-in-class providers,
            automatically attached to every prospect.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Business enrichment */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl bg-[#111127] border border-white/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#4B3FE4]/15 border border-[#4B3FE4]/25 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-[#4B3FE4]" />
              </div>
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
                For Businesses
              </h3>
            </div>
            <div className="space-y-3">
              {BUSINESS_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3 text-sm text-[#A0A0C0]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#4B3FE4] shrink-0" />
                  {field}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Prospect enrichment */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl bg-[#111127] border border-white/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#CAFF00]/10 border border-[#CAFF00]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#CAFF00]" />
              </div>
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
                For Prospects
              </h3>
            </div>
            <div className="space-y-3">
              {PROSPECT_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3 text-sm text-[#A0A0C0]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#CAFF00] shrink-0" />
                  {field}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Partner logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center space-y-4"
        >
          <p className="text-xs text-[#A0A0C0]/60 uppercase tracking-widest">Powered by</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {PARTNERS.map((p) => (
              <div key={p} className="text-sm font-bold text-[#A0A0C0]/40 tracking-widest uppercase">
                {p}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
