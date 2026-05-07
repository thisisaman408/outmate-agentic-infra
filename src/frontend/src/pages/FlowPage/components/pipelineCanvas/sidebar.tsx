import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Input } from "@/components/ui/input";
import { useIntegrationsStatus } from "@/controllers/API/queries/integrations/use-integrations-status";
import { cn } from "@/utils/utils";
import {
  CATALOG,
  CATALOG_BY_CATEGORY,
  CATEGORY_META,
  type CatalogCategory,
  type CatalogEntry,
} from "./catalog";

const CATEGORY_ORDER: CatalogCategory[] = [
  "rules",
  "agents",
  "actions",
  "integrations",
];

const INTEGRATION_COLORS: Record<string, string> = {
  predict: "bg-violet-500",
  "people-data-labs": "bg-blue-500",
  zoominfo: "bg-sky-500",
  clearbit: "bg-blue-600",
  hunter: "bg-amber-500",
  apollo: "bg-violet-600",
  hubspot: "bg-orange-500",
  salesforce: "bg-sky-600",
  smartlead: "bg-violet-500",
  slack: "bg-rose-500",
  twilio: "bg-rose-600",
  zoom: "bg-sky-500",
  webhook: "bg-slate-500",
  "rest-api": "bg-slate-600",
};

const KIND_ICON_TINT: Record<string, string> = {
  // Match Lovable: RULES (branch + delay) all amber; only Exit is rose.
  branch: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  wait: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  exit: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  agent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  trigger: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  action: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

type BuildSidebarProps = {
  onAdd: (entry: CatalogEntry) => void;
};

const BuildSidebar = ({ onAdd }: BuildSidebarProps) => {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<CatalogCategory, boolean>>({
    integrations: false,
    rules: false,
    agents: false,
    actions: false,
  });
  const { data: integrationsStatus } = useIntegrationsStatus();
  const connectedSet = useMemo(
    () =>
      new Set(
        (integrationsStatus ?? []).filter((i) => i.connected).map((i) => i.id),
      ),
    [integrationsStatus],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG_BY_CATEGORY;
    const result = {} as Record<CatalogCategory, CatalogEntry[]>;
    for (const cat of CATEGORY_ORDER) {
      result[cat] = CATALOG.filter(
        (e) =>
          e.category === cat &&
          (e.name.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            (e.subLabel?.toLowerCase().includes(q) ?? false)),
      );
    }
    return result;
  }, [query]);

  const toggleCat = (cat: CatalogCategory) =>
    setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border/30 bg-background">
      <div className="flex flex-col gap-2 border-b border-border/30 px-4 py-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">Build</h3>
          <p className="text-xs text-muted-foreground">Click to add to workflow</p>
        </div>
        <div className="relative">
          <ForwardedIconComponent
            name="Search"
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search nodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
            data-testid="build-sidebar-search"
          />
        </div>
        {/* Advanced editor link intentionally removed. */}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {CATEGORY_ORDER.map((cat) => {
          const items = filtered[cat] ?? [];
          if (items.length === 0 && query) return null;
          const meta = CATEGORY_META[cat];
          const isCollapsed = collapsed[cat] && !query;
          return (
            <div key={cat} className="flex flex-col">
              <button
                onClick={() => toggleCat(cat)}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
              >
                {meta.title}
                <ForwardedIconComponent
                  name={isCollapsed ? "ChevronRight" : "ChevronDown"}
                  className="h-3 w-3"
                />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col">
                  {items.map((entry) => (
                    <CatalogRow
                      key={entry.id}
                      entry={entry}
                      isConnected={connectedSet.has(entry.id)}
                      onAdd={() => onAdd(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

const CatalogRow = ({
  entry,
  isConnected,
  onAdd,
}: {
  entry: CatalogEntry;
  isConnected?: boolean;
  onAdd: () => void;
}) => {
  const isIntegration = entry.category === "integrations";
  const initialColor = INTEGRATION_COLORS[entry.id] ?? "bg-slate-500";
  const tint = KIND_ICON_TINT[entry.kind];
  // Prefer live status over the static catalog flag.
  const connected =
    isConnected !== undefined ? isConnected : entry.status === "connected";

  return (
    <button
      onClick={onAdd}
      className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/30"
      data-testid={`catalog-row-${entry.id}`}
    >
      {isIntegration ? (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white",
            initialColor,
          )}
        >
          {entry.icon}
        </div>
      ) : (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            tint,
          )}
        >
          <ForwardedIconComponent name={entry.icon} className="h-4 w-4" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {entry.name}
          </span>
          {entry.id === "predict" && (
            <ForwardedIconComponent
              name="Star"
              className="h-3 w-3 text-amber-300"
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {entry.subLabel && (
            <span className="truncate text-muted-foreground">{entry.subLabel}</span>
          )}
          {entry.subLabel && connected && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {connected && (
            <span className="inline-flex items-center gap-0.5 text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              Connected
            </span>
          )}
          {!entry.subLabel && !connected && (
            <span className="truncate text-muted-foreground">
              {entry.description}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default BuildSidebar;
