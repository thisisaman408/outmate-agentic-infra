import type { ComponentType } from "react";

export interface AgentDashboardProps {
  output: string;
  onDownloadCsv?: (csvContent: string) => void;
}

const dashboardRegistry = new Map<string, ComponentType<AgentDashboardProps>>();

export function registerDashboard(
  agentType: string,
  component: ComponentType<AgentDashboardProps>,
) {
  dashboardRegistry.set(agentType, component);
}

export function getDashboard(
  agentType: string,
): ComponentType<AgentDashboardProps> | undefined {
  return dashboardRegistry.get(agentType);
}

// Auto-register known dashboards
import TeamFinderDashboard from "./TeamFinderDashboard";
import LeadDiscoveryDashboard from "./LeadDiscoveryDashboard";

registerDashboard("TeamFinderAgent", TeamFinderDashboard);
registerDashboard("LeadDiscoveryOutreachAgent", LeadDiscoveryDashboard);
