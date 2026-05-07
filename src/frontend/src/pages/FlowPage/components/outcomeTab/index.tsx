import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { useGetAgenticRunsQuery } from "@/controllers/API/queries/agentic-runs/use-get-agentic-runs";
import type {
  AgenticRun,
  AgenticRunRow,
} from "@/controllers/API/queries/agentic-runs/use-get-agentic-runs";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import useAlertStore from "@/stores/alertStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { WorkflowMetadata } from "@/types/flow";
import { cn } from "@/utils/utils";

type OutcomeTabProps = {
  flowId: string;
};

const formatTime = (iso: string) => {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleString();
};

const formatDuration = (ms: number) => {
  if (!ms || ms < 0) return "–";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
};

// Render a column value — booleans / numbers / objects all degrade gracefully.
const renderCell = (val: unknown): string => {
  if (val == null || val === "") return "–";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

const StatCell = ({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) => (
  <div className="flex flex-col gap-1.5 px-6 py-4">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
    </span>
    <span className="text-2xl font-semibold text-foreground" data-testid={testId}>
      {value}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Per-run row + expandable detail
// ---------------------------------------------------------------------------

const RunDetail = ({ row }: { row: AgenticRunRow }) => {
  const sectionEntries = Object.entries(row.sections ?? {}).filter(
    ([, v]) => v && v.trim(),
  );
  if (sectionEntries.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border/30 bg-background/40 px-4 py-3 text-xs">
      {sectionEntries.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {label}
          </span>
          <pre className="whitespace-pre-wrap text-foreground/90 font-sans">
            {value}
          </pre>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

const OutcomeTab = ({ flowId }: OutcomeTabProps) => {
  const flows = useFlowsManagerStore((s) => s.flows);
  const setFlows = useFlowsManagerStore((s) => s.setFlows);
  const setSuccessData = useAlertStore((s) => s.setSuccessData);
  const setErrorData = useAlertStore((s) => s.setErrorData);
  const { mutate: patchFlow } = usePatchUpdateFlow();

  const flow = useMemo(
    () => flows?.find((f) => f.id === flowId),
    [flows, flowId],
  );
  const meta: WorkflowMetadata = flow?.workflow_metadata ?? {};
  const target = meta.target_object ?? "People";
  const isActive = !!flow?.endpoint_name;

  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAgenticRunsQuery({ flowId });

  // Refresh on tab mount so data isn't stale.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["useGetAgenticRunsQuery"] });
  }, [flowId, queryClient]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["useGetAgenticRunsQuery"] });
    setSuccessData({ title: "Refreshed run history" });
  };

  const runs: AgenticRun[] = data?.data?.runs ?? [];
  const template = data?.data?.template ?? "Generic";

  const summary = useMemo(() => {
    const completed = runs.filter((r) => r.status === "completed").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    return { totalRuns: runs.length, completed, failed };
  }, [runs]);

  // Determine column set: union of all keys present in the latest 20 rows.
  // Each row's `columns` is `{label: value}` — we preserve order from the
  // first row that introduced each key.
  const columnLabels = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const r of runs.slice(0, 20)) {
      for (const row of r.rows) {
        for (const k of Object.keys(row.columns)) {
          if (!seen.has(k)) {
            seen.add(k);
            order.push(k);
          }
        }
      }
    }
    return order;
  }, [runs]);

  // Flatten runs → rows for table render. Each row carries its parent run's
  // status / timestamps so we can show them per-row when a single run produced
  // multiple rows (e.g. ICP scoring 5 leads).
  type FlatRow = {
    runId: string;
    rowIdx: number;
    status: AgenticRun["status"];
    finished_at: string;
    duration_ms: number;
    row: AgenticRunRow;
  };
  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = [];
    for (const r of runs.slice(0, 20)) {
      if (r.rows.length === 0 && r.output_text) {
        // Generic / no parser produced rows — synthesise one from the raw
        // output so the user still sees something.
        out.push({
          runId: r.run_id,
          rowIdx: 0,
          status: r.status,
          finished_at: r.finished_at,
          duration_ms: r.duration_ms,
          row: {
            title: "Run output",
            template: "Generic",
            columns: {
              "Output preview":
                r.output_text.length > 160
                  ? r.output_text.slice(0, 157) + "…"
                  : r.output_text,
            },
            sections: { "Full output": r.output_text },
          },
        });
        continue;
      }
      r.rows.forEach((row, idx) => {
        out.push({
          runId: r.run_id,
          rowIdx: idx,
          status: r.status,
          finished_at: r.finished_at,
          duration_ms: r.duration_ms,
          row,
        });
      });
    }
    return out;
  }, [runs]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onActivate = () => {
    if (!flow) return;
    const slug =
      (flow.name || flowId)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || flowId.slice(0, 8);
    patchFlow(
      { id: flowId, endpoint_name: slug },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, endpoint_name: slug } : f,
              ),
            );
          }
          setSuccessData({
            title: `Workflow activated — callable at /api/v1/run/${slug}`,
          });
        },
        onError: () => setErrorData({ title: "Failed to activate workflow" }),
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Top action row */}
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Template:</span>
          <span className="rounded-md border border-border/40 bg-muted/40 px-2 py-0.5">
            {template}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          className="gap-1.5"
          data-testid="outcome-refresh"
        >
          <ForwardedIconComponent name="RefreshCw" className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Inactive banner */}
      {!isActive && (
        <div className="flex items-center justify-between border-b border-border/40 bg-amber-500/5 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ForwardedIconComponent
              name="AlertCircle"
              className="h-4 w-4 text-amber-300"
            />
            This workflow is currently inactive. Activate it to start running on
            triggers — single Run-button executions still appear here once
            they finish.
          </div>
          <button
            onClick={onActivate}
            className="text-sm font-semibold text-amber-300 hover:text-amber-200"
            data-testid="outcome-activate-link"
          >
            Activate workflow
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-[260px_1fr]">
        {/* Left: counters */}
        <aside className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Record runs</h3>
              <span className="rounded-md border border-border/40 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                {summary.totalRuns}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing the latest 20 runs. Each run can produce one or more rows
            (e.g. ICP scoring grades multiple leads in a single run).
          </p>

          <div
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3",
              isActive
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isActive ? "text-emerald-300" : "text-amber-300",
                )}
              >
                {isActive ? "Live" : "Pre-qualified"}
              </span>
              <ForwardedIconComponent
                name="Info"
                className="h-3.5 w-3.5 text-muted-foreground"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {isActive
                ? "Next run: on next trigger"
                : "Next run: Activate to start running"}
            </span>
          </div>
        </aside>

        {/* Right: stats + structured table */}
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-2 divide-x divide-border/30 rounded-2xl border border-border/40 bg-card/50 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5 px-6 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Target
              </span>
              <span className="text-lg font-semibold">{target}</span>
            </div>
            <StatCell
              label="Runs"
              value={summary.totalRuns}
              testId="outcome-runs-count"
            />
            <StatCell
              label="Completed"
              value={summary.completed}
              testId="outcome-completed-count"
            />
            <StatCell
              label="Failed"
              value={summary.failed}
              testId="outcome-failed-count"
            />
            <StatCell label="Rows" value={flatRows.length} />
          </div>

          {/* Run rows */}
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              Loading runs…
            </div>
          ) : flatRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <ForwardedIconComponent
                name="Search"
                className="h-10 w-10 text-muted-foreground/50"
              />
              <p className="max-w-md text-sm text-muted-foreground">
                No runs yet. Click <span className="font-semibold">Run</span> in
                the top bar (or activate and trigger via webhook) — results
                appear here as a structured table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/50">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border/30 bg-background/40">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Title
                    </th>
                    {columnLabels.map((label) => (
                      <th
                        key={label}
                        className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
                      >
                        {label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Time
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((fr) => {
                    const key = `${fr.runId}-${fr.rowIdx}`;
                    const isOpen = expanded.has(key);
                    return (
                      <>
                        <tr
                          key={key}
                          className="cursor-pointer border-b border-border/20 last:border-0 hover:bg-muted/20"
                          onClick={() => toggleExpanded(key)}
                        >
                          <td className="px-2 py-2 text-muted-foreground">
                            <ForwardedIconComponent
                              name={isOpen ? "ChevronDown" : "ChevronRight"}
                              className="h-3.5 w-3.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                fr.status === "completed"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  fr.status === "completed"
                                    ? "bg-emerald-400"
                                    : "bg-rose-400",
                                )}
                              />
                              {fr.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">
                            {fr.row.title || "–"}
                          </td>
                          {columnLabels.map((label) => (
                            <td
                              key={label}
                              className="px-3 py-2 text-foreground/80"
                            >
                              {renderCell(fr.row.columns[label])}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatTime(fr.finished_at)}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatDuration(fr.duration_ms)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${key}-detail`} className="bg-background/30">
                            <td colSpan={columnLabels.length + 5} className="p-0">
                              <RunDetail row={fr.row} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default OutcomeTab;
