import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import type { FlowType } from "@/types/flow";
import { cn } from "@/utils/utils";

type TagTone =
  | "violet"
  | "amber"
  | "emerald"
  | "sky"
  | "rose"
  | "slate"
  | "blue"
  | "indigo"
  | "teal";

const TAG_TONE_CLASSES: Record<TagTone, string> = {
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  slate: "bg-slate-500/15 text-slate-300 border-slate-500/20",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  teal: "bg-teal-500/15 text-teal-300 border-teal-500/20",
};

const tagTone = (tag: string): TagTone => {
  const t = tag.toLowerCase();
  if (/ai|llm|agent/.test(t)) return "violet";
  if (/outbound|email|sales/.test(t)) return "amber";
  if (/inbound|crm/.test(t)) return "emerald";
  if (/enrichment|enrich|data/.test(t)) return "teal";
  if (/signal|trigger|webhook|intent/.test(t)) return "sky";
  if (/scoring|icp|score|routing/.test(t)) return "rose";
  if (/multi|channel|orchestrat/.test(t)) return "indigo";
  if (/linkedin/.test(t)) return "blue";
  if (/research|analysis/.test(t)) return "blue";
  if (/content|generation|writer|copywriter|seo/.test(t)) return "violet";
  return "slate";
};

const PIPELINE_ICONS: Array<[RegExp, string]> = [
  [/signal|trigger|webhook|intent/i, "Zap"],
  [/enrich|database|waterfall|apollo|crustdata|explorium/i, "Database"],
  [/score|icp|scoring/i, "BarChart3"],
  [/email|gmail|smtp|sendgrid/i, "Mail"],
  [/agent|llm|model/i, "Bot"],
  [/search|tavily|serper|google|duckduckgo/i, "Search"],
  [/voice|phone|retell/i, "Phone"],
  [/linkedin/i, "Linkedin"],
  [/social|twitter|instagram/i, "Hash"],
  [/chat input|input/i, "ArrowRightCircle"],
  [/chat output|output|response/i, "ArrowLeftCircle"],
  [/calculator|math/i, "Calculator"],
  [/notification|alert|slack/i, "Bell"],
  [/file|upload|loader/i, "FileText"],
  [/prompt|template/i, "FileCode"],
  [/route|router|conditional/i, "GitBranch"],
];

const stepIcon = (label: string): string => {
  for (const [pattern, icon] of PIPELINE_ICONS) {
    if (pattern.test(label)) return icon;
  }
  return "Square";
};

const extractPipelineSteps = (flow: FlowType): string[] => {
  const nodes = (flow.data?.nodes ?? []) as any[];
  if (nodes.length === 0) return [];
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const n of nodes) {
    const label =
      n?.data?.node?.display_name ??
      n?.data?.type ??
      n?.data?.id ??
      "";
    if (!label || typeof label !== "string" || seen.has(label)) continue;
    seen.add(label);
    steps.push(label);
    if (steps.length >= 5) break;
  }
  return steps;
};

type RichTemplateCardProps = {
  example: FlowType;
  loading: boolean;
  onUseTemplate: () => void;
  onViewFlow: () => void;
};

const RichTemplateCard = ({
  example,
  loading,
  onUseTemplate,
  onViewFlow,
}: RichTemplateCardProps) => {
  const tags = (example.tags ?? []).slice(0, 4);
  const steps = extractPipelineSteps(example);

  return (
    <div
      data-testid={`template-card-${example.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border/40 bg-card/50 p-5 transition-colors hover:border-border"
    >
      {/* Tag pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                TAG_TONE_CLASSES[tagTone(tag)],
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title + description */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold leading-tight tracking-tight">
          {example.name}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {example.description || "No description"}
        </p>
      </div>

      {/* Pipeline preview */}
      {steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((step, i) => (
            <div key={`${step}-${i}`} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground">
                <ForwardedIconComponent
                  name={stepIcon(step)}
                  className="h-3 w-3 text-muted-foreground"
                />
                <span className="max-w-[140px] truncate">{step}</span>
              </span>
              {i < steps.length - 1 && (
                <ForwardedIconComponent
                  name="ChevronRight"
                  className="h-3 w-3 text-muted-foreground/60"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewFlow}
          disabled={loading}
          className="gap-1.5"
          data-testid={`view-flow-${example.id}`}
        >
          <ForwardedIconComponent name="Eye" className="h-4 w-4" />
          View Flow
        </Button>
        <Button
          size="sm"
          onClick={onUseTemplate}
          disabled={loading}
          className="gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400"
          data-testid={`use-template-${example.id}`}
        >
          <ForwardedIconComponent name="Plus" className="h-4 w-4" />
          Use Template
        </Button>
      </div>
    </div>
  );
};

export default RichTemplateCard;
