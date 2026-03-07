"use client"

import { motion } from "framer-motion"
import { Star } from "lucide-react"

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "VP of Sales",
    company: "TechFlow Inc",
    quote:
      "Outmate completely replaced 4 different tools for us. We went from spending 3 hours on prospecting to 15 minutes. The NLP prompt interface is genuinely magic — I described our ICP once and it built the entire campaign.",
    stars: 5,
    initials: "SC",
    color: "#4B3FE4",
  },
  {
    name: "Marcus Rivera",
    role: "Head of Revenue",
    company: "Nexus AI",
    quote:
      "The Signal Engine alone is worth it. We caught a competitor's customer churning before the renewal call — Outmate flagged 3 job changes on their buying committee and we were in their inbox within the hour. Closed the deal.",
    stars: 5,
    initials: "MR",
    color: "#CAFF00",
  },
  {
    name: "Priya Sharma",
    role: "GTM Lead",
    company: "Stackwise",
    quote:
      "I was skeptical about 'autonomous AI' promises. Then Outmate's AI Agent researched 50 target accounts overnight, wrote personalized outreach for each, and launched the sequences before my morning standup. Reply rate was 34%.",
    stars: 5,
    initials: "PS",
    color: "#7B5CFF",
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-[#0A0A1A] py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4B3FE4] mb-4">Customers</p>
          <h2
            className="text-4xl lg:text-5xl font-black text-white"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            Loved by revenue teams.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="p-8 rounded-2xl border border-white/5 bg-[#111127] flex flex-col gap-5"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array(t.stars).fill(0).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-[#CAFF00] text-[#CAFF00]" />
                ))}
              </div>

              {/* Quote */}
              <p
                className="text-sm text-[#A0A0C0] leading-relaxed flex-1 italic"
                style={{ fontFamily: "var(--font-inter, sans-serif)" }}
              >
                "{t.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}30` }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
                    {t.name}
                  </p>
                  <p className="text-xs text-[#A0A0C0]">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
