import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/controllers/API/api";
import { getURL } from "@/controllers/API/helpers/constants";
import { useGetFlowSchedule } from "@/controllers/API/queries/flows/use-flow-schedule";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import useAlertStore from "@/stores/alertStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import useFlowStore from "@/stores/flowStore";
import { usePlaygroundStore } from "@/stores/playgroundStore";
import ScheduleModal from "./scheduleModal";
import TabStrip, { type EditorTab } from "./tabStrip";
import TopBar from "./topBar";

const VALID_TABS: EditorTab[] = ["workflow", "outcome", "settings", "copilot"];

export const useEditorTab = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: EditorTab = (VALID_TABS.includes(raw as EditorTab)
    ? (raw as EditorTab)
    : "workflow") as EditorTab;

  const setTab = useCallback(
    (next: EditorTab) => {
      const newParams = new URLSearchParams(params);
      if (next === "workflow") {
        newParams.delete("tab");
      } else {
        newParams.set("tab", next);
      }
      setParams(newParams, { replace: true });
    },
    [params, setParams],
  );

  return { tab, setTab };
};

type WorkflowEditorChromeProps = {
  flowId: string;
  onSave: () => void;
};

const WorkflowEditorChrome = ({
  flowId,
  onSave,
}: WorkflowEditorChromeProps) => {
  const currentSavedFlow = useFlowsManagerStore((state) => state.currentFlow);
  const setCurrentSavedFlow = useFlowsManagerStore((state) => state.setCurrentFlow);
  const flows = useFlowsManagerStore((state) => state.flows);
  const setFlows = useFlowsManagerStore((state) => state.setFlows);
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const setStoreCurrentFlow = useFlowStore((state) => state.setCurrentFlow);
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const { mutate: patchFlow } = usePatchUpdateFlow();
  const { data: schedule } = useGetFlowSchedule(flowId);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const setPlaygroundOpen = usePlaygroundStore((s) => s.setIsOpen);
  const setPlaygroundFullscreen = usePlaygroundStore((s) => s.setIsFullscreen);
  const queryClient = useQueryClient();

  const { tab, setTab } = useEditorTab();

  const flow = currentSavedFlow ?? currentFlow;
  const flowName = flow?.name ?? "";
  const isActive = !!flow?.endpoint_name;

  const hasUnsavedChanges = useMemo(() => {
    if (!currentFlow || !currentSavedFlow) return false;
    try {
      return (
        JSON.stringify(currentFlow.data) !== JSON.stringify(currentSavedFlow.data)
      );
    } catch {
      return false;
    }
  }, [currentFlow, currentSavedFlow]);

  const onLaunchToggle = useCallback(() => {
    if (!flow) return;
    const slug = (flow.name || flowId)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || flowId.slice(0, 8);
    const next = isActive ? null : slug;
    patchFlow(
      { id: flowId, endpoint_name: next },
      {
        onSuccess: () => {
          // Sync local stores so the UI flips between Launch/Pause without
          // needing a refresh. Both stores hold copies of the flow.
          if (currentSavedFlow && currentSavedFlow.id === flowId) {
            setCurrentSavedFlow({
              ...currentSavedFlow,
              endpoint_name: next ?? null,
            } as any);
          }
          if (currentFlow && currentFlow.id === flowId) {
            setStoreCurrentFlow({
              ...currentFlow,
              endpoint_name: next ?? null,
            } as any);
          }
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, endpoint_name: next ?? null } : f,
              ),
            );
          }
          if (next) {
            // Activating: fire one immediate run so the user sees activity
            // in the Outcome tab. The endpoint creates vertex_builds records
            // that the Outcome tab polls via useGetBuildsQuery.
            setSuccessData({
              title: "Workflow launched — running first execution…",
            });
            api
              .post(getURL("RUN_SESSION", { flowIdOrName: slug }), {
                input_value: "",
                input_type: "chat",
                output_type: "chat",
                stream: false,
              })
              .then(() => {
                queryClient.invalidateQueries({
                  queryKey: ["useGetBuildsQuery"],
                });
                setSuccessData({
                  title: "First run completed — see Outcome tab",
                });
              })
              .catch((err: any) => {
                queryClient.invalidateQueries({
                  queryKey: ["useGetBuildsQuery"],
                });
                const detail =
                  err?.response?.data?.detail ?? err?.message ?? "run failed";
                setErrorData({
                  title: "Workflow active, but first run failed",
                  list: [String(detail)],
                });
              });
          } else {
            setSuccessData({ title: "Workflow paused — endpoint disabled" });
          }
        },
        onError: () => {
          setErrorData({ title: "Failed to toggle workflow" });
        },
      },
    );
  }, [
    flow,
    flowId,
    isActive,
    patchFlow,
    setSuccessData,
    setErrorData,
    currentSavedFlow,
    setCurrentSavedFlow,
    currentFlow,
    setStoreCurrentFlow,
    flows,
    setFlows,
    queryClient,
  ]);

  return (
    <div className="flex flex-col">
      <TopBar
        flowName={flowName}
        isActive={isActive}
        hasUnsavedChanges={hasUnsavedChanges}
        schedule={schedule ?? null}
        onSave={onSave}
        onLaunchToggle={onLaunchToggle}
        onOpenSchedule={() => setScheduleOpen(true)}
        onOpenPlayground={() => {
          setPlaygroundOpen(true);
          setPlaygroundFullscreen(false);
        }}
      />
      <TabStrip active={tab} onChange={setTab} />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        flowId={flowId}
        current={schedule ?? null}
      />
    </div>
  );
};

export default WorkflowEditorChrome;
