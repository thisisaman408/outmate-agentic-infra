import { motion } from "framer-motion";
import { Play } from "lucide-react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { AgentNodeInfo } from "./hooks/useAgentDetection";

/** Extract a short summary from node template values — e.g. "Bigstep Technologies" */
function getTargetSummary(template: Record<string, any>): string {
  // Look for the most meaningful filled-in value
  const priorityKeys = [
    "company_name",
    "prospect_name",
    "company_domain",
    "target_company",
    "linkedin_url",
    "company_linkedin_url",
    "input_value",
  ];
  for (const key of priorityKeys) {
    const val = template[key]?.value;
    if (val && typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return "";
}

interface RunFormProps {
  agent: AgentNodeInfo;
  onRun: () => void;
  isDisabled?: boolean;
}

export default function RunForm({ agent, onRun, isDisabled }: RunFormProps) {
  const target = getTargetSummary(agent.template);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 max-w-sm text-center"
      >
        {/* Agent icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ForwardedIconComponent
            name={agent.icon}
            className="h-8 w-8 text-primary"
          />
        </div>

        {/* Agent name */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">
            {agent.displayName}
          </h2>
          {target && (
            <p className="text-sm text-muted-foreground">
              Target: <span className="font-medium text-foreground/80">{target}</span>
            </p>
          )}
          {!target && (
            <p className="text-sm text-muted-foreground">
              Configure inputs on the node, then run
            </p>
          )}
        </div>

        {/* Run Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onRun}
          disabled={isDisabled}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-primary px-10 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="h-4 w-4" />
          Run Agent
        </motion.button>
      </motion.div>
    </div>
  );
}
