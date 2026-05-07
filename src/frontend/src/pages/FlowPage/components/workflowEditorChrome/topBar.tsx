import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { useDarkStore } from "@/stores/darkStore";
import useFlowStore from "@/stores/flowStore";
import { cn } from "@/utils/utils";
import type { FlowSchedule } from "@/controllers/API/queries/flows/use-flow-schedule";

type TopBarProps = {
  flowName: string;
  isActive: boolean;
  hasUnsavedChanges: boolean;
  schedule: FlowSchedule | null;
  onSave: () => void;
  onLaunchToggle: () => void;
  onOpenSchedule: () => void;
  onOpenPlayground: () => void;
};

const formatScheduleLabel = (schedule: FlowSchedule | null): string => {
  if (!schedule || schedule.schedule_type === "manual") return "Manual";
  if (schedule.schedule_type === "cron") {
    return `Cron · ${schedule.expression ?? ""}`.trim();
  }
  // interval
  const seconds = parseInt(schedule.expression ?? "0", 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Interval";
  if (seconds % 86400 === 0) return `Every ${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `Every ${seconds / 3600}h`;
  if (seconds % 60 === 0) return `Every ${seconds / 60}m`;
  return `Every ${seconds}s`;
};

const TopBar = ({
  flowName,
  isActive,
  hasUnsavedChanges,
  schedule,
  onSave,
  onLaunchToggle,
  onOpenSchedule,
  onOpenPlayground,
}: TopBarProps) => {
  const navigate = useCustomNavigate();
  const dark = useDarkStore((s) => s.dark);
  const setDark = useDarkStore((s) => s.setDark);
  const isBuilding = useFlowStore((s) => s.isBuilding);

  const statusBadgeClass = isActive
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <div className="flex h-14 items-center justify-between border-b border-border/40 bg-background px-4">
      {/* Left: breadcrumb + name + status */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate("/all")}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          data-testid="topbar-workflows-breadcrumb"
        >
          <ForwardedIconComponent name="LayoutGrid" className="h-3.5 w-3.5" />
          Workflows
        </button>
        <ForwardedIconComponent
          name="ChevronRight"
          className="h-3.5 w-3.5 text-muted-foreground/60"
        />
        <h1
          className="truncate text-sm font-semibold text-foreground max-w-[420px]"
          data-testid="topbar-flow-name"
        >
          {flowName || "Untitled workflow"}
        </h1>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            statusBadgeClass,
          )}
          data-testid="topbar-status-badge"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isActive ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
          {isActive ? "Active" : "Draft"}
        </span>
      </div>

      {/* Right: bell, more, theme, Share, Save, Launch */}
      <div className="flex items-center gap-1.5">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                className="text-muted-foreground hover:text-foreground"
                data-testid="topbar-notifications"
              >
                <ForwardedIconComponent name="Bell" className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                className="text-muted-foreground hover:text-foreground"
                data-testid="topbar-more"
              >
                <ForwardedIconComponent name="MoreHorizontal" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>More options</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setDark(!dark)}
                className="text-muted-foreground hover:text-foreground"
                data-testid="topbar-theme"
              >
                <ForwardedIconComponent
                  name={dark ? "Sun" : "Moon"}
                  className="h-4 w-4"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          variant="outline"
          size="sm"
          className="ml-2 gap-1.5"
          data-testid="topbar-share"
        >
          <ForwardedIconComponent name="Share2" className="h-4 w-4" />
          Share
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!hasUnsavedChanges || isBuilding}
          className="gap-1.5"
          data-testid="topbar-save"
        >
          <ForwardedIconComponent name="Save" className="h-4 w-4" />
          Save
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPlayground}
          className="gap-1.5"
          data-testid="topbar-run"
        >
          <ForwardedIconComponent name="Play" className="h-4 w-4" />
          Run
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSchedule}
          className="gap-1.5"
          data-testid="topbar-schedule"
        >
          <ForwardedIconComponent name="Clock" className="h-4 w-4" />
          {formatScheduleLabel(schedule)}
        </Button>

        <Button
          size="sm"
          onClick={onLaunchToggle}
          className={cn(
            "gap-1.5 font-semibold",
            isActive
              ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/20"
              : "bg-amber-500 text-amber-950 hover:bg-amber-400",
          )}
          data-testid="topbar-launch"
        >
          <ForwardedIconComponent
            name={isActive ? "Pause" : "Rocket"}
            className="h-4 w-4"
          />
          {isActive ? "Pause workflow" : "Launch workflow"}
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
