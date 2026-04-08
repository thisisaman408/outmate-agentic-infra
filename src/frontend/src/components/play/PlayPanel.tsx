import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import useFlowStore from "@/stores/flowStore";
import type { AgentNodeInfo } from "./hooks/useAgentDetection";
import { usePlayState } from "./hooks/usePlayState";
import InputSidebar from "./InputSidebar";
import ProgressView from "./ProgressView";
import DashboardView from "./DashboardView";
import ChatFollowUp from "./ChatFollowUp";

type ViewMode = "play" | "chat";

interface PlayPanelProps {
  agent: AgentNodeInfo;
  flowId: string;
  sessionId: string;
  sendMessage: (params: { inputValue: string; files?: string[] }) => Promise<void>;
  chatContent?: React.ReactNode;
  onClose?: () => void;
}

export default function PlayPanel({
  agent,
  flowId,
  sessionId,
  sendMessage,
  chatContent,
  onClose,
}: PlayPanelProps) {
  const { state, startRun, finishRun, reset, agentOutput } = usePlayState();
  const flowPool = useFlowStore((s) => s.flowPool);
  const nodes = useFlowStore((s) => s.nodes);
  const setNodes = useFlowStore((s) => s.setNodes);
  const [viewMode, setViewMode] = useState<ViewMode>("play");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const runStartTimeRef = useRef(0);
  // Track the flowPool length at the time of starting a run, so we only look at NEW entries
  const poolLengthAtStartRef = useRef(0);

  // Watch flowPool directly for the agent node's output.
  useEffect(() => {
    if (state !== "running") return;

    const agentPool = flowPool[agent.nodeId];
    if (!agentPool || agentPool.length === 0) return;

    // Only look at entries that appeared AFTER the run started
    if (agentPool.length <= poolLengthAtStartRef.current) return;

    const lastEntry = agentPool[agentPool.length - 1];
    // The output is at: data.outputs.response.message (can be a string or object with .text/.data.text)
    const outputs = lastEntry?.data?.outputs;
    if (!outputs) return;

    // Search all output keys for a message with text
    for (const [key, val] of Object.entries(outputs)) {
      const output = val as any;
      const msg = output?.message;
      // msg can be: a string directly, an object with .data.text, or an object with .text
      const text =
        (typeof msg === "string" ? msg : null) ??
        msg?.data?.text ??
        msg?.text ??
        output?.text ??
        "";

      // Threshold is intentionally low (>5 chars) so short follow-up answers
      // (e.g. "Parth Kapadia is the CEO of eQuest Solutions.") still register.
      // Anything above this is treated as a real response, not noise.
      if (typeof text === "string" && text.trim().length > 5) {
        console.log("[PlayPanel] FOUND OUTPUT in flowPool!", key, "length:", text.length);
        finishRun(text);
        return;
      }

      // Also try results array format
      if (output?.results) {
        for (const r of Object.values(output.results) as any[]) {
          const rMsg = (r as any)?.message;
          const rText =
            (typeof rMsg === "string" ? rMsg : null) ??
            rMsg?.data?.text ??
            rMsg?.text ??
            (r as any)?.text ??
            "";
          if (typeof rText === "string" && rText.trim().length > 5) {
            console.log("[PlayPanel] FOUND OUTPUT in results!", key, "length:", rText.length);
            finishRun(rText);
            return;
          }
        }
      }
    }
  }, [state, flowPool, agent.nodeId, finishRun]);

  const syncInputsToNode = useCallback(
    (inputValues: Record<string, any>) => {
      const updatedNodes = nodes.map((node) => {
        if (node.id !== agent.nodeId) return node;
        const newTemplate = { ...node.data.node.template };
        for (const [key, val] of Object.entries(inputValues)) {
          if (newTemplate[key]) {
            newTemplate[key] = { ...newTemplate[key], value: val };
          }
        }
        return {
          ...node,
          data: { ...node.data, node: { ...node.data.node, template: newTemplate } },
        };
      });
      setNodes(updatedNodes);
    },
    [nodes, agent.nodeId, setNodes],
  );

  const handleRun = useCallback(
    async (inputValues: Record<string, any>) => {
      syncInputsToNode(inputValues);
      runStartTimeRef.current = Date.now();
      // Record current pool length so we only detect NEW outputs after this run
      const latestPool = useFlowStore.getState().flowPool[agent.nodeId];
      poolLengthAtStartRef.current = latestPool?.length ?? 0;
      startRun();
      setViewMode("play");
      await new Promise((r) => setTimeout(r, 100));

      // Build a contextual input text based on available fields
      const keyword = inputValues.keyword || inputValues.company_name || inputValues.prospect_name || "";
      const inputText = keyword
        ? `Run the agent for: ${keyword}`
        : "Run the agent with the configured inputs";

      try {
        await sendMessage({ inputValue: inputText });
      } catch (err) {
        console.error("Agent run failed:", err);
        finishRun(`Error: ${err}`);
      }
    },
    [syncInputsToNode, startRun, sendMessage, finishRun, agent.nodeId],
  );

  // Chat follow-up: re-enter "running" state so the flowPool watcher picks
  // up the new agent output, then forward the raw user text as input_value.
  // The agent's deterministic pipeline detects this is a follow-up question
  // (because the text doesn't start with "Run the agent") and answers from
  // chat history rather than re-running the search.
  const handleChatFollowUp = useCallback(
    async ({ inputValue, files }: { inputValue: string; files?: string[] }) => {
      runStartTimeRef.current = Date.now();
      const latestPool = useFlowStore.getState().flowPool[agent.nodeId];
      poolLengthAtStartRef.current = latestPool?.length ?? 0;
      startRun();
      setViewMode("play");
      await new Promise((r) => setTimeout(r, 100));
      try {
        await sendMessage({ inputValue, files });
      } catch (err) {
        console.error("Follow-up failed:", err);
        finishRun(`Error: ${err}`);
      }
    },
    [startRun, sendMessage, finishRun, agent.nodeId],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border/40 px-4 py-2 shrink-0">
        <TabButton
          active={viewMode === "play"}
          icon={state === "running" ? "Loader" : state === "dashboard" ? "LayoutDashboard" : "Play"}
          label={state === "running" ? "Running..." : state === "dashboard" ? "Results" : "Play"}
          onClick={() => { setViewMode("play"); setIsFullscreen(false); }}
        />
        <TabButton
          active={viewMode === "chat"}
          icon="MessageSquare"
          label="Chat"
          onClick={() => { setViewMode("chat"); setIsFullscreen(false); }}
        />
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title="Close playground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={viewMode === "chat" ? "flex-1 overflow-hidden" : "hidden"}>
        {chatContent ?? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chat view</div>}
      </div>

      <div className={viewMode === "play" ? "flex flex-1 overflow-hidden" : "hidden"}>
        {!isFullscreen && (
          <div className="w-72 shrink-0 border-r border-border/40 overflow-y-auto custom-scroll bg-muted/5">
            <InputSidebar agent={agent} onRun={handleRun} isRunning={state === "running"} />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {state === "dashboard" && (
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all">
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}

          {state === "form" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center flex flex-col items-center gap-4 max-w-md px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ForwardedIconComponent name={agent.icon} className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{agent.displayName}</h3>
                  {agent.description ? (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{agent.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Fill in inputs and click Run Agent</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {state === "running" && (
            <div className="flex-1 overflow-y-auto custom-scroll">
              <ProgressView agent={agent} startTime={runStartTimeRef.current} />
            </div>
          )}

          {state === "dashboard" && (
            <>
              <div className="flex-1 overflow-y-auto custom-scroll">
                <DashboardView agent={agent} output={agentOutput} onRerun={reset} />
              </div>
              <div className="shrink-0 border-t border-border/40 p-3">
                <ChatFollowUp sendMessage={handleChatFollowUp} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
      <ForwardedIconComponent name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
