import { useEffect, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FlowSchedule,
  type ScheduleType,
  useDeleteFlowSchedule,
  useUpsertFlowSchedule,
} from "@/controllers/API/queries/flows/use-flow-schedule";
import useAlertStore from "@/stores/alertStore";
import { cn } from "@/utils/utils";

type ScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  flowId: string;
  current: FlowSchedule | null;
  /** Called after a successful upsert/delete with the latest schedule (or null). */
  onSaved?: (schedule: FlowSchedule | null) => void;
};

const INTERVAL_PRESETS: Array<{ value: number; label: string }> = [
  { value: 5 * 60, label: "Every 5 minutes" },
  { value: 15 * 60, label: "Every 15 minutes" },
  { value: 30 * 60, label: "Every 30 minutes" },
  { value: 60 * 60, label: "Every hour" },
  { value: 6 * 60 * 60, label: "Every 6 hours" },
  { value: 12 * 60 * 60, label: "Every 12 hours" },
  { value: 24 * 60 * 60, label: "Daily" },
  { value: 7 * 24 * 60 * 60, label: "Weekly" },
];

const CRON_PRESETS: Array<{ value: string; label: string }> = [
  { value: "0 * * * *", label: "Top of every hour" },
  { value: "0 9 * * 1-5", label: "Weekdays at 9:00 AM" },
  { value: "0 9 * * 1", label: "Mondays at 9:00 AM" },
  { value: "0 0 1 * *", label: "1st of every month" },
];

const ScheduleModal = ({
  open,
  onClose,
  flowId,
  current,
  onSaved,
}: ScheduleModalProps) => {
  const setSuccessData = useAlertStore((s) => s.setSuccessData);
  const setErrorData = useAlertStore((s) => s.setErrorData);
  const upsert = useUpsertFlowSchedule(flowId);
  const remove = useDeleteFlowSchedule(flowId);

  const [type, setType] = useState<ScheduleType>(
    current?.schedule_type ?? "manual",
  );
  const [intervalSeconds, setIntervalSeconds] = useState<number>(() => {
    const n = current?.expression ? parseInt(current.expression, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 60 * 60;
  });
  const [cron, setCron] = useState<string>(current?.expression ?? "0 9 * * 1-5");

  useEffect(() => {
    if (!open) return;
    setType(current?.schedule_type ?? "manual");
    if (current?.schedule_type === "interval" && current.expression) {
      const n = parseInt(current.expression, 10);
      if (Number.isFinite(n) && n > 0) setIntervalSeconds(n);
    }
    if (current?.schedule_type === "cron" && current.expression) {
      setCron(current.expression);
    }
  }, [open, current]);

  const onSave = async () => {
    try {
      const payload =
        type === "interval"
          ? {
              schedule_type: "interval" as const,
              expression: String(intervalSeconds),
              enabled: true,
            }
          : type === "cron"
            ? {
                schedule_type: "cron" as const,
                expression: cron.trim(),
                enabled: true,
              }
            : {
                schedule_type: "manual" as const,
                expression: null,
                enabled: true,
              };
      const saved = await upsert.mutateAsync(payload);
      setSuccessData({
        title:
          type === "manual"
            ? "Schedule cleared — workflow will run on external trigger only"
            : "Schedule saved",
      });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setErrorData({ title: "Failed to save schedule" });
    }
  };

  const onClear = async () => {
    try {
      await remove.mutateAsync();
      setSuccessData({ title: "Schedule removed" });
      onSaved?.(null);
      onClose();
    } catch (e) {
      setErrorData({ title: "Failed to remove schedule" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule workflow</DialogTitle>
          <DialogDescription>
            Choose how often this workflow runs automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Type picker */}
          <div className="grid grid-cols-3 gap-2">
            {(["manual", "interval", "cron"] as ScheduleType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                  type === t
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground",
                )}
                data-testid={`schedule-type-${t}`}
              >
                <ForwardedIconComponent
                  name={t === "manual" ? "Hand" : t === "interval" ? "RefreshCw" : "Clock"}
                  className="h-4 w-4"
                />
                {t === "manual" ? "Manual" : t === "interval" ? "Interval" : "Cron"}
              </button>
            ))}
          </div>

          {type === "interval" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Frequency
              </label>
              <Select
                value={String(intervalSeconds)}
                onValueChange={(v) => setIntervalSeconds(parseInt(v, 10))}
              >
                <SelectTrigger className="bg-muted/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "cron" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Cron expression
                </label>
                <Input
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="bg-muted/40 font-mono text-sm"
                  data-testid="schedule-cron-input"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setCron(p.value)}
                    className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "manual" && (
            <p className="text-xs text-muted-foreground">
              Workflow runs only when triggered externally — via webhook,
              API call, or manual run.
            </p>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          {current && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={remove.isPending}
              className="text-rose-300 hover:text-rose-200"
              data-testid="schedule-remove"
            >
              Remove schedule
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={upsert.isPending}
              className="gap-1.5 bg-amber-500 font-semibold text-amber-950 hover:bg-amber-400"
              data-testid="schedule-save"
            >
              Save schedule
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleModal;
