import { useMemo } from "react";
import useFlowStore from "@/stores/flowStore";

const GTM_AGENT_TYPES = new Set([
  "TeamFinderAgent",
  "ProspectResearchAgent",
  "ICPScoringAgent",
  "TAMDiscoveryAgent",
  "WaterfallEnrichmentAgent",
  "HyperPersonalisationAgent",
  "IntentSignalAgent",
  "LinkedInOutreachAgent",
  "ChampionTrackerAgent",
  "CRMAutoFillAgent",
  "MeetingPrepAgent",
  "OutboundCampaignAgent",
  "ReplyHandlerAgent",
  "VoiceOutreachAgent",
  "LeadDiscoveryOutreachAgent",
  "ICPBuilderAgent",
]);

export interface AgentNodeInfo {
  nodeId: string;
  agentType: string;
  displayName: string;
  description: string;
  icon: string;
  template: Record<string, any>;
}

export function useAgentDetection(): AgentNodeInfo | null {
  const nodes = useFlowStore((state) => state.nodes);

  return useMemo(() => {
    for (const node of nodes) {
      const type = node.data?.type;
      if (type && GTM_AGENT_TYPES.has(type)) {
        const nodeData = node.data?.node as any;
        return {
          nodeId: node.id,
          agentType: type,
          displayName: nodeData?.display_name ?? type,
          description: nodeData?.description ?? "",
          icon: nodeData?.icon ?? "Bot",
          template: nodeData?.template ?? {},
        };
      }
    }
    return null;
  }, [nodes]);
}
