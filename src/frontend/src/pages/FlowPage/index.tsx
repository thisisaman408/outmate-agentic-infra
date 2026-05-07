import { useEffect, useState } from "react";
import { useBlocker, useParams, useSearchParams } from "react-router-dom";
import { FlowPageSlidingContainerContent } from "@/components/core/playgroundComponent/sliding-container/components/flow-page-sliding-container";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  SimpleSidebar,
  SimpleSidebarProvider,
} from "@/components/ui/simple-sidebar";
import { useGetFlow } from "@/controllers/API/queries/flows/use-get-flow";
import { useGetTypes } from "@/controllers/API/queries/flows/use-get-types";
import { ENABLE_NEW_SIDEBAR } from "@/customization/feature-flags";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useApplyFlowToCanvas from "@/hooks/flows/use-apply-flow-to-canvas";
import useSaveFlow from "@/hooks/flows/use-save-flow";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWebhookEvents } from "@/hooks/use-webhook-events";
import { SaveChangesModal } from "@/modals/saveChangesModal";
import useAlertStore from "@/stores/alertStore";
import { usePlaygroundStore } from "@/stores/playgroundStore";
import { useTypesStore } from "@/stores/typesStore";
import { customStringify } from "@/utils/reactflowUtils";
import { cn } from "@/utils/utils";
import useFlowStore from "../../stores/flowStore";
import useFlowsManagerStore from "../../stores/flowsManagerStore";
import {
  FlowSearchProvider,
  FlowSidebarComponent,
} from "./components/flowSidebarComponent";
import Page from "./components/PageComponent";
import { FlowInsightsContent } from "./components/TraceComponent/FlowInsightsContent";
import CopilotTab from "./components/copilotTab";
import OutcomeTab from "./components/outcomeTab";
import PipelineCanvas from "./components/pipelineCanvas";
import SettingsTab from "./components/settingsTab";
import WorkflowEditorChrome, {
  useEditorTab,
} from "./components/workflowEditorChrome";

function FlowPageSidebarGate({
  isLoading,
  view,
}: {
  isLoading: boolean;
  view?: boolean;
}): JSX.Element | null {
  const { tab } = useEditorTab();
  const isAdvanced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("advanced") === "1";
  if (view) return null;
  // On the new pipeline canvas, the legacy FlowSidebar is hidden — the
  // PipelineCanvas renders its own BuildSidebar. Show the legacy one only
  // when the user explicitly requests advanced mode.
  if (tab !== "workflow") return null;
  if (!isAdvanced) return null;
  return <FlowSidebarComponent isLoading={isLoading} />;
}

function FlowPageMainContent({
  flowId,
  setIsLoading,
}: {
  flowId?: string;
  setIsLoading: (isLoading: boolean) => void;
}): JSX.Element {
  const { activeSection } = useSidebar();
  const showTraces = ENABLE_NEW_SIDEBAR && activeSection === "traces";
  const { tab } = useEditorTab();

  // Non-Workflow tabs render their own page bodies (no canvas).
  if (tab === "outcome") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <OutcomeTab flowId={flowId ?? ""} />
      </div>
    );
  }
  if (tab === "settings") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <SettingsTab flowId={flowId ?? ""} />
      </div>
    );
  }
  if (tab === "copilot") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <CopilotTab />
      </div>
    );
  }

  if (showTraces) {
    return (
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        data-testid="flow-insights-embedded"
      >
        <FlowInsightsContent
          flowId={flowId}
          refreshOnMount
          showFlowActivityHeader
        />
      </div>
    );
  }

  // Workflow tab: pipeline canvas by default, legacy free-form editor with ?advanced=1.
  const isAdvanced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("advanced") === "1";
  if (isAdvanced) {
    return <Page setIsLoading={setIsLoading} />;
  }
  return <PipelineCanvas flowId={flowId ?? ""} />;
}

export default function FlowPage({ view }: { view?: boolean }): JSX.Element {
  const types = useTypesStore((state) => state.types);
  const [searchParams] = useSearchParams();
  const isAdvancedMode = searchParams.get("advanced") === "1";

  useGetTypes({
    enabled: Object.keys(types).length <= 0,
  });

  const setCurrentFlow = useFlowsManagerStore((state) => state.setCurrentFlow);
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const currentSavedFlow = useFlowsManagerStore((state) => state.currentFlow);
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const [isLoading, setIsLoading] = useState(false);

  const changesNotSaved =
    customStringify(currentFlow) !== customStringify(currentSavedFlow) &&
    (currentFlow?.data?.nodes?.length ?? 0) > 0;

  const isBuilding = useFlowStore((state) => state.isBuilding);
  const blocker = useBlocker(changesNotSaved || isBuilding);

  const setOnFlowPage = useFlowStore((state) => state.setOnFlowPage);
  const { id } = useParams();
  const navigate = useCustomNavigate();
  const saveFlow = useSaveFlow();

  const flows = useFlowsManagerStore((state) => state.flows);
  const currentFlowId = useFlowsManagerStore((state) => state.currentFlowId);

  const updatedAt = currentSavedFlow?.updated_at;
  const autoSaving = useFlowsManagerStore((state) => state.autoSaving);
  const stopBuilding = useFlowStore((state) => state.stopBuilding);

  const { mutateAsync: getFlow } = useGetFlow();
  const applyFlowToCanvas = useApplyFlowToCanvas();

  // Connect to webhook events SSE for real-time feedback
  useWebhookEvents();

  const handleSave = () => {
    let saving = true;
    let proceed = false;
    setTimeout(() => {
      saving = false;
      if (proceed) {
        blocker.proceed && blocker.proceed();
        setSuccessData({
          title: "Flow saved successfully!",
        });
      }
    }, 1200);
    saveFlow().then(() => {
      if (!autoSaving || saving === false) {
        blocker.proceed && blocker.proceed();
        setSuccessData({
          title: "Flow saved successfully!",
        });
      }
      proceed = true;
    });
  };

  const handleExit = () => {
    if (isBuilding) {
      // Do nothing, let the blocker handle it
    } else if (changesNotSaved) {
      if (blocker.proceed) blocker.proceed();
    } else {
      navigate("/all");
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (changesNotSaved || isBuilding) {
        event.preventDefault();
        event.returnValue = ""; // Required for Chrome
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [changesNotSaved, isBuilding]);

  // Set flow tab id
  useEffect(() => {
    const awaitgetTypes = async () => {
      if (flows && currentFlowId === "" && Object.keys(types).length > 0) {
        const isAnExistingFlow = flows.find((flow) => flow.id === id);

        if (!isAnExistingFlow) {
          navigate("/all");
          return;
        }

        const isAnExistingFlowId = isAnExistingFlow.id;

        await getFlowToAddToCanvas(isAnExistingFlowId);
      }
    };
    awaitgetTypes();
  }, [id, flows, currentFlowId, types]);

  useEffect(() => {
    setOnFlowPage(true);

    return () => {
      setOnFlowPage(false);
      setCurrentFlow(undefined);
      // Reset playground state when leaving the flow
      setSlidingContainerOpen(false);
      setIsFullscreen(false);
    };
  }, [id]);

  useEffect(() => {
    if (
      blocker.state === "blocked" &&
      autoSaving &&
      changesNotSaved &&
      !isBuilding
    ) {
      handleSave();
    }
  }, [blocker.state, isBuilding]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      // If the workflow is launched (`endpoint_name` set), the user has
      // explicitly asked it to run autonomously — leaving the flow editor
      // page should NOT abort an in-flight run. We just let navigation
      // proceed; the build keeps running on the backend.
      const isWorkflowLaunched = !!currentSavedFlow?.endpoint_name;

      if (isBuilding && !isWorkflowLaunched) {
        // Draft / unlaunched flow: kill the run so it doesn't keep
        // consuming credits in the background. (Original Langflow safety
        // behavior.)
        stopBuilding();
      } else if (!changesNotSaved) {
        blocker.proceed && blocker.proceed();
      } else if (isBuilding && isWorkflowLaunched) {
        // Run survives the navigation — just let the user leave.
        blocker.proceed && blocker.proceed();
      }
    }
  }, [blocker.state, isBuilding, currentSavedFlow?.endpoint_name]);

  const getFlowToAddToCanvas = async (id: string) => {
    const flow = await getFlow({ id });
    applyFlowToCanvas(flow);
  };

  const isMobile = useIsMobile();
  const isSlidingContainerOpen = usePlaygroundStore((state) => state.isOpen);
  const setSlidingContainerOpen = usePlaygroundStore(
    (state) => state.setIsOpen,
  );
  const isFullscreen = usePlaygroundStore((state) => state.isFullscreen);
  const setIsFullscreen = usePlaygroundStore((state) => state.setIsFullscreen);
  const inputs = useFlowStore((state) => state.inputs);
  const outputs = useFlowStore((state) => state.outputs);

  // Auto-close playground when all chat components are removed
  useEffect(() => {
    const hasChatInput = inputs.some((input) => input.type === "ChatInput");
    const hasChatOutput = outputs.some(
      (output) => output.type === "ChatOutput",
    );

    if (isSlidingContainerOpen && !hasChatInput && !hasChatOutput) {
      setSlidingContainerOpen(false);
      setIsFullscreen(false);
    }
  }, [
    inputs,
    outputs,
    isSlidingContainerOpen,
    setSlidingContainerOpen,
    setIsFullscreen,
  ]);

  return (
    <>
      {/* TODO: will be revert - original main layout without playground panel */}
      {/*
      <div className="flow-page-positioning">
        {currentFlow && (
          <div className="flex h-full overflow-hidden">
            <SidebarProvider
              width="17.5rem"
              defaultOpen={!isMobile}
              segmentedSidebar={ENABLE_NEW_SIDEBAR}
            >
              <FlowSearchProvider>
                {!view && <FlowSidebarComponent isLoading={isLoading} />}
                <main className="flex w-full overflow-hidden">
                  <div className="h-full w/full">
                    <Page setIsLoading={setIsLoading} />
                  </div>
                </main>
              </FlowSearchProvider>
            </SidebarProvider>
          </div>
        )}
      </div>
      */}

      <SimpleSidebarProvider
        width="326px"
        minWidth={0.15}
        maxWidth={0.6}
        open={isSlidingContainerOpen}
        onOpenChange={(open) => {
          const wasOpen = isSlidingContainerOpen;
          setSlidingContainerOpen(open);
          if (open && !wasOpen) {
            setIsFullscreen(true);
          }
        }}
        fullscreen={isFullscreen}
        onMaxWidth={() => {
          setIsFullscreen(true);
          setSlidingContainerOpen(true);
        }}
      >
        <div className="flow-page-positioning">
          {currentFlow && (
            <div className="flex h-full flex-col overflow-hidden">
              <WorkflowEditorChrome flowId={id ?? ""} onSave={handleSave} />
              <div className="flex flex-1 overflow-hidden">
                <SidebarProvider
                  width="17.5rem"
                  defaultOpen={!isMobile}
                  segmentedSidebar={ENABLE_NEW_SIDEBAR}
                >
                  <FlowSearchProvider>
                    <main
                      className={cn(
                        "flex flex-1 min-w-0 overflow-hidden transition-all duration-300",
                        isSlidingContainerOpen &&
                          !isFullscreen &&
                          "rounded-xl m-2 mr-0",
                      )}
                    >
                      <div className="h-full w-full">
                        <FlowPageMainContent
                          flowId={id}
                          setIsLoading={setIsLoading}
                        />
                      </div>
                    </main>
                  </FlowSearchProvider>
                </SidebarProvider>
                <SimpleSidebar resizable={!isFullscreen} className="h-full">
                  <FlowPageSlidingContainerContent
                    isFullscreen={isFullscreen}
                    setIsFullscreen={setIsFullscreen}
                  />
                </SimpleSidebar>
              </div>
            </div>
          )}
        </div>
      </SimpleSidebarProvider>
      {blocker.state === "blocked" && (
        <>
          {!isBuilding && currentSavedFlow && (
            <SaveChangesModal
              onSave={handleSave}
              onCancel={() => blocker.reset?.()}
              onProceed={handleExit}
              flowName={currentSavedFlow.name}
              lastSaved={
                updatedAt
                  ? new Date(updatedAt).toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "numeric",
                      second: "numeric",
                      month: "numeric",
                      day: "numeric",
                    })
                  : undefined
              }
              autoSave={autoSaving}
            />
          )}
        </>
      )}
    </>
  );
}
