"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#testimonials" },
  { label: "Blog", href: "#" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-[#0A0A1A]/80 border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/image.png" alt="Outmate" className="h-8 w-8 rounded-lg object-cover" />
          <span
            className="text-white font-black text-lg tracking-tight uppercase"
            style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
          >
            outmate
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[#A0A0C0] hover:text-white transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#CAFF00] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-[#A0A0C0] hover:text-white transition-colors px-4 py-2 rounded-lg border border-white/10 hover:border-white/20"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-r from-[#4B3FE4] to-[#7B5CFF] hover:from-[#5B4FF4] hover:to-[#8B6FFF] transition-all shadow-lg shadow-[#4B3FE4]/20"
          >
            Get Started →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden backdrop-blur-xl bg-[#0A0A1A]/95 border-b border-white/5 px-6 pb-6"
          >
            <div className="flex flex-col gap-4 pt-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[#A0A0C0] hover:text-white transition-colors text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                <Link href="/auth/login" className="text-sm text-center text-[#A0A0C0] hover:text-white py-2 rounded-lg border border-white/10">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="text-sm font-semibold text-center text-white py-2 rounded-lg bg-gradient-to-r from-[#4B3FE4] to-[#7B5CFF]">
                  Get Started →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
