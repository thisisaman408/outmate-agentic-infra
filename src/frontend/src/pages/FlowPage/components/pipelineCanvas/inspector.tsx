import { useEffect, useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Edge, Node } from "@xyflow/react";
import sortFields from "@/CustomNodes/utils/sort-fields";
import useFlowStore from "@/stores/flowStore";
import { ParameterRenderComponent } from "@/components/core/parameterRenderComponent";
import type { APIClassType } from "@/types/api";
import { cn } from "@/utils/utils";
import type { CatalogEntry } from "./catalog";
import { inferKind, nodeDescription, nodeDisplayName } from "./nodeKind";

type NodeInspectorProps = {
  node: Node<any>;
  catalogEntry: CatalogEntry | null;
  onClose: () => void;
  onSave: (patch: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) => void;
};

const KindBadge = ({ kind }: { kind: string }) => {
  const cls =
    kind === "trigger"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : kind === "branch"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : kind === "wait"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
          : kind === "exit"
            ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
            : kind === "agent"
              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
              : "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {kind}
    </span>
  );
};

type FieldEntry = {
  key: string;
  display_name?: string;
  type?: string;
  info?: string;
  required?: boolean;
  password?: boolean;
  multiline?: boolean;
  options?: Array<string | { name?: string; value?: any; [k: string]: any }>;
  value?: any;
  list?: boolean;
  show?: boolean;
  advanced?: boolean;
  /** True if the field's options or value shape is too complex for inline editing. */
  complex?: boolean;
};

const isPlainString = (v: any): v is string => typeof v === "string";

// Field-order override per known agent component. Saved flows freeze the
// component template at add-time, so updates to `field_order` in the Python
// component don't reach old saved nodes — we re-apply the canonical order
// here at render time. Order: provider/keys → prospect inputs → behavior.
const FIELD_ORDER_OVERRIDES: Record<string, string[]> = {
  ProspectResearchAgent: [
    "model",
    "api_key",
    "tavily_api_key",
    "apollo_api_key",
    "hunter_api_key",
    "prospect_name",
    "company_name",
    "prospect_role",
    "additional_context",
    "system_prompt",
    "max_iterations",
  ],
  ICPScoringAgent: [
    "model",
    "api_key",
    "tavily_api_key",
    "apollo_api_key",
    "hunter_api_key",
    "pdl_api_key",
    "icp_definition",
    "leads",
    "system_prompt",
    "max_iterations",
  ],
  HyperPersonalisationAgent: [
    "model",
    "api_key",
    "tavily_api_key",
    "apollo_api_key",
    "hunter_api_key",
    "prospect_name",
    "company_name",
    "prospect_role",
    "additional_context",
    "tone",
    "max_words",
    "system_prompt",
    "max_iterations",
  ],
};

// Suppress fields that are legacy, redundant, or noise in the simplified
// inspector. The pipeline canvas exposes a curated form — full Langflow's
// 17-field-per-agent dump is what made the UI overwhelming. These keys are
// hidden everywhere; per-component `field_order` controls the rest.
//
// - agent_description: Langflow's tool-mode "Agent Description [Deprecated]"
// - chat_history: chat memory; pipeline runs are stateless by default
// - input_value / "Input": redundant when Chat Input is wired upstream
// - tools: tool attachments are managed via the tool-chip UI on the agent node
// - verbose / handle_parsing_errors: agent debug flags, default-on is fine
// - description: legacy alias for agent_description
// - session_id / sender_type / sender_name / store_messages / data_template /
//   should_store_message / files / context_id: chat-IO plumbing the canvas
//   auto-fills
const HIDDEN_FIELDS = new Set([
  "agent_description",
  "description",
  "chat_history",
  "input_value",
  "tools",
  "verbose",
  "handle_parsing_errors",
  "session_id",
  "sender",
  "sender_name",
  "sender_type",
  "store_messages",
  "data_template",
  "should_store_message",
  "files",
  "context_id",
]);

const visibleFields = (
  nodeClass: APIClassType | null,
  componentName?: string,
): FieldEntry[] => {
  if (!nodeClass?.template) return [];
  // Prefer our hard-coded override (so old saved flows still surface the
  // model selector at the top); fall back to the template's own field_order;
  // alphabetical sort if neither is present.
  const override =
    componentName && FIELD_ORDER_OVERRIDES[componentName]
      ? FIELD_ORDER_OVERRIDES[componentName]
      : null;
  const order = (override ??
    nodeClass.field_order ??
    []) as string[];
  return Object.keys(nodeClass.template)
    .filter((k) => {
      if (k.startsWith("_") || k === "code") return false;
      if (HIDDEN_FIELDS.has(k)) return false;
      const t = (nodeClass.template as any)[k];
      if (!t || typeof t !== "object") return false;
      if (t.show === false) return false;
      // Catch legacy templates whose info string explicitly says "deprecated".
      if (typeof t.info === "string" && /deprecated/i.test(t.info)) return false;
      return true;
    })
    .sort((a, b) => sortFields(a, b, order))
    .map((key) => {
      const t = (nodeClass.template as any)[key] ?? {};
      // Normalize options to {label, value} pairs even when Langflow gives
      // us object-shaped options (e.g. model selectors with provider data).
      let normalizedOptions:
        | Array<{ label: string; value: string }>
        | undefined;
      let complex = false;
      if (Array.isArray(t.options)) {
        normalizedOptions = t.options.map((opt: any) => {
          if (isPlainString(opt)) return { label: opt, value: opt };
          if (opt && typeof opt === "object") {
            const label =
              opt.display_name ?? opt.label ?? opt.name ?? String(opt.value);
            const value =
              opt.value !== undefined ? String(opt.value) : (opt.name ?? label);
            return { label, value };
          }
          return { label: String(opt), value: String(opt) };
        });
      } else if (t.options && typeof t.options === "object") {
        // dict-shaped options — flag as complex; user can use advanced editor
        complex = true;
      }
      // If the value is itself an object/array of objects, this field needs
      // the advanced editor to edit safely.
      if (
        t.value &&
        typeof t.value === "object" &&
        !Array.isArray(t.value) &&
        !normalizedOptions
      ) {
        complex = true;
      }
      return {
        key,
        display_name: t.display_name ?? key,
        type: t.type,
        info: t.info,
        required: t.required,
        password: t.password,
        multiline: t.multiline,
        options: normalizedOptions,
        value: t.value,
        list: t.list,
        show: t.show,
        advanced: t.advanced,
        complex,
      };
    });
};

type FieldRowProps = {
  field: FieldEntry;
  value: any;
  onChange: (v: any) => void;
  // Pass-through context so we can delegate to Langflow's standard
  // ParameterRenderComponent for field types that need it (model picker,
  // secret-with-globals, code editor, etc.).
  nodeId: string;
  nodeClass: APIClassType;
  rawTemplateField: any;
};

/** Coerce any value into a safe string for input display. */
const safeString = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Object/array → show as JSON so we don't trigger React error #31
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
};

const FieldRow = ({
  field,
  value,
  onChange,
  nodeId,
  nodeClass,
  rawTemplateField,
}: FieldRowProps) => {
  const isBool = field.type === "bool";
  const hasOptions = Array.isArray(field.options) && field.options.length > 0;
  const isMultiline =
    field.multiline || field.type === "code" || field.type === "prompt";
  const isPassword = field.password;
  const isInt = field.type === "int" || field.type === "float";
  const isList = field.list && !hasOptions;

  // Delegate every field to Langflow's standard ParameterRenderComponent —
  // it has the full type-dispatch (model picker with provider+model dropdown,
  // SecretStr with globals picker, code editors, dict, multiselect, etc.)
  // that any current or future agent might need. Our hand-rolled renderers
  // below stay only as a defensive fallback if the standard renderer can't
  // handle the type for some reason.
  const useStandardRenderer = true;

  const safeValue = safeString(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">
          {String(field.display_name ?? field.key)}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
          {field.advanced && (
            <span className="ml-2 text-[10px] font-normal text-muted-foreground/70 uppercase tracking-wider">
              advanced
            </span>
          )}
        </label>
        <span className="text-[10px] text-muted-foreground/60">
          {String(field.type ?? "")}
        </span>
      </div>
      {field.info && (
        <p className="text-[11px] leading-snug text-muted-foreground/70">
          {String(field.info)}
        </p>
      )}

      {useStandardRenderer ? (
        <ParameterRenderComponent
          handleOnNewValue={(changes: any) => {
            // Forward the full patch (value, load_from_db, advanced, etc.)
            // so things like the SecretStr → globals picker can flip
            // `load_from_db: true`, which the runtime needs to actually
            // resolve the value as a variable name. Previously we
            // dropped everything except `value`, which silently broke
            // every globals-backed credential field.
            if (changes && typeof changes === "object") onChange(changes);
          }}
          name={field.key}
          nodeId={nodeId}
          templateData={rawTemplateField}
          templateValue={value}
          editNode={false}
          showParameter
          inspectionPanel={false}
          handleNodeClass={() => {
            /* tool-mode toggle, etc. — no-op in pipeline canvas */
          }}
          nodeClass={nodeClass}
          disabled={false}
        />
      ) : field.complex ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
          This field has a complex structure — open the advanced editor to
          configure it safely.
        </div>
      ) : isBool ? (
        <div>
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      ) : hasOptions ? (
        <Select value={safeValue} onValueChange={onChange}>
          <SelectTrigger className="bg-muted/40">
            <SelectValue placeholder={`Select ${field.display_name ?? field.key}`} />
          </SelectTrigger>
          <SelectContent className="max-h-[280px] overflow-y-auto">
            {field.options!.map((opt: any) => {
              const label = String(opt.label ?? "");
              const val = String(opt.value ?? opt.label ?? "");
              if (!val) return null;
              return (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : isMultiline ? (
        <Textarea
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px] bg-muted/40 font-mono text-xs"
          placeholder={field.info ? String(field.info) : undefined}
        />
      ) : isInt ? (
        <Input
          type="number"
          value={typeof value === "number" ? value : (safeValue === "" ? "" : safeValue)}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="bg-muted/40"
        />
      ) : isList ? (
        <Textarea
          value={
            Array.isArray(value)
              ? value.map((v) => safeString(v)).join("\n")
              : safeValue
          }
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className="min-h-[60px] bg-muted/40 text-xs"
          placeholder="One value per line"
        />
      ) : (
        <Input
          type={isPassword ? "password" : "text"}
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="bg-muted/40"
          placeholder={field.info ? String(field.info) : undefined}
        />
      )}
    </div>
  );
};

const NodeInspector = ({
  node,
  catalogEntry: _catalogEntry,
  onClose,
  onSave,
}: NodeInspectorProps) => {
  const kind = inferKind(node);
  const [name, setName] = useState(nodeDisplayName(node));
  const [description, setDescription] = useState(nodeDescription(node));

  // Live nodeClass from the flow store so edits show up immediately
  // and other components reading the same node see updates.
  const setNode = useFlowStore((state) => state.setNode);
  const liveNodes = useFlowStore((state) => state.nodes);
  const liveEdges = useFlowStore((state) => state.edges);
  const setEdges = useFlowStore((state) => state.setEdges);
  // The page-level autosave debounces saveFlow against the latest
  // flowStore state. Without firing it on parameter edits, inspector
  // changes (API keys, model picks, secret-with-globals selections) only
  // hit the DB if the user happens to drag a node afterwards — easy to
  // miss, which is why credential fields appeared to lose their values.
  const autoSaveFlow = useFlowStore((state: any) => state.autoSaveFlow);
  const liveNode = liveNodes.find((n) => n.id === node.id) ?? node;
  const nodeClass = useMemo<APIClassType | null>(
    () => ((liveNode.data as any)?.node ?? null),
    [liveNode],
  );

  // For branch nodes — extract the outgoing edges so user can rename
  // YES/NO labels and switch logic mode.
  const isBranch = kind === "branch";
  const outgoingEdges: Edge[] = useMemo(
    () =>
      isBranch
        ? liveEdges.filter((e) => e.source === node.id)
        : [],
    [isBranch, liveEdges, node.id],
  );

  useEffect(() => {
    setName(nodeDisplayName(liveNode));
    setDescription(nodeDescription(liveNode));
  }, [liveNode.id]);

  const componentName = (liveNode.data as any)?.type as string | undefined;
  const fields = useMemo(
    () => visibleFields(nodeClass, componentName),
    [nodeClass, componentName],
  );

  // Accepts either a bare value (simple inputs) or a partial patch like
  // `{value, load_from_db}` from the standard ParameterRenderComponent.
  // The patch form is required so that flipping `load_from_db` on variable
  // selection (SecretStrInput → globals picker) actually persists to the
  // saved template — otherwise the field's value is the literal variable
  // *name* and the runtime sends e.g. "Groq API KEY" to the provider.
  const updateField = (key: string, patchOrValue: any) => {
    if (!nodeClass) return;
    const isPatch =
      patchOrValue !== null &&
      typeof patchOrValue === "object" &&
      !Array.isArray(patchOrValue) &&
      ("value" in patchOrValue ||
        "load_from_db" in patchOrValue ||
        "advanced" in patchOrValue ||
        "show" in patchOrValue);
    const patch = isPatch ? patchOrValue : { value: patchOrValue };
    const nextTemplate = {
      ...(nodeClass.template ?? {}),
      [key]: {
        ...((nodeClass.template as any)?.[key] ?? {}),
        ...patch,
      },
    };
    const nextNodeClass: APIClassType = {
      ...nodeClass,
      template: nextTemplate,
    } as any;
    setNode(node.id, (n: any) => ({
      ...n,
      data: {
        ...n.data,
        node: nextNodeClass,
      },
    }));
    // Debounced save so each keystroke / variable pick eventually lands in
    // the DB instead of evaporating on tab close. The autosave hook is a
    // no-op when global autoSaving is disabled.
    if (typeof autoSaveFlow === "function") {
      try {
        autoSaveFlow();
      } catch {
        /* swallow — saving failures are surfaced through the alert store */
      }
    }
  };

  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-l border-border/30 bg-background">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <KindBadge kind={kind} />
          <h3 className="text-sm font-semibold">Configure</h3>
        </div>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          data-testid="inspector-close"
        >
          <ForwardedIconComponent name="X" className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Top: name + description */}
        <div className="flex flex-col gap-4 border-b border-border/30 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== nodeDisplayName(liveNode) && onSave({ name })}
              className="bg-muted/40"
              data-testid="inspector-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== nodeDescription(liveNode) &&
                onSave({ description })
              }
              className="min-h-[60px] bg-muted/40"
              data-testid="inspector-description"
            />
          </div>
        </div>

        {/* Per-component parameters */}
        <div className="flex flex-1 flex-col gap-5 px-4 py-4">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Parameters
            </h4>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {fields.length} editable field{fields.length === 1 ? "" : "s"} —
              edits auto-save when you click <b>Save</b> in the top bar.
            </p>
          </div>

          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No editable parameters for this component.
            </p>
          ) : (
            fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                value={f.value}
                onChange={(v) => updateField(f.key, v)}
                nodeId={liveNode.id}
                nodeClass={(nodeClass ?? {}) as APIClassType}
                rawTemplateField={
                  (nodeClass?.template as any)?.[f.key] ?? {}
                }
              />
            ))
          )}

          {isBranch && (
            <BranchEditor
              nodeMetadata={(liveNode.data as any)?.node?.metadata ?? {}}
              outgoingEdges={outgoingEdges}
              onLogicModeChange={(mode) => {
                const nextMeta = {
                  ...((liveNode.data as any)?.node?.metadata ?? {}),
                  logicMode: mode,
                };
                setNode(node.id, (n: any) => ({
                  ...n,
                  data: {
                    ...n.data,
                    node: {
                      ...n.data?.node,
                      metadata: nextMeta,
                    },
                  },
                }));
              }}
              onBranchLabelChange={(edgeId, label) => {
                setEdges((eds: Edge[]) =>
                  eds.map((e) =>
                    e.id === edgeId ? { ...e, sourceHandle: label } : e,
                  ),
                );
              }}
            />
          )}

          {/* Advanced editor link removed. */}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/30 px-4 py-3">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </aside>
  );
};

type BranchEditorProps = {
  nodeMetadata: { logicMode?: "AND" | "OR"; [k: string]: any };
  outgoingEdges: Edge[];
  onLogicModeChange: (mode: "AND" | "OR") => void;
  onBranchLabelChange: (edgeId: string, label: string) => void;
};

const BranchEditor = ({
  nodeMetadata,
  outgoingEdges,
  onLogicModeChange,
  onBranchLabelChange,
}: BranchEditorProps) => {
  const mode = nodeMetadata?.logicMode ?? "AND";
  return (
    <div className="flex flex-col gap-3 border-t border-border/30 pt-4">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Logic Mode
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          How multiple conditions inside this branch combine.
        </p>
      </div>
      <div className="inline-flex rounded-md border border-border/40 bg-muted/30 p-0.5">
        {(["AND", "OR"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onLogicModeChange(m)}
            className={cn(
              "flex-1 rounded px-3 py-1 text-xs font-semibold transition-colors",
              mode === m
                ? "bg-amber-500 text-amber-950"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`branch-mode-${m.toLowerCase()}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div>
        <h4 className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Branches
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Edit the label shown on each outgoing branch.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {outgoingEdges.length === 0 && (
          <p className="text-xs text-muted-foreground">
            This branch has no outgoing connections yet.
          </p>
        )}
        {outgoingEdges.map((edge, idx) => (
          <div key={edge.id} className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                idx === 0
                  ? "bg-emerald-400"
                  : idx === 1
                    ? "bg-rose-400"
                    : "bg-muted-foreground",
              )}
            />
            <Input
              value={String(edge.sourceHandle ?? (idx === 0 ? "Yes — match" : "No — not match"))}
              onChange={(e) => onBranchLabelChange(edge.id, e.target.value)}
              className="bg-muted/40 text-xs"
              placeholder={idx === 0 ? "Yes — match" : "No — not match"}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodeInspector;
