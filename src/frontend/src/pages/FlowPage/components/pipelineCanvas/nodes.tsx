import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { cn } from "@/utils/utils";
import {
  inferKind,
  nodeDescription,
  nodeDisplayName,
  nodeSubTags,
  type GtmKind,
} from "./nodeKind";
import type { PipelineNode } from "./layout";

const KIND_THEME: Record<GtmKind, { border: string; iconBg: string; icon: string; label: string; iconColor: string }> = {
  trigger: {
    border: "border-amber-500/40",
    iconBg: "bg-amber-500/15",
    icon: "Zap",
    iconColor: "text-amber-300",
    label: "TRIGGER",
  },
  action: {
    border: "border-border/40",
    iconBg: "bg-blue-500/15",
    icon: "Box",
    iconColor: "text-blue-300",
    label: "ACTION",
  },
  branch: {
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/10",
    icon: "Diamond",
    iconColor: "text-amber-300",
    label: "BRANCH",
  },
  wait: {
    // Match Lovable: amber, not sky-blue.
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/10",
    icon: "Clock",
    iconColor: "text-amber-300",
    label: "WAIT",
  },
  exit: {
    border: "border-rose-500/30",
    iconBg: "bg-rose-500/10",
    icon: "XCircle",
    iconColor: "text-rose-300",
    label: "EXIT",
  },
  agent: {
    border: "border-violet-500/30",
    iconBg: "bg-violet-500/10",
    icon: "Sparkles",
    iconColor: "text-violet-300",
    label: "AI AGENT",
  },
};

type AttachedTool = {
  id: string;
  name: string;
};

type NodeCardProps = {
  node: PipelineNode;
  onClick?: () => void;
  selected?: boolean;
  detail?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  attachedTools?: AttachedTool[];
  onDetachTool?: (toolId: string) => void;
  /**
   * Click-to-connect wiring. When `wiringMode` is true, this card is a
   * potential drop target — clicking it (or its inline TRUE/FALSE chips for
   * branches) calls `onWireTarget` instead of the normal `onClick`.
   *
   * `isWiringSource` flags the originating orphan so it can render a "Cancel
   * wiring" affordance instead of a target.
   */
  wiringMode?: boolean;
  isWiringSource?: boolean;
  onWireTarget?: (label?: "true" | "false") => void;
  onCancelWiring?: () => void;
  /**
   * Detach this node from the chain — strip all incoming/outgoing edges so
   * it falls back to "Disconnected" and can be rewired. Only passed for
   * reachable chain nodes; orphans don't need it.
   */
  onDisconnect?: () => void;
};

export const PipelineNodeCard = ({
  node,
  onClick,
  selected,
  detail = true,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDelete,
  attachedTools = [],
  onDetachTool,
  wiringMode = false,
  isWiringSource = false,
  onWireTarget,
  onCancelWiring,
  onDisconnect,
}: NodeCardProps) => {
  const kind = inferKind(node.raw);
  const theme = KIND_THEME[kind];
  const name = nodeDisplayName(node.raw);
  const description = nodeDescription(node.raw);
  const subTags = nodeSubTags(node.raw);

  const isBranch = kind === "branch";
  const wireableTarget = wiringMode && !isWiringSource && !!onWireTarget;
  const wireRingClass = wireableTarget
    ? "ring-2 ring-amber-400/70 shadow-[0_0_0_4px_rgba(245,158,11,0.15)] animate-pulse"
    : isWiringSource
      ? "ring-2 ring-amber-300/80"
      : "";

  const handleCardClick = () => {
    if (wireableTarget) {
      // Branches require an explicit TRUE/FALSE choice via the inline chips,
      // so a card-body click on a branch in wiring mode is a no-op.
      if (!isBranch) onWireTarget!();
      return;
    }
    onClick?.();
  };

  if (!detail) {
    // Outline mode — single-line compact card
    return (
      <div className="relative flex items-center">
        <ReorderHandles
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      <div
        onClick={handleCardClick}
        className={cn(
          "group/card relative flex w-[420px] cursor-pointer items-center gap-3 rounded-lg border bg-card/60 px-4 py-2.5 transition-colors hover:border-border",
          theme.border,
          selected && "ring-2 ring-amber-400/40",
          wireRingClass,
        )}
        data-testid={`pipeline-node-${node.id}`}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            theme.iconBg,
          )}
        >
          <ForwardedIconComponent
            name={theme.icon}
            className={cn("h-4 w-4", theme.iconColor)}
          />
        </div>
        <span className="flex-1 truncate text-sm font-semibold">{name}</span>
        {wireableTarget && isBranch ? (
          <BranchWireChips onWireTarget={onWireTarget!} />
        ) : wireableTarget ? (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Insert here
          </span>
        ) : (
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              theme.border,
              theme.iconColor,
            )}
          >
            {theme.label}
          </span>
        )}
        {isWiringSource && onCancelWiring && (
          <CancelWiringButton onCancel={onCancelWiring} />
        )}
        {!wiringMode && onDelete && <CardDeleteButton onDelete={onDelete} />}
      </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <ReorderHandles
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
      <div
        onClick={handleCardClick}
        className={cn(
          "group/card relative flex w-[480px] cursor-pointer flex-col gap-3 rounded-xl border bg-card/60 p-4 transition-colors hover:border-border",
          theme.border,
          selected && "ring-2 ring-amber-400/40",
          wireRingClass,
        )}
        data-testid={`pipeline-node-${node.id}`}
      >
      {!wiringMode && onDisconnect && (
        <CardDisconnectButton onDisconnect={onDisconnect} />
      )}
      {!wiringMode && onDelete && <CardDeleteButton onDelete={onDelete} />}
      {isWiringSource && onCancelWiring && (
        <CancelWiringButton onCancel={onCancelWiring} />
      )}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            theme.iconBg,
          )}
        >
          <ForwardedIconComponent
            name={theme.icon}
            className={cn("h-5 w-5", theme.iconColor)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              // Reserve right space for whichever absolute button sits up
              // there: the wider "Cancel" pill while wiring, otherwise the
              // small trash + disconnect icons.
              isWiringSource ? "pr-24" : "pr-16",
            )}
          >
            <span className="truncate text-sm font-semibold">{name}</span>
            {wireableTarget ? (
              <span className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Insert here
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  theme.border,
                  theme.iconColor,
                )}
              >
                {theme.label}
              </span>
            )}
          </div>
          {description && (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </div>
      </div>

      {wireableTarget && isBranch && (
        <BranchWireChips onWireTarget={onWireTarget!} />
      )}

      {subTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {subTags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {attachedTools.length > 0 && (
        <div
          className="flex flex-col gap-1.5 rounded-md border border-violet-500/20 bg-violet-500/5 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
            Tools ({attachedTools.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {attachedTools.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-200"
              >
                <ForwardedIconComponent
                  name="Wrench"
                  className="h-3 w-3"
                />
                {t.name}
                {onDetachTool && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetachTool(t.id);
                    }}
                    className="ml-0.5 rounded hover:bg-violet-500/30"
                    aria-label={`Detach ${t.name}`}
                    data-testid={`detach-tool-${t.id}`}
                  >
                    <ForwardedIconComponent name="X" className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

type SectionLabelProps = {
  text: string;
  tone?: "trigger" | "action";
};

export const SectionLabel = ({ text, tone = "action" }: SectionLabelProps) => {
  const cls =
    tone === "trigger"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-border/40 bg-muted/30 text-muted-foreground";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider",
        cls,
      )}
    >
      <ForwardedIconComponent
        name={tone === "trigger" ? "Clock" : "ArrowDown"}
        className="h-3.5 w-3.5"
      />
      {text}
    </div>
  );
};

type BranchPillProps = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

export const BranchPill = ({ label, tone }: BranchPillProps) => {
  const cls =
    tone === "positive"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "negative"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : "border-border/40 bg-muted/30 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
        cls,
      )}
    >
      {label}
    </span>
  );
};

export const VerticalConnector = ({ height = 28 }: { height?: number }) => (
  <div className="relative flex flex-col items-center" aria-hidden>
    <div
      className="w-0.5 bg-amber-500/60"
      style={{ height: `${height}px` }}
    />
    <div
      className="absolute bottom-0 -translate-y-0 h-0 w-0"
      style={{
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "6px solid rgb(245 158 11 / 0.7)",
      }}
    />
  </div>
);

const BranchWireChips = ({
  onWireTarget,
}: {
  onWireTarget: (label: "true" | "false") => void;
}) => (
  <div
    className="flex shrink-0 items-center gap-1"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onWireTarget("true");
      }}
      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
      data-testid="wire-true"
    >
      ✓ TRUE
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onWireTarget("false");
      }}
      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
      data-testid="wire-false"
    >
      ✕ FALSE
    </button>
  </div>
);

const CancelWiringButton = ({ onCancel }: { onCancel: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onCancel();
    }}
    className="absolute right-2 top-2 z-10 flex h-6 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-amber-200 hover:bg-amber-500/20"
    aria-label="Cancel wiring"
    title="Cancel wiring (Esc)"
    data-testid="card-cancel-wiring"
  >
    <ForwardedIconComponent name="X" className="h-3 w-3" />
    Cancel
  </button>
);

const CardDisconnectButton = ({
  onDisconnect,
}: {
  onDisconnect: () => void;
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onDisconnect();
    }}
    className="absolute right-10 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 opacity-70 transition-all hover:bg-amber-500/20 hover:text-amber-200 hover:opacity-100 group-hover/card:opacity-100"
    aria-label="Disconnect from flow"
    title="Disconnect from flow (back to disconnected list)"
    data-testid="card-disconnect"
  >
    <ForwardedIconComponent name="Unlink2" className="h-3.5 w-3.5" />
  </button>
);

const CardDeleteButton = ({ onDelete }: { onDelete: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onDelete();
    }}
    className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 opacity-70 transition-all hover:bg-rose-500/20 hover:text-rose-200 hover:opacity-100 group-hover/card:opacity-100"
    aria-label="Delete step"
    title="Delete step"
    data-testid="card-delete"
  >
    <ForwardedIconComponent name="Trash2" className="h-3.5 w-3.5" />
  </button>
);

type ReorderHandlesProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  // Delete is rendered separately as the prominent top-right CardDeleteButton
  // to avoid two trash icons per card. Up/Down only here.
};

const ReorderHandles = ({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ReorderHandlesProps) => {
  if (!onMoveUp && !onMoveDown) return null;
  // Vertical pill on the LEFT side of the card (outside the card boundary).
  // Up / Down only — delete lives at top-right of the card.
  return (
    <div
      className="mr-2 flex flex-col items-center gap-0.5 rounded-md border border-border/40 bg-background/70 p-0.5 shadow-sm"
      onClick={(e) => e.stopPropagation()}
      data-testid="reorder-handles"
    >
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp?.();
        }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded transition-colors",
          canMoveUp
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground/25 cursor-not-allowed",
        )}
        aria-label="Move up"
        title="Move up"
        data-testid="reorder-up"
      >
        <ForwardedIconComponent name="ChevronUp" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown?.();
        }}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded transition-colors",
          canMoveDown
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground/25 cursor-not-allowed",
        )}
        aria-label="Move down"
        title="Move down"
        data-testid="reorder-down"
      >
        <ForwardedIconComponent name="ChevronDown" className="h-3.5 w-3.5" />
      </button>
      {/* Delete handled by CardDeleteButton at top-right of the card. */}
    </div>
  );
};
