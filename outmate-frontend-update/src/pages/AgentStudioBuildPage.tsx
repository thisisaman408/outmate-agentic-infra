import { useState, useCallback } from "react";
import StudioTopbar from "@/components/studio/StudioTopbar";
import ModeBar from "@/components/studio/ModeBar";
import CoPilotPanel from "@/components/studio/CoPilotPanel";
import StudioCanvas from "@/components/studio/StudioCanvas";
import ToolsPanel from "@/components/studio/ToolsPanel";
import { INITIAL_NODES } from "@/components/studio/constants";

export default function AgentStudioBuildPage() {
  const [agentName, setAgentName] = useState("ICP Outbound Agent");
  const [published, setPublished] = useState(false);
  const [nodes, setNodes] = useState(INITIAL_NODES);

  const handleConfirmNode = useCallback((id: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, status: "configured" as const } : n));
  }, []);

  const showConfirmation = nodes.some(n => n.status === "building");

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0B0B0E", fontFamily: "'Inter', sans-serif" }}>
      <StudioTopbar agentName={agentName} onNameChange={setAgentName} published={published} onPublish={() => setPublished(true)} />
      <ModeBar />
      <div className="flex flex-1 overflow-hidden">
        <CoPilotPanel agentName={agentName} showConfirmation={showConfirmation} onConfirm={() => handleConfirmNode(3)} />
        <StudioCanvas nodes={nodes} onConfirmNode={handleConfirmNode} />
        <ToolsPanel />
      </div>
    </div>
  );
}
