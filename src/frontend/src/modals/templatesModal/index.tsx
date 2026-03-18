import { useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { track } from "@/customization/utils/analytics";
import useAddFlow from "@/hooks/flows/use-add-flow";
import type { Category } from "@/types/templates/types";
import { cn } from "@/utils/utils";
import type { newFlowModalPropsType } from "../../types/components";
import BaseModal from "../baseModal";
import GetStartedComponent from "./components/GetStartedComponent";
import { Nav } from "./components/navComponent";
import TemplateContentComponent from "./components/TemplateContentComponent";

export default function TemplatesModal({
  open,
  setOpen,
}: newFlowModalPropsType): JSX.Element {
  const [currentTab, setCurrentTab] = useState("get-started");
  const [loading, setLoading] = useState(false);
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { folderId } = useParams();

  const handleFlowCreating = (isCreating: boolean) => {
    setLoading(isCreating);
  };

  const handleCreateBlankFlow = () => {
    if (loading) return;

    handleFlowCreating(true);
    track("New Flow Created", { template: "Blank Flow" });

    addFlow()
      .then((id) => {
        navigate(`/flow/${id}${folderId ? `/folder/${folderId}` : ""}`);
      })
      .finally(() => {
        handleFlowCreating(false);
      });
  };

  // Define categories and their items
  const categories: Category[] = [
    {
      title: "Templates",
      items: [
        { title: "Get started", icon: "SquarePlay", id: "get-started" },
        { title: "All templates", icon: "LayoutPanelTop", id: "all-templates" },
      ],
    },
    {
      title: "GTM Signals",
      items: [
        {
          title: "Full Pipeline",
          icon: "Rocket",
          id: "full-pipeline",
        },
        {
          title: "Prospect Research",
          icon: "Search",
          id: "prospect-research",
        },
        { title: "Lead Scoring", icon: "BarChart3", id: "lead-scoring" },
        { title: "Email Outreach", icon: "Mail", id: "email-outreach" },
        {
          title: "Data Enrichment",
          icon: "DatabaseZap",
          id: "data-enrichment",
        },
      ],
    },
    {
      title: "GTM Workflows",
      items: [
        { title: "Agents", icon: "Bot", id: "agents" },
        {
          title: "Content Generation",
          icon: "Newspaper",
          id: "content-generation",
        },
        {
          title: "Research & Analysis",
          icon: "FileSearch",
          id: "research-analysis",
        },
      ],
    },
  ];

  return (
    <BaseModal size="templates" open={open} setOpen={setOpen} className="p-0">
      <BaseModal.Content className="flex flex-col p-0">
        <div className="flex h-full">
          <SidebarProvider width="15rem" defaultOpen={false}>
            <Nav
              categories={categories}
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
            />
            <main className="flex flex-1 flex-col gap-4 overflow-auto p-6 md:gap-8">
              {currentTab === "get-started" ? (
                <GetStartedComponent
                  loading={loading}
                  onFlowCreating={handleFlowCreating}
                />
              ) : (
                <TemplateContentComponent
                  currentTab={currentTab}
                  categories={categories.flatMap((category) => category.items)}
                  loading={loading}
                  onFlowCreating={handleFlowCreating}
                />
              )}
              <BaseModal.Footer>
                <div className="flex w-full flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
                  <div className="flex flex-col items-start justify-center">
                    <div className="font-semibold">Start from scratch</div>
                    <div className="text-sm text-muted-foreground">
                      Begin with a fresh flow to build from scratch.
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateBlankFlow}
                    size="sm"
                    data-testid="blank-flow"
                    className={cn(
                      "shrink-0",
                      loading ? "cursor-default opacity-80" : "cursor-pointer",
                    )}
                  >
                    <ForwardedIconComponent
                      name="Plus"
                      className="h-4 w-4 shrink-0"
                    />
                    Blank Flow
                  </Button>
                </div>
              </BaseModal.Footer>
            </main>
          </SidebarProvider>
        </div>
      </BaseModal.Content>
    </BaseModal>
  );
}
