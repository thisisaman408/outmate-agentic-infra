import { useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useDeleteFlow from "@/hooks/flows/use-delete-flow";
import DeleteConfirmationModal from "@/modals/deleteConfirmationModal";
import ExportModal from "@/modals/exportModal";
import FlowSettingsModal from "@/modals/flowSettingsModal";
import useAlertStore from "@/stores/alertStore";
import useAuthStore from "@/stores/authStore";
import { useFolderStore } from "@/stores/foldersStore";
import type { FlowType } from "@/types/flow";
import { downloadFlow } from "@/utils/reactflowUtils";
import { cn } from "@/utils/utils";
import useDescriptionModal from "../../hooks/use-description-modal";
import DropdownComponent from "../dropdown";
import {
  formatRelativeTime,
  getActionPills,
  getFlowStatus,
  getFlowTrigger,
  ownerInitials,
  pillClass,
} from "./utils";

type WorkflowRowProps = {
  flow: FlowType;
};

const WorkflowsTableRow = ({ flow }: WorkflowRowProps) => {
  const navigate = useCustomNavigate();
  const { folderId } = useParams();
  const setSuccessData = useAlertStore((s) => s.setSuccessData);
  const setErrorData = useAlertStore((s) => s.setErrorData);
  const userData = useAuthStore((s) => s.userData);
  const folders = useFolderStore((s) => s.folders);
  const { deleteFlow } = useDeleteFlow();
  const { mutate: patchFlow } = usePatchUpdateFlow();

  const [openDelete, setOpenDelete] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(
    null,
  );

  const status = getFlowStatus(flow);
  const trigger = getFlowTrigger(flow);
  const actions = getActionPills(flow);
  const folderName = folders.find((f) => f.id === flow.folder_id)?.name ?? "–";
  const ownerName = (userData as any)?.username ?? "GS";
  const initials = ownerInitials(ownerName);

  const isActive =
    optimisticActive !== null ? optimisticActive : status === "active";

  const editFlowLink = `/flow/${flow.id}${folderId ? `/folder/${folderId}` : ""}`;

  const descriptionModal = useDescriptionModal(
    [flow.id],
    flow.is_component ? "component" : "flow",
  );

  const onToggle = (checked: boolean) => {
    setOptimisticActive(checked);
    const slug = flow.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || flow.id.slice(0, 8);
    patchFlow(
      {
        id: flow.id,
        endpoint_name: checked ? slug : null,
      },
      {
        onError: () => {
          setOptimisticActive(null);
          setErrorData({ title: "Failed to toggle workflow" });
        },
        onSuccess: () => {
          setSuccessData({
            title: checked
              ? `Workflow activated — callable at /api/v1/run/${slug}`
              : "Workflow paused — endpoint disabled",
          });
        },
      },
    );
  };

  const onRowClick = () => navigate(editFlowLink);

  const onDelete = () => {
    deleteFlow({ id: [flow.id] })
      .then(() => setSuccessData({ title: "Workflow deleted" }))
      .catch(() =>
        setErrorData({ title: "Error deleting workflow", list: ["Try again"] }),
      );
  };

  const onExport = () => {
    if (flow.is_component) {
      downloadFlow(flow, flow.name, flow.description);
      setSuccessData({ title: `${flow.name} exported successfully` });
    } else {
      setOpenExportModal(true);
    }
  };

  const statusDot = {
    active: "bg-emerald-400",
    draft: "bg-amber-400",
    paused: "bg-rose-400",
  }[status];

  const statusLabel = {
    active: "Active",
    draft: "Draft",
    paused: "Paused",
  }[status];

  const triggerPill =
    trigger === "event"
      ? { label: "Event-triggered", tone: "violet" as const, icon: "Zap" }
      : trigger === "time"
        ? { label: "Time-triggered", tone: "green" as const, icon: "Clock" }
        : { label: "Manual", tone: "muted" as const, icon: "Hand" };

  return (
    <>
      <TableRow
        onClick={onRowClick}
        className="group cursor-pointer border-border/40 transition-colors hover:bg-muted/40"
        data-testid={`workflow-row-${flow.id}`}
      >
        {/* Toggle */}
        <TableCell className="w-14 py-3" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch
                    checked={isActive}
                    onCheckedChange={onToggle}
                    data-testid={`toggle-${flow.id}`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px] text-xs">
                {isActive
                  ? "Workflow is live — callable via webhook, API, or scheduled trigger. Toggle off to pause."
                  : "Click to activate. Publishes the workflow as a callable endpoint so it runs on webhook / API / schedule."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        {/* Name + description */}
        <TableCell className="min-w-[200px] max-w-[260px] py-3">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {flow.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {flow.description || "No description"}
            </span>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="py-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
            {statusLabel}
          </span>
        </TableCell>

        {/* Actions */}
        <TableCell className="py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.length === 0 ? (
              <span className="text-xs text-muted-foreground">–</span>
            ) : (
              actions.slice(0, 2).map((a) => (
                <span
                  key={a.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                    pillClass(a.tone),
                  )}
                >
                  <ForwardedIconComponent name={a.icon} className="h-3 w-3" />
                  {a.label}
                </span>
              ))
            )}
          </div>
        </TableCell>

        {/* Target */}
        <TableCell className="py-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">–</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Set target on flow (coming soon)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        {/* Trigger */}
        <TableCell className="py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
              pillClass(triggerPill.tone),
            )}
          >
            <ForwardedIconComponent
              name={triggerPill.icon}
              className="h-3 w-3"
            />
            {triggerPill.label}
          </span>
        </TableCell>

        {/* In Progress / Completed / Failed */}
        <TableCell className="py-3 text-xs text-muted-foreground">–</TableCell>
        <TableCell className="py-3 text-xs text-muted-foreground">–</TableCell>
        <TableCell className="py-3 text-xs text-muted-foreground">–</TableCell>

        {/* Owner */}
        <TableCell className="py-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
            title={ownerName}
          >
            {initials}
          </div>
        </TableCell>

        {/* Folder */}
        <TableCell className="py-3 text-xs text-muted-foreground">
          {folderName === "–" ? "–" : folderName}
        </TableCell>

        {/* Last run */}
        <TableCell className="py-3 text-xs text-muted-foreground">
          {formatRelativeTime(flow.updated_at)}
        </TableCell>

        {/* Next run */}
        <TableCell className="py-3 text-xs text-muted-foreground">
          {trigger === "event" ? "(Upon event)" : "–"}
        </TableCell>

        {/* Row menu */}
        <TableCell
          className="w-12 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                className="opacity-0 group-hover:opacity-100"
                data-testid={`row-menu-${flow.id}`}
              >
                <ForwardedIconComponent
                  name="Ellipsis"
                  className="h-4 w-4"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[185px]"
              sideOffset={5}
              side="bottom"
            >
              <DropdownComponent
                flowData={flow}
                setOpenDelete={setOpenDelete}
                handleExport={onExport}
                handleEdit={() => setOpenSettings(true)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {openDelete && (
        <DeleteConfirmationModal
          open={openDelete}
          setOpen={setOpenDelete}
          onConfirm={onDelete}
          description={descriptionModal}
          note={!flow.is_component ? "and its message history" : ""}
        />
      )}
      <ExportModal
        open={openExportModal}
        setOpen={setOpenExportModal}
        flowData={flow}
      />
      <FlowSettingsModal
        open={openSettings}
        setOpen={setOpenSettings}
        flowData={flow}
      />
    </>
  );
};

export default WorkflowsTableRow;
