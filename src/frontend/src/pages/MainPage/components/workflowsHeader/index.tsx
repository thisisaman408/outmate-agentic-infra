import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/utils/utils";

interface WorkflowsHeaderProps {
  flowType: "flows" | "components" | "mcp";
  setFlowType: (flowType: "flows" | "components" | "mcp") => void;
  onCreateWorkflow: () => void;
  setSearch: (search: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

const WorkflowsHeader = ({
  flowType,
  setFlowType,
  onCreateWorkflow,
  setSearch,
  showFilters,
  setShowFilters,
}: WorkflowsHeaderProps) => {
  const [searchValue, setSearchValue] = useState("");

  const debouncedSetSearch = useCallback(
    debounce((value: string) => setSearch(value), 400),
    [setSearch],
  );

  useEffect(() => {
    debouncedSetSearch(searchValue);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchValue, debouncedSetSearch]);

  const onTabClick = (tab: "flows" | "components") => {
    setFlowType(tab);
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border/40 px-6 pt-4">
      {/* Title + right-side actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Workflows
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Learn more
            <ForwardedIconComponent name="ChevronDown" className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-sm font-medium text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
          >
            <ForwardedIconComponent name="Sparkles" className="h-4 w-4" />
            Outbound Copilot
          </Button>

          <Button
            size="sm"
            onClick={onCreateWorkflow}
            className="bg-foreground text-background hover:bg-foreground/90"
            data-testid="create-workflow-btn"
          >
            Create workflow
          </Button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onTabClick("flows")}
          className={cn(
            "relative -mb-px pb-3 text-sm font-medium transition-colors",
            flowType === "flows"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-workflows"
        >
          Workflows
          {flowType === "flows" && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
          )}
        </button>
        <button
          onClick={() => onTabClick("components")}
          className={cn(
            "relative -mb-px pb-3 text-sm font-medium transition-colors",
            flowType === "components"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-templates"
        >
          Templates
          {flowType === "components" && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />
          )}
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            data-testid="show-filters-btn"
          >
            <ForwardedIconComponent name="Filter" className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>

          <div className="relative">
            <ForwardedIconComponent
              name="Search"
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search workflows..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8 w-72 pl-8 text-sm"
              data-testid="search-workflows-input"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ForwardedIconComponent name="BarChart3" className="h-4 w-4" />
            Sort
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="text-muted-foreground hover:text-foreground"
          >
            <ForwardedIconComponent name="Settings" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsHeader;
