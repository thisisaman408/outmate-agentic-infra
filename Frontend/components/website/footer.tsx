"use client"

import Link from "next/link"
import { Twitter, Linkedin, Github } from "lucide-react"

const LINKS = {
  Product: [
    { label: "Signal Engine", href: "#" },
    { label: "Enrichment", href: "#" },
    { label: "AI Campaigns", href: "#" },
    { label: "Copilot", href: "#" },
    { label: "Workflows", href: "#" },
    { label: "AI Agents", href: "#" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Case Studies", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Partners", href: "#" },
    { label: "Security", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
    { label: "GDPR", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#111127] border-t border-white/5 px-6 py-16">
      <div className="max-w-7xl mx-auto">
        {/* Top: logo + links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo block */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#4B3FE4] flex items-center justify-center">
                <span className="text-white font-black text-sm">O</span>
              </div>
              <span
                className="text-white font-black text-lg tracking-tight"
                style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
              >
                outmate
              </span>
            </Link>
            <p className="text-xs text-[#A0A0C0] leading-relaxed max-w-[200px]" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
              Your entire GTM motion, one prompt away.
            </p>
            {/* Social */}
            <div className="flex gap-3">
              {[
                { Icon: Twitter, href: "#" },
                { Icon: Linkedin, href: "#" },
                { Icon: Github, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-[#A0A0C0] hover:text-white hover:border-white/20 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section} className="space-y-4">
              <h4
                className="text-xs font-black text-white uppercase tracking-widest"
                style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}
              >
                {section}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-xs text-[#A0A0C0] hover:text-white transition-colors"
                      style={{ fontFamily: "var(--font-inter, sans-serif)" }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-xs text-[#A0A0C0]/50" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
            © {new Date().getFullYear()} Outmate AI, Inc. All rights reserved.
          </p>
          {/* Compliance badges */}
          <div className="flex items-center gap-3">
            {["SOC2", "GDPR", "CCPA"].map((badge) => (
              <div
                key={badge}
                className="px-2.5 py-1 rounded border border-white/10 text-[10px] font-bold text-[#A0A0C0]/50 uppercase tracking-widest"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
