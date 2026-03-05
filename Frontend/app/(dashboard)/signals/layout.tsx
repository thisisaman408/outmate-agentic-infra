"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { name: "Overview", href: "/signals" },
  { name: "Events", href: "/signals/events" },
  { name: "Intents", href: "/signals/intent" },
  { name: "Trackers", href: "/signals/tracker" },
  { name: "Websights", href: "/signals/websights" },
  { name: "Form Complete", href: "/signals/formcomplete" },
]

export default function SignalsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const normalized = pathname.replace(/\/$/, "")
          const target = item.href.replace(/\/$/, "")
          const isActive = normalized === target
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-1 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted/90"
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div>{children}</div>
    </div>
  )
}
