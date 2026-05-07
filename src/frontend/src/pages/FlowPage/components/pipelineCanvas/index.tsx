import { useEffect, useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import useAlertStore from "@/stores/alertStore";
import useFlowStore from "@/stores/flowStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import { usePlaygroundStore } from "@/stores/playgroundStore";
import { cn } from "@/utils/utils";
import {
  computePipelineLayout,
  getToolAttachments,
  sanitizeEdges,
  type PipelineBranch,
  type PipelineStep,
} from "./layout";
import { inferKind } from "./nodeKind";
import {
  BranchPill,
  PipelineNodeCard,
  SectionLabel,
  VerticalConnector,
} from "./nodes";
import BuildSidebar from "./sidebar";
import NodeInspector from "./inspector";
import { CATALOG_BY_ID, type CatalogEntry } from "./catalog";
import { composeLangflowNode } from "./composer";
import {
  canMoveNodeDown,
  canMoveNodeUp,
  deleteNode,
  moveNodeDown,
  moveNodeUp,
} from "./reorder";

type PipelineCanvasProps = {
  flowId: string;
};

type RenderStepsProps = {
  steps: PipelineStep[];
  detail: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canMoveUp: (nodeId: string) => boolean;
  canMoveDown: (nodeId: string) => boolean;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onDisconnect: (nodeId: string) => void;
  getAttachedTools: (nodeId: string) => { id: string; name: string }[];
  onDetachTool: (toolId: string, agentId: string) => void;
  wiringFromId: string | null;
  onWireTo: (targetId: string, label?: "true" | "false") => void;
};

const RenderSteps = ({
  steps,
  detail,
  selectedId,
  onSelect,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDisconnect,
  getAttachedTools,
  onDetachTool,
  wiringFromId,
  onWireTo,
}: RenderStepsProps) => (
  <div className="flex flex-col items-center gap-0">
    {steps.map((step, i) => {
      if (step.kind === "node") {
        const wiringMode = !!wiringFromId && wiringFromId !== step.node.id;
        return (
          <div key={step.node.id} className="flex flex-col items-center">
            <PipelineNodeCard
              node={step.node}
              detail={detail}
              selected={selectedId === step.node.id}
              onClick={() => onSelect(step.node.id)}
              canMoveUp={canMoveUp(step.node.id)}
              canMoveDown={canMoveDown(step.node.id)}
              onMoveUp={() => onMoveUp(step.node.id)}
              onMoveDown={() => onMoveDown(step.node.id)}
              onDelete={() => onDelete(step.node.id)}
              onDisconnect={() => onDisconnect(step.node.id)}
              attachedTools={getAttachedTools(step.node.id)}
              onDetachTool={(tid) => onDetachTool(tid, step.node.id)}
              wiringMode={wiringMode}
              isWiringSource={wiringFromId === step.node.id}
              onWireTarget={(label) => onWireTo(step.node.id, label)}
            />
            {i < steps.length - 1 && <VerticalConnector />}
          </div>
        );
      }
      // split
      return (
        <div key={`split-${step.sourceNodeId}-${i}`} className="flex flex-col items-center w-full">
          <div
            className={cn(
              "grid w-full gap-12 px-8",
              step.branches.length === 2 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {step.branches.map((b: PipelineBranch) => (
              <div
                key={b.id}
                className="flex flex-col items-center gap-3 border-t border-border/30 pt-6"
              >
                <BranchPill label={b.label} tone={b.tone} />
                {b.steps.length > 0 && (
                  <RenderSteps
                    steps={b.steps}
                    detail={detail}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDelete={onDelete}
                    onDisconnect={onDisconnect}
                    getAttachedTools={getAttachedTools}
                    onDetachTool={onDetachTool}
                    wiringFromId={wiringFromId}
                    onWireTo={onWireTo}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const PipelineCanvas = ({ flowId }: PipelineCanvasProps) => {
  const currentFlow = useFlowStore((s) => s.currentFlow);
  const setCurrentFlow = useFlowStore((s) => s.setCurrentFlow);
  const flows = useFlowsManagerStore((s) => s.flows);
  const setFlows = useFlowsManagerStore((s) => s.setFlows);
  const setSuccessData = useAlertStore((s) => s.setSuccessData);
  const setErrorData = useAlertStore((s) => s.setErrorData);
  const { mutate: patchFlow } = usePatchUpdateFlow();

  // The playground / Run panel docks on the right side, the same edge as the
  // node inspector. Keep them mutually exclusive so the user never sees the
  // inspector text leaking out behind the Run panel.
  const isPlaygroundOpen = usePlaygroundStore((s) => s.isOpen);
  const setPlaygroundOpen = usePlaygroundStore((s) => s.setIsOpen);

  const [zoom, setZoom] = useState(100);
  const [detail, setDetail] = useState(true);
  const [selectedNodeId, setSelectedNodeIdRaw] = useState<string | null>(null);
  const [wiringFromId, setWiringFromId] = useState<string | null>(null);

  // Opening a node inspector → close any open playground panel.
  const setSelectedNodeId = (id: string | null) => {
    if (id) setPlaygroundOpen(false);
    setSelectedNodeIdRaw(id);
  };
  // Opening the playground panel → close the inspector.
  useEffect(() => {
    if (isPlaygroundOpen) setSelectedNodeIdRaw(null);
  }, [isPlaygroundOpen]);

  // Esc cancels an active wiring session.
  useEffect(() => {
    if (!wiringFromId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWiringFromId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wiringFromId]);

  const layout = useMemo(
    () =>
      computePipelineLayout(
        currentFlow?.data?.nodes as any,
        currentFlow?.data?.edges as any,
      ),
    [currentFlow?.data?.nodes, currentFlow?.data?.edges],
  );

  const isActive = !!currentFlow?.endpoint_name;

  const onActivate = () => {
    if (!currentFlow) return;
    const slug = (currentFlow.name || flowId)
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

  const handleAddNode = (entry: CatalogEntry) => {
    if (!currentFlow) return;
    const langflowNode = composeLangflowNode(entry);
    const existingNodes = (currentFlow.data?.nodes ?? []) as any[];
    const existingEdges = (currentFlow.data?.edges ?? []) as any[];

    // Append edge from last leaf node to new node, when one exists.
    const lastLeafId = (() => {
      if (!layout.ok || layout.steps.length === 0) return null;
      // Walk steps to find last node that isn't followed by a split
      let last: string | null = null;
      const walk = (steps: PipelineStep[]) => {
        for (const s of steps) {
          if (s.kind === "node") last = s.node.id;
          else for (const b of s.branches) walk(b.steps);
        }
      };
      walk(layout.steps);
      return last;
    })();

    const nextNodes = [...existingNodes, langflowNode];
    const nextEdges = lastLeafId
      ? [
          ...existingEdges,
          {
            id: `${lastLeafId}-${langflowNode.id}`,
            source: lastLeafId,
            target: langflowNode.id,
          },
        ]
      : existingEdges;

    const nextFlow = {
      ...currentFlow,
      data: {
        ...(currentFlow.data ?? { viewport: { x: 0, y: 0, zoom: 1 } }),
        nodes: nextNodes,
        edges: nextEdges,
      },
    } as any;

    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({ title: `Added "${entry.name}"` });
        },
        onError: () => {
          setErrorData({ title: "Failed to add node" });
          setCurrentFlow(currentFlow); // revert
        },
      },
    );
  };

  const reorderGraph = useMemo(
    () => ({
      nodes: (currentFlow?.data?.nodes ?? []) as any[],
      edges: (currentFlow?.data?.edges ?? []) as any[],
    }),
    [currentFlow?.data?.nodes, currentFlow?.data?.edges],
  );

  // Auto-clean: if the persisted flow has malformed edges (legacy bad
  // tool-attachment edges with plain-string handles that crash JSON.parse),
  // strip them silently and PATCH the flow once.
  useEffect(() => {
    if (!currentFlow) return;
    const { edges, cleaned } = sanitizeEdges(
      (currentFlow.data?.edges ?? []) as any[],
    );
    if (!cleaned) return;
    const nextFlow = {
      ...currentFlow,
      data: { ...(currentFlow.data ?? {}), edges },
    } as any;
    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFlow?.id]);

  // agentNodeId -> attached tool nodes (for the per-card pills).
  // Reads from each agent's data.node.metadata.toolNodeIds.
  const toolAttachments = useMemo(
    () => getToolAttachments(reorderGraph.nodes),
    [reorderGraph.nodes],
  );
  const attachedToolsForNode = (nodeId: string) => {
    const toolIds = toolAttachments.get(nodeId) ?? [];
    return toolIds
      .map((tid) => {
        const t = reorderGraph.nodes.find((n: any) => n.id === tid);
        if (!t) return null;
        const name =
          t?.data?.node?.display_name ?? t?.data?.type ?? "Tool";
        return { id: tid, name: String(name) };
      })
      .filter(Boolean) as { id: string; name: string }[];
  };

  const _setAgentToolIds = (agentId: string, mutate: (ids: string[]) => string[]) => {
    if (!currentFlow) return;
    const allNodes = ((currentFlow.data?.nodes ?? []) as any[]).map((n: any) => {
      if (n.id !== agentId) return n;
      const meta = n?.data?.node?.metadata ?? {};
      const current = Array.isArray(meta.toolNodeIds) ? meta.toolNodeIds : [];
      return {
        ...n,
        data: {
          ...n.data,
          node: {
            ...(n.data?.node ?? {}),
            metadata: { ...meta, toolNodeIds: mutate(current) },
          },
        },
      };
    });
    const nextFlow = {
      ...currentFlow,
      data: { ...(currentFlow.data ?? {}), nodes: allNodes },
    } as any;
    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
        },
        onError: () => {
          setErrorData({ title: "Failed to update tools" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  const handleAttachTool = (toolId: string, agentId: string) => {
    _setAgentToolIds(agentId, (ids) =>
      ids.includes(toolId) ? ids : [...ids, toolId],
    );
    setSuccessData({ title: "Connected as tool" });
  };

  const handleDetachTool = (toolId: string, agentId: string) => {
    _setAgentToolIds(agentId, (ids) => ids.filter((x) => x !== toolId));
    setSuccessData({ title: "Tool detached" });
  };

  // Click-to-connect target: called when the user, while in wiring mode,
  // clicks a chain node (or a branch's TRUE/FALSE chip).
  const handleWireTo = (
    targetId: string,
    label?: "true" | "false",
  ) => {
    if (!wiringFromId) return;
    handleConnectAfter(wiringFromId, targetId, label);
    setWiringFromId(null);
  };

  // Disconnect a chain node: strip every edge that touches it. The node
  // stays in the flow's node list and falls back to the "Disconnected"
  // section, where the Connect-to-flow button lets the user rewire it.
  const handleDisconnectNode = (nodeId: string) => {
    if (!currentFlow) return;
    const existingNodes = (currentFlow.data?.nodes ?? []) as any[];
    const existingEdges = (currentFlow.data?.edges ?? []) as any[];
    const remainingEdges = existingEdges.filter(
      (e: any) => e.source !== nodeId && e.target !== nodeId,
    );
    if (remainingEdges.length === existingEdges.length) {
      setSuccessData({ title: "Already disconnected" });
      return;
    }
    const nextFlow = {
      ...currentFlow,
      data: {
        ...(currentFlow.data ?? {}),
        nodes: existingNodes,
        edges: remainingEdges,
      },
    } as any;
    setCurrentFlow(nextFlow);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (wiringFromId === nodeId) setWiringFromId(null);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({ title: "Disconnected — wire it back from below" });
        },
        onError: () => {
          setErrorData({ title: "Failed to disconnect" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  // Wire an orphan node into the chain after `predecessorId`. If `branchLabel`
  // is set, the label is stored on `edge.data.branchLabel` (a free-form field
  // Langflow's loader doesn't introspect) so it survives a flow reload
  // without breaking cleanEdges. Without a label it's a plain linear edge.
  const handleConnectAfter = (
    orphanId: string,
    predecessorId: string,
    branchLabel?: "true" | "false",
  ) => {
    if (!currentFlow) return;
    const existingNodes = (currentFlow.data?.nodes ?? []) as any[];
    const existingEdges = (currentFlow.data?.edges ?? []) as any[];
    const edgeId = branchLabel
      ? `${predecessorId}-${branchLabel}-${orphanId}`
      : `${predecessorId}-${orphanId}`;
    const newEdge: any = {
      id: edgeId,
      source: predecessorId,
      target: orphanId,
    };
    if (branchLabel) {
      newEdge.data = { branchLabel };
    }
    // Drop any prior edge from this predecessor to this orphan to avoid dupes.
    const filtered = existingEdges.filter(
      (e: any) => !(e.source === predecessorId && e.target === orphanId),
    );
    const nextFlow = {
      ...currentFlow,
      data: {
        ...(currentFlow.data ?? {}),
        nodes: existingNodes,
        edges: [...filtered, newEdge],
      },
    } as any;
    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({
            title: branchLabel
              ? `Connected to ${branchLabel.toUpperCase()} branch`
              : "Connected to flow",
          });
        },
        onError: () => {
          setErrorData({ title: "Failed to connect node" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  const handleReorder = (nodeId: string, direction: "up" | "down") => {
    if (!currentFlow) return;
    const nextEdges =
      direction === "up"
        ? moveNodeUp(reorderGraph, nodeId)
        : moveNodeDown(reorderGraph, nodeId);
    if (!nextEdges) return;
    const nextFlow = {
      ...currentFlow,
      data: {
        ...(currentFlow.data ?? {}),
        nodes: reorderGraph.nodes,
        edges: nextEdges,
      },
    } as any;
    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({ title: `Step moved ${direction}` });
        },
        onError: () => {
          setErrorData({ title: "Failed to reorder" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  const canReorderUp = (nodeId: string) =>
    canMoveNodeUp(reorderGraph, nodeId);
  const canReorderDown = (nodeId: string) =>
    canMoveNodeDown(reorderGraph, nodeId);

  const handleDeleteNode = (nodeId: string) => {
    if (!currentFlow) return;
    const result = deleteNode(reorderGraph, nodeId);
    if (!result) return;
    const nextFlow = {
      ...currentFlow,
      data: {
        ...(currentFlow.data ?? {}),
        nodes: result.nodes,
        edges: result.edges,
      },
    } as any;
    setCurrentFlow(nextFlow);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          // Sync the saved snapshot in flowsManagerStore so applyFlowToCanvas
          // doesn't reapply the deleted node on refresh / navigation.
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({ title: "Step deleted" });
        },
        onError: () => {
          setErrorData({ title: "Failed to delete step" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  const handleUpdateNode = (
    nodeId: string,
    patch: { name?: string; description?: string; metadata?: Record<string, any> },
  ) => {
    if (!currentFlow) return;
    // Merge the in-memory flowStore node (where the inspector's updateField
    // writes parameter edits like api_key / load_from_db / model selection)
    // with the server-side currentFlow node (where the topbar Save bookkeeping
    // lives). Without this merge, every parameter edit gets dropped on save
    // because handleUpdateNode used to overwrite from the stale currentFlow.
    const liveNodes = useFlowStore.getState().nodes;
    const liveById = new Map<string, any>(liveNodes.map((n: any) => [n.id, n]));
    const existingNodes = (currentFlow.data?.nodes ?? []) as any[];
    const nextNodes = existingNodes.map((n: any) => {
      const live = liveById.get(n.id);
      // Start from the live in-memory node when available so parameter
      // edits survive; fall back to the server-side node otherwise.
      const base = live ?? n;
      if (n.id !== nodeId) return base;
      return {
        ...base,
        data: {
          ...base.data,
          node: {
            ...(base.data?.node ?? {}),
            display_name: patch.name ?? base.data?.node?.display_name,
            description: patch.description ?? base.data?.node?.description,
            ...(patch.metadata
              ? { metadata: { ...(base.data?.node?.metadata ?? {}), ...patch.metadata } }
              : {}),
          },
        },
      };
    });
    const nextFlow = {
      ...currentFlow,
      data: { ...(currentFlow.data ?? {}), nodes: nextNodes },
    } as any;
    setCurrentFlow(nextFlow);
    patchFlow(
      { id: flowId, data: nextFlow.data },
      {
        onSuccess: () => {
          if (flows) {
            setFlows(
              flows.map((f) =>
                f.id === flowId ? { ...f, data: nextFlow.data } : f,
              ),
            );
          }
          setSuccessData({ title: "Node updated" });
        },
        onError: () => {
          setErrorData({ title: "Failed to update node" });
          setCurrentFlow(currentFlow);
        },
      },
    );
  };

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const all = (currentFlow?.data?.nodes ?? []) as any[];
    return all.find((n: any) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, currentFlow?.data?.nodes]);

  // Catalog metadata used for the inspector — try to find an entry
  const selectedCatalogEntry = useMemo<CatalogEntry | null>(() => {
    if (!selectedNode) return null;
    const id = (selectedNode as any)?.data?.metadata?.catalogId;
    return id ? CATALOG_BY_ID.get(id) ?? null : null;
  }, [selectedNode]);

  // Display name of the node currently being wired (for the banner).
  const wiringFromName = useMemo(() => {
    if (!wiringFromId) return "";
    const all = (currentFlow?.data?.nodes ?? []) as any[];
    const n = all.find((x: any) => x.id === wiringFromId);
    return String(
      n?.data?.node?.display_name ?? n?.data?.type ?? "step",
    );
  }, [wiringFromId, currentFlow?.data?.nodes]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <BuildSidebar onAdd={handleAddNode} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {wiringFromId && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-6 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <ForwardedIconComponent
                name="Link2"
                className="h-3.5 w-3.5 text-amber-300"
              />
              <span>
                Click any step above to insert{" "}
                <span className="font-semibold text-amber-100">
                  {wiringFromName}
                </span>{" "}
                after it. Branches show TRUE / FALSE — pick the slot.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWiringFromId(null)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/25"
              data-testid="cancel-wiring"
            >
              <ForwardedIconComponent name="X" className="h-3 w-3" />
              Cancel (Esc)
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:20px_20px]">
          <div
            className="flex flex-col items-center gap-4 px-8 py-10 transition-transform"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          >
            {/* Activate banner */}
            {!isActive && (
              <div className="flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/5 px-5 py-2 text-sm">
                <ForwardedIconComponent
                  name="AlertTriangle"
                  className="h-4 w-4 text-amber-300"
                />
                <span className="text-muted-foreground">
                  Draft mode — activate to start enrolling
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onActivate}
                  className="text-amber-300 hover:text-amber-200"
                  data-testid="canvas-activate"
                >
                  Activate <ForwardedIconComponent name="ArrowRight" className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* WHEN THIS HAPPENS */}
            <SectionLabel text="When this happens" tone="trigger" />
            <VerticalConnector />

            {!layout.ok ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center max-w-md">
                <ForwardedIconComponent name="AlertCircle" className="h-6 w-6 text-rose-300" />
                <p className="text-sm text-muted-foreground">{layout.reason}</p>
              </div>
            ) : layout.steps.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-8 text-center">
                <ForwardedIconComponent name="Plus" className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No steps yet. Add a trigger from the Build sidebar.
                </p>
              </div>
            ) : (
              <>
                {/* First step (root) */}
                {(() => {
                  const first = layout.steps[0];
                  if (!first || first.kind !== "node") return null;
                  const wiringMode =
                    !!wiringFromId && wiringFromId !== first.node.id;
                  return (
                    <PipelineNodeCard
                      node={first.node}
                      detail={detail}
                      selected={selectedNodeId === first.node.id}
                      onClick={() => setSelectedNodeId(first.node.id)}
                      canMoveUp={canReorderUp(first.node.id)}
                      canMoveDown={canReorderDown(first.node.id)}
                      onMoveUp={() => handleReorder(first.node.id, "up")}
                      onMoveDown={() => handleReorder(first.node.id, "down")}
                      onDelete={() => handleDeleteNode(first.node.id)}
                      onDisconnect={() => handleDisconnectNode(first.node.id)}
                      attachedTools={attachedToolsForNode(first.node.id)}
                      onDetachTool={(tid) =>
                        handleDetachTool(tid, first.node.id)
                      }
                      wiringMode={wiringMode}
                      isWiringSource={wiringFromId === first.node.id}
                      onWireTarget={(label) =>
                        handleWireTo(first.node.id, label)
                      }
                    />
                  );
                })()}

                {/* Then do this label appears after the first node if there are more */}
                {layout.steps.length > 1 && (
                  <>
                    <VerticalConnector />
                    <SectionLabel text="Then do this" />
                    <VerticalConnector />
                    <RenderSteps
                      steps={layout.steps.slice(1)}
                      detail={detail}
                      selectedId={selectedNodeId}
                      onSelect={setSelectedNodeId}
                      canMoveUp={canReorderUp}
                      canMoveDown={canReorderDown}
                      onMoveUp={(id) => handleReorder(id, "up")}
                      onMoveDown={(id) => handleReorder(id, "down")}
                      onDelete={handleDeleteNode}
                      onDisconnect={handleDisconnectNode}
                      getAttachedTools={attachedToolsForNode}
                      onDetachTool={handleDetachTool}
                      wiringFromId={wiringFromId}
                      onWireTo={handleWireTo}
                    />
                  </>
                )}

                {layout.unreachableNodeIds.length > 0 && (
                  <>
                    <VerticalConnector />
                    <div className="my-4 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                      <ForwardedIconComponent
                        name="AlertCircle"
                        className="h-3.5 w-3.5"
                      />
                      Disconnected ({layout.unreachableNodeIds.length})
                    </div>
                    {(() => {
                      const allNodes = (currentFlow?.data?.nodes ?? []) as any[];
                      // Reachable chain nodes (excluding exit-kind, since
                      // nothing can follow an exit in a linear flow). Used
                      // only to decide whether the "Connect" button should
                      // appear on an orphan card.
                      const chainTargets = allNodes.filter((n: any) => {
                        if (layout.unreachableNodeIds.includes(n.id)) return false;
                        const k = inferKind(n);
                        return k !== "exit";
                      });
                      return layout.unreachableNodeIds.map((id) => {
                        const raw = allNodes.find((n: any) => n.id === id);
                        if (!raw) return null;
                        // Detect tool-type nodes — utility helpers an agent
                        // pulls in (search, fetch, webhook, …). An agent that
                        // happens to set `tool_mode: true` so it CAN be reused
                        // as a tool by another agent is NOT itself a tool when
                        // it's the lead step in this flow, so we exclude
                        // anything whose name is "agent"-shaped.
                        const dn = String(
                          raw?.data?.node?.display_name ??
                            raw?.data?.type ??
                            "",
                        ).toLowerCase();
                        const dt = String(raw?.data?.type ?? "").toLowerCase();
                        const isAgent = /agent/.test(dn) || /agent/.test(dt);
                        const isTool =
                          !isAgent &&
                          (/tool|search|api|fetch|webhook/.test(dn) ||
                            raw?.data?.node?.tool_mode === true);
                        // Find candidate agent nodes to attach this tool to.
                        const agentNodes = allNodes.filter((n: any) => {
                          const t = String(
                            n?.data?.type ?? n?.data?.node?.display_name ?? "",
                          ).toLowerCase();
                          return /agent/.test(t);
                        });
                        const onConnectAsTool = (agentId: string) =>
                          handleAttachTool(id, agentId);
                        const isWiringSource = wiringFromId === id;
                        return (
                          <div
                            key={id}
                            className="flex flex-col items-center gap-2"
                          >
                            <PipelineNodeCard
                              node={{ id, raw } as any}
                              detail={detail}
                              selected={selectedNodeId === id}
                              onClick={() => setSelectedNodeId(id)}
                              canMoveUp={false}
                              canMoveDown={false}
                              onDelete={() => handleDeleteNode(id)}
                              isWiringSource={isWiringSource}
                              onCancelWiring={() => setWiringFromId(null)}
                            />
                            {isTool && agentNodes.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  Connect as tool to:
                                </span>
                                {agentNodes.map((agent: any) => (
                                  <button
                                    key={agent.id}
                                    onClick={() => onConnectAsTool(agent.id)}
                                    className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/15"
                                    data-testid={`connect-tool-${id}-to-${agent.id}`}
                                  >
                                    {agent?.data?.node?.display_name ??
                                      agent?.data?.type ??
                                      "Agent"}
                                  </button>
                                ))}
                              </div>
                            )}
                            {!isTool && chainTargets.length > 0 && !isWiringSource && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWiringFromId(id);
                                }}
                                disabled={!!wiringFromId && !isWiringSource}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20",
                                  !!wiringFromId &&
                                    !isWiringSource &&
                                    "opacity-40 cursor-not-allowed hover:bg-amber-500/10",
                                )}
                                data-testid={`connect-${id}`}
                                title="Click, then click any step in the flow above to insert this after it"
                              >
                                <ForwardedIconComponent
                                  name="Link2"
                                  className="h-3.5 w-3.5"
                                />
                                Connect to flow
                              </button>
                            )}
                            <div className="my-2" />
                          </div>
                        );
                      });
                    })()}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Disconnected nodes aren't in the execution chain. Click
                      <span className="mx-1 font-semibold text-amber-300">
                        Connect to flow
                      </span>
                      then click any step above to insert it there. Tools wire
                      into an agent via the Connect-as-tool button.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Outline / Detail toggle (bottom-left) */}
        <div className="flex items-center justify-between border-t border-border/30 bg-background px-4 py-2">
          <div className="inline-flex rounded-md border border-border/40 bg-card/40 p-0.5 text-xs">
            <button
              onClick={() => setDetail(false)}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                !detail ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              Outline
            </button>
            <button
              onClick={() => setDetail(true)}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                detail ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              Detail
            </button>
          </div>

          {/* Zoom controls */}
          <div className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
              className="px-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[40px] text-center font-medium">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="px-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Zoom in"
            >
              +
            </button>
            <span className="mx-1 h-3 w-px bg-border/50" />
            <button
              onClick={() => setZoom(100)}
              className="px-1.5 text-muted-foreground hover:text-foreground"
            >
              Fit
            </button>
            <button
              onClick={() => setZoom(100)}
              className="px-1.5 text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {selectedNode && !isPlaygroundOpen && (
        <NodeInspector
          node={selectedNode as any}
          catalogEntry={selectedCatalogEntry}
          onClose={() => setSelectedNodeId(null)}
          onSave={(patch) =>
            handleUpdateNode((selectedNode as any).id, patch)
          }
        />
      )}
    </div>
  );
};

export default PipelineCanvas;
