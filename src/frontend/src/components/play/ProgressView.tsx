import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import useFlowStore from "@/stores/flowStore";
import type { AgentNodeInfo } from "./hooks/useAgentDetection";

/**
 * Time-based progress steps — shown sequentially as the agent runs.
 * These are generic enough to work for any GTM agent.
 */
const PROGRESS_STEPS = [
  { delay: 0, text: "Starting agent...", icon: "Zap" },
  { delay: 3000, text: "Researching company information...", icon: "Building2" },
  { delay: 8000, text: "Searching for employees...", icon: "Users" },
  { delay: 15000, text: "Finding email addresses...", icon: "Mail" },
  { delay: 25000, text: "Scanning LinkedIn profiles...", icon: "Linkedin" },
  { delay: 40000, text: "Enriching contact details...", icon: "UserPlus" },
  { delay: 60000, text: "Finding social profiles...", icon: "Share2" },
  { delay: 80000, text: "Verifying data...", icon: "CheckCircle" },
  { delay: 100000, text: "Compiling results...", icon: "FileText" },
  { delay: 120000, text: "Almost done...", icon: "Clock" },
];

export default function ProgressView({ agent, startTime }: { agent: AgentNodeInfo; startTime: number }) {
  const isBuilding = useFlowStore((s) => s.isBuilding);
  const [elapsed, setElapsed] = useState(() => Date.now() - (startTime || Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - (startTime || Date.now()));
    }, 500);
    return () => clearInterval(interval);
  }, [startTime]);

  // Which steps to show based on elapsed time
  const visibleSteps = PROGRESS_STEPS.filter((s) => elapsed >= s.delay);
  const currentStep = visibleSteps[visibleSteps.length - 1];

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        {/* Agent icon with pulse */}
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ForwardedIconComponent
              name={agent.icon}
              className="h-8 w-8 text-primary"
            />
          </div>
          {isBuilding && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-primary" />
            </span>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-lg font-semibold tracking-tight">
            {agent.displayName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isBuilding ? "Working on it..." : "Wrapping up..."}
          </p>
        </div>

        {/* Steps feed */}
        <div className="flex flex-col gap-2 w-full">
          {visibleSteps.map((step, i) => {
            const isDone = i < visibleSteps.length - 1;
            const isCurrent = i === visibleSteps.length - 1;

            return (
              <motion.div
                key={step.delay}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  isCurrent
                    ? "border border-primary/20 bg-primary/5"
                    : "border border-border/20 bg-muted/5"
                }`}
              >
                {isDone ? (
                  <ForwardedIconComponent
                    name="Check"
                    className="h-4 w-4 text-emerald-500 shrink-0"
                  />
                ) : (
                  <ForwardedIconComponent
                    name={step.icon}
                    className="h-4 w-4 text-primary shrink-0 animate-pulse"
                  />
                )}
                <span
                  className={`text-sm ${
                    isDone
                      ? "text-muted-foreground/60"
                      : "text-foreground/90"
                  }`}
                >
                  {step.text}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Elapsed time */}
        <p className="text-xs text-muted-foreground/40">
          {Math.floor(elapsed / 1000)}s elapsed
        </p>
      </div>
    </div>
  );
}
