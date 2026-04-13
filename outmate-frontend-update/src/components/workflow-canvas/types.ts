export type NodeType = "trigger" | "action" | "condition" | "wait" | "end" | "merge";
export type EndVariant = "converted" | "disqualified" | "no-response";
export type TopMode = "workflow" | "enrollment" | "settings" | "copilot";
export type ThemeMode = "dark" | "light";

export interface TriggerChip { label: string; active: boolean; }

export interface WfNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  tag?: string;
  provider?: string;
  icon: string;
  chips?: TriggerChip[];
  endVariant?: EndVariant;
  waitDays?: number;
  waitBizHours?: boolean;
  conditionSubtitle?: string;
  yesBranch?: WfNode[];
  noBranch?: WfNode[];
  yesLabel?: string;
  noLabel?: string;
  configFields?: Record<string, any>;
  loopBadge?: boolean;
}
