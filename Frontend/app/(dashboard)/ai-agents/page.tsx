"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AgenticSearchPanel } from "@/components/ai-agents/agentic-search-panel"
import { LookalikePanel } from "@/components/ai-agents/lookalike-panel"
import { ResearchPanel } from "@/components/ai-agents/research-panel"
import { PredictivePanel } from "@/components/ai-agents/predictive-panel"
import { Sparkles, Users, Search, TrendingUp, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

const AGENTS = [
  {
    id: "search",
    name: "Agentic Search",
    description: "Multi-step prospect identification",
    icon: Sparkles,
    component: AgenticSearchPanel,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    id: "lookalike",
    name: "Lookalike",
    description: "Mirror your best customers",
    icon: Users,
    component: LookalikePanel,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    id: "research",
    name: "Research",
    description: "Deep company intelligence",
    icon: Search,
    component: ResearchPanel,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    id: "predictive",
    name: "Predictive",
    description: "Lead conversion scoring",
    icon: TrendingUp,
    component: PredictivePanel,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
]

export default function AIAgentsPage() {
  const [activeTab, setActiveTab] = useState("search")

  const activeAgent = AGENTS.find((a) => a.id === activeTab) || AGENTS[0]

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Cpu className="h-6 w-6 text-primary animate-pulse-subtle" />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground/60">Autonomous Intelligence</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-gradient">AI Agents</h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Deploy specialized autonomous agents to automate your GTM workflow with surgical precision.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-white/5 glass-effect">
          <div className="px-4 py-2 border-r border-white/10">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/50">Active Agents</p>
            <p className="text-lg font-mono font-bold">04</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/50">Tasks Today</p>
            <p className="text-lg font-mono font-bold">128</p>
          </div>
        </div>
      </motion.div>

      {/* Agent Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon
          const isActive = activeTab === agent.id

          return (
            <motion.button
              key={agent.id}
              onClick={() => setActiveTab(agent.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative flex flex-col items-start p-5 rounded-3xl transition-all duration-500 text-left border overflow-hidden",
                isActive
                  ? "bg-muted/50 border-white/20 shadow-2xl glass-effect"
                  : "bg-transparent border-white/5 hover:border-white/10"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-primary/5 -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              <div className={cn("p-3 rounded-2xl mb-4 transition-colors duration-500", agent.bg)}>
                <Icon className={cn("h-6 w-6 transition-transform duration-500", isActive ? "scale-110" : "scale-100", agent.color)} />
              </div>

              <div className="space-y-1">
                <h3 className={cn("font-bold tracking-tight transition-colors duration-500", isActive ? "text-lg text-foreground" : "text-muted-foreground")}>
                  {agent.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                  {agent.description}
                </p>
              </div>

              {isActive && (
                <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Content Area with Animation */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-[3rem] -z-10" />
        <div className="p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent border border-white/5">
          <div className="rounded-[2.4rem] bg-background/60 dark:bg-card/40 backdrop-blur-3xl overflow-hidden p-8 min-h-[500px]">
            {activeAgent && <activeAgent.component />}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
