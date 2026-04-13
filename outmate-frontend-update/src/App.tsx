import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import HomePage from "@/pages/HomePage";
import StubPage from "@/components/StubPage";
import UnifiedCopilotPage from "@/pages/UnifiedCopilotPage";
import CompaniesPage from "@/pages/CompaniesPage";
import PeoplePage from "@/pages/PeoplePage";
import SignalsPage from "@/pages/SignalsPage";
import EnrichmentPage from "@/pages/EnrichmentPage";
import MarketplacePage from "@/pages/MarketplacePage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import SettingsPage from "@/pages/SettingsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import VisitorIdentificationPage from "@/pages/VisitorIdentificationPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import WorkflowBuilderPage from "@/pages/WorkflowBuilderPage";
import AgentStudioBuildPage from "@/pages/AgentStudioBuildPage";
import SocialAgentPage from "@/pages/SocialAgentPage";
import VoiceAgentPage from "@/pages/VoiceAgentPage";
import WorkflowsPage from "@/pages/WorkflowsPage";
import WorkflowCanvasPage from "@/pages/WorkflowCanvasPage";
import ListsPage from "@/pages/ListsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/home" element={<DashboardLayout><HomePage /></DashboardLayout>} />
          
          {/* Website Visitors */}
          <Route path="/visitor-id" element={<DashboardLayout><VisitorIdentificationPage /></DashboardLayout>} />
          <Route path="/visitor-id/companies" element={<DashboardLayout><VisitorIdentificationPage /></DashboardLayout>} />
          <Route path="/visitor-id/people" element={<DashboardLayout><VisitorIdentificationPage /></DashboardLayout>} />
          <Route path="/visitor-id/segments" element={<DashboardLayout><StubPage title="ICP Segments" description="Define and manage your ideal customer profiles" /></DashboardLayout>} />
          <Route path="/visitor-id/alerts" element={<DashboardLayout><StubPage title="Alerts & Rules" description="Configure real-time visitor alerts and automation rules" /></DashboardLayout>} />
          
          {/* Copilot */}
          <Route path="/copilot" element={<DashboardLayout><UnifiedCopilotPage /></DashboardLayout>} />
          <Route path="/chat" element={<Navigate to="/copilot" replace />} />
          
          {/* Database */}
          <Route path="/database/companies" element={<DashboardLayout><CompaniesPage /></DashboardLayout>} />
          <Route path="/database/people" element={<DashboardLayout><PeoplePage /></DashboardLayout>} />
          <Route path="/database/lists" element={<DashboardLayout><ListsPage /></DashboardLayout>} />
          <Route path="/database/signals" element={<DashboardLayout><SignalsPage /></DashboardLayout>} />
          <Route path="/database/enrichment" element={<DashboardLayout><EnrichmentPage /></DashboardLayout>} />
          
          {/* Execution */}
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/templates" element={<WorkflowsPage defaultTab="templates" />} />
          <Route path="/template" element={<Navigate to="/templates" replace />} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilderPage />} />
          <Route path="/workflow-canvas" element={<WorkflowCanvasPage />} />
          <Route path="/social-agent" element={<DashboardLayout><SocialAgentPage /></DashboardLayout>} />
          <Route path="/marketplace" element={<DashboardLayout><MarketplacePage /></DashboardLayout>} />
          <Route path="/agents" element={<Navigate to="/marketplace" replace />} />
          <Route path="/agents/:id/build" element={<AgentStudioBuildPage />} />
          <Route path="/knowledge" element={<DashboardLayout><KnowledgeBasePage /></DashboardLayout>} />
          
          {/* System */}
          <Route path="/analytics" element={<DashboardLayout><AnalyticsPage /></DashboardLayout>} />
          <Route path="/integrations" element={<DashboardLayout><IntegrationsPage /></DashboardLayout>} />
          <Route path="/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
          
          {/* Legacy redirects */}
          <Route path="/help" element={<Navigate to="/home" replace />} />
          <Route path="/prompts" element={<Navigate to="/copilot" replace />} />
          <Route path="/voice" element={<DashboardLayout><VoiceAgentPage /></DashboardLayout>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
