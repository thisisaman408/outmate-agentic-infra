import { useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { track } from "@/customization/utils/analytics";
import useAddFlow from "@/hooks/flows/use-add-flow";
import { Nav } from "@/modals/templatesModal/components/navComponent";
import type { Category } from "@/types/templates/types";
import { cn } from "@/utils/utils";
import RichTemplatesGrid from "./richTemplatesGrid";

const CATEGORIES: Category[] = [
  {
    title: "Categories",
    items: [
      { title: "All Templates", icon: "Layers", id: "all-templates" },
      { title: "Outbound", icon: "Mail", id: "outbound" },
      { title: "Inbound", icon: "TrendingUp", id: "inbound" },
      { title: "Enrichment", icon: "Database", id: "enrichment" },
      { title: "Scoring & Routing", icon: "Gauge", id: "scoring" },
      { title: "Signal-Based", icon: "Zap", id: "signal" },
      { title: "AI-Powered", icon: "Briefcase", id: "ai" },
      { title: "Multi-Channel", icon: "Share2", id: "multi-channel" },
    ],
  },
];

const WorkflowsTemplatesView = () => {
  const [currentTab, setCurrentTab] = useState("all-templates");
  const [loading, setLoading] = useState(false);
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { folderId } = useParams();

  const handleFlowCreating = (isCreating: boolean) => setLoading(isCreating);

  const handleCreateBlankFlow = () => {
    if (loading) return;
    handleFlowCreating(true);
    track("New Flow Created", { template: "Blank Flow" });
    addFlow()
      .then((id) => {
        navigate(`/flow/${id}${folderId ? `/folder/${folderId}` : ""}`);
      })
      .finally(() => handleFlowCreating(false));
  };

  return (
    <div className="flex h-full w-full flex-col">
      <SidebarProvider width="15rem" defaultOpen>
        <div className="flex h-full w-full">
          <Nav
            categories={CATEGORIES}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
          />
          <main className="flex flex-1 flex-col gap-4 overflow-auto p-6 md:gap-8">
            <RichTemplatesGrid
              currentTab={currentTab}
              loading={loading}
              onFlowCreating={handleFlowCreating}
            />

            <div className="mt-auto flex w-full flex-col justify-between gap-4 border-t border-border/40 pt-4 sm:flex-row sm:items-center">
              <div className="flex flex-col items-start justify-center">
                <div className="font-semibold">Start from scratch</div>
                <div className="text-sm text-muted-foreground">
                  Begin with a fresh flow to build from scratch.
                </div>
              </div>
              <Button
                onClick={handleCreateBlankFlow}
                size="sm"
                data-testid="blank-flow-inline"
                className={cn(
                  "shrink-0 gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400",
                  loading ? "cursor-default opacity-80" : "cursor-pointer",
                )}
              >
                <ForwardedIconComponent name="Plus" className="h-4 w-4 shrink-0" />
                Blank Flow
              </Button>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default WorkflowsTemplatesView;
