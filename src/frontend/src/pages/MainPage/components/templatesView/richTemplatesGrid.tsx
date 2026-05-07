import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Input } from "@/components/ui/input";
import { ENABLE_KNOWLEDGE_BASES } from "@/customization/feature-flags";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { track } from "@/customization/utils/analytics";
import useAddFlow from "@/hooks/flows/use-add-flow";
import { useFolderStore } from "@/stores/foldersStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { FlowType } from "@/types/flow";
import { updateIds } from "@/utils/reactflowUtils";
import RichTemplateCard from "./richTemplateCard";

type RichTemplatesGridProps = {
  currentTab: string;
  loading: boolean;
  onFlowCreating: (loading: boolean) => void;
};

// Map a category-tab id to one or more tag tokens to match against
// the real flow.tags. If a flow has any of these tags it's shown
// under that category. Tag tokens here mirror the ones we set on
// starter projects under src/backend/.../starter_projects/*.json.
const CATEGORY_TAG_MATCHERS: Record<string, RegExp> = {
  outbound:
    /outbound|email-outreach|voice-outreach|ai-calling|content-generation|sales/i,
  inbound: /inbound|crm|form|reply-handler|reply/i,
  enrichment:
    /enrichment|enrich|data-enrichment|lead-enrichment|waterfall|prospect-research/i,
  scoring: /lead-scoring|scoring|icp|score|routing/i,
  signal: /signal|signal-based|intent-signals|intent|trigger|webhook/i,
  // AI-Powered: agents that wrap an LLM in a workflow (most of ours).
  ai: /^agents?$|ai-powered|llm/i,
  // Multi-Channel: flows that drive >1 channel (email + voice + social).
  "multi-channel": /multi-channel|multichannel|orchestrat/i,
};

// Heuristic fallbacks when a starter's tags don't include a matching token.
// Match by name as a safety net so categories are never empty when we have
// matching templates.
const CATEGORY_NAME_FALLBACK: Record<string, RegExp> = {
  outbound: /outreach|outbound|voice|email|copywriter|social media/i,
  enrichment: /enrich|prospect research|waterfall|tam|team discovery/i,
  scoring: /scoring|icp|saas pricing/i,
  signal: /intent|signal/i,
  ai: /agent/i,
  "multi-channel": /multi-channel|outbound campaign/i,
};

const filterByCategory = (examples: FlowType[], tabId: string): FlowType[] => {
  if (tabId === "all-templates") return examples;
  const tagMatcher = CATEGORY_TAG_MATCHERS[tabId];
  const nameMatcher = CATEGORY_NAME_FALLBACK[tabId];
  if (!tagMatcher && !nameMatcher) return examples;
  return examples.filter((ex) => {
    if (tagMatcher && (ex.tags ?? []).some((t) => tagMatcher.test(t))) return true;
    if (nameMatcher && nameMatcher.test(ex.name ?? "")) return true;
    return false;
  });
};

const RichTemplatesGrid = ({
  currentTab,
  loading,
  onFlowCreating,
}: RichTemplatesGridProps) => {
  const allExamples = useFlowsManagerStore((state) => state.examples);
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { folderId } = useParams();
  const myCollectionId = useFolderStore((state) => state.myCollectionId);
  const folderIdUrl = folderId ?? myCollectionId;

  const examples = useMemo(() => {
    const visible = allExamples.filter((example) => {
      if (!ENABLE_KNOWLEDGE_BASES && example.name?.includes("Knowledge")) {
        return false;
      }
      return true;
    });
    return filterByCategory(visible, currentTab);
  }, [allExamples, currentTab]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredExamples, setFilteredExamples] =
    useState<FlowType[]>(examples);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () => new Fuse(examples, { keys: ["name", "description", "tags"] }),
    [examples],
  );

  useEffect(() => {
    setSearchQuery("");
  }, [currentTab]);

  useEffect(() => {
    if (searchQuery === "") {
      setFilteredExamples(examples);
    } else {
      const results = fuse.search(searchQuery);
      setFilteredExamples(results.map((r) => r.item));
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, currentTab, examples, fuse]);

  const handleUseTemplate = (example: FlowType) => {
    if (loading) return;
    onFlowCreating(true);
    updateIds(example.data as any);
    addFlow({ flow: example })
      .then((id) => {
        navigate(`/flow/${id}/folder/${folderIdUrl}`);
      })
      .finally(() => onFlowCreating(false));
    track("New Flow Created", { template: `${example.name} Template` });
  };

  const handleViewFlow = (example: FlowType) => {
    // For now, View Flow uses the same path as Use Template — clones and
    // opens the editor. A read-only preview modal can be added later.
    handleUseTemplate(example);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {/* Search bar + count */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md flex-1">
          <ForwardedIconComponent
            name="Search"
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={searchInputRef}
            data-testid="rich-template-search"
            className="h-9 rounded-lg pl-8"
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {filteredExamples.length}{" "}
          {filteredExamples.length === 1 ? "template" : "templates"}
        </span>
      </div>

      {/* Grid */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 flex-col overflow-auto scrollbar-hide"
      >
        {filteredExamples.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredExamples.map((example) => (
              <RichTemplateCard
                key={example.id}
                example={example}
                loading={loading}
                onUseTemplate={() => handleUseTemplate(example)}
                onViewFlow={() => handleViewFlow(example)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-secondary-foreground">
              No templates found.{" "}
              {searchQuery && (
                <a
                  className="cursor-pointer underline underline-offset-4"
                  onClick={handleClearSearch}
                >
                  Clear your search
                </a>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RichTemplatesGrid;
