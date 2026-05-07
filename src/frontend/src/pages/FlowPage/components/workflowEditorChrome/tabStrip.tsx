import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { cn } from "@/utils/utils";

export type EditorTab = "workflow" | "outcome" | "settings" | "copilot";

const TABS: Array<{ id: EditorTab; label: string; icon: string }> = [
  { id: "workflow", label: "Workflow", icon: "Sparkles" },
  { id: "outcome", label: "Outcome", icon: "Activity" },
  { id: "settings", label: "Settings", icon: "Settings" },
  { id: "copilot", label: "Co-pilot", icon: "Sparkle" },
];

type TabStripProps = {
  active: EditorTab;
  onChange: (tab: EditorTab) => void;
};

const TabStrip = ({ active, onChange }: TabStripProps) => {
  return (
    <div className="flex items-center gap-1 border-b border-border/40 bg-background px-4">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex items-center gap-1.5 rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors",
            active === tab.id
              ? "text-amber-300"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid={`editor-tab-${tab.id}`}
        >
          <ForwardedIconComponent
            name={tab.icon}
            className={cn(
              "h-4 w-4",
              active === tab.id ? "text-amber-300" : "text-muted-foreground",
            )}
          />
          {tab.label}
          {active === tab.id && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 bg-amber-400" />
          )}
        </button>
      ))}
    </div>
  );
};

export default TabStrip;
