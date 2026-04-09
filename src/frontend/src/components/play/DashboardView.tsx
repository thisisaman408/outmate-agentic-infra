import { useCallback } from "react";
import { motion } from "framer-motion";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { AgentNodeInfo } from "./hooks/useAgentDetection";
import { getDashboard } from "./dashboards/registry";
import SmartResultRenderer from "@/components/core/chatComponents/SmartResultRenderer";

interface DashboardViewProps {
  agent: AgentNodeInfo;
  output: string;
  onRerun: () => void;
}

function downloadCsvFile(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DashboardView({
  agent,
  output,
  onRerun,
}: DashboardViewProps) {
  const DashboardComponent = getDashboard(agent.agentType);

  const handleDownloadCsv = useCallback(
    (csvContent: string) => {
      const safeName = agent.displayName.replace(/\s+/g, "_").toLowerCase();
      const date = new Date().toISOString().split("T")[0];
      downloadCsvFile(csvContent, `${safeName}_${date}.csv`);
    },
    [agent.displayName],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <ForwardedIconComponent
              name="CheckCircle"
              className="h-5 w-5 text-emerald-500"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Results Ready
            </h2>
            <p className="text-sm text-muted-foreground">
              {agent.displayName} completed successfully
            </p>
          </div>
        </div>
        <button
          onClick={onRerun}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          <ForwardedIconComponent name="RotateCcw" className="h-3.5 w-3.5" />
          Re-run
        </button>
      </div>

      {/* Agent-specific dashboard OR fallback */}
      {DashboardComponent ? (
        <DashboardComponent
          output={output}
          onDownloadCsv={handleDownloadCsv}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SmartResultRenderer
            text={output}
            fallback={
              <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {output}
              </div>
            }
          />
        </div>
      )}
    </motion.div>
  );
}
