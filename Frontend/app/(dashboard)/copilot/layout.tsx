import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Co-Pilot | Outmate",
  description: "AI-powered sales intelligence",
}

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-auto">{children}</div>
}
