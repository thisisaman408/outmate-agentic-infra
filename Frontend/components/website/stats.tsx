"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"

const STATS = [
  { value: 10, suffix: "x", label: "Pipeline Growth" },
  { value: 4000, suffix: "+", label: "Signals Tracked" },
  { value: 50, suffix: "+", label: "Enrichment Sources" },
  { value: 3, suffix: "x", label: "Reply Rate Improvement" },
]

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1800
    const step = (target / duration) * 16
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target])

  return (
    <div ref={ref} className="text-5xl lg:text-6xl font-black text-white" style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      {count.toLocaleString()}{suffix}
    </div>
  )
}

export function Stats() {
  return (
    <section className="bg-[#0A0A1A] py-20 px-6 border-y border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center space-y-2"
            >
              <Counter target={stat.value} suffix={stat.suffix} />
              <p className="text-[#A0A0C0] text-sm font-medium" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
