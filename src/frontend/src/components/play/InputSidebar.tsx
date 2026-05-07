import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { AgentNodeInfo } from "./hooks/useAgentDetection";

/** Fields hidden from the sidebar — internal/advanced only */
const HIDDEN_FIELDS = new Set([
  "api_key",
  "apollo_api_key",
  "hunter_api_key",
  "pdl_api_key",
  "apify_api_key",
  "tavily_api_key",
  "firecrawl_api_key",
  "neverbounce_api_key",
  "brightdata_api_key",
  "system_prompt",
  "chat_history",
  "max_iterations",
  "max_results",
  "code",
  "_type",
  "handle_parsing_errors",
  "verbose",
  "tools",
  "input_value",
  "model",
  // Langflow tool-mode injection — deprecated, never useful to edit at run time.
  "agent_description",
  "description",
  // Chat-IO plumbing the canvas auto-fills.
  "session_id",
  "sender",
  "sender_name",
  "sender_type",
  "store_messages",
  "should_store_message",
  "data_template",
  "files",
  "context_id",
  "_frontend_node_flow_id",
  "_frontend_node_folder_id",
  "_frontend_node_id",
]);

const FILTER_FIELDS = new Set([
  "filter_department",
  "filter_seniority",
  "filter_title",
]);

interface FieldDef {
  name: string;
  displayName: string;
  value: any;
  options?: string[];
  info: string;
}

function extractFields(template: Record<string, any>): {
  main: FieldDef[];
  filters: FieldDef[];
} {
  const main: FieldDef[] = [];
  const filters: FieldDef[] = [];

  for (const [key, field] of Object.entries(template)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (!field || typeof field !== "object") continue;
    // Skip fields that start with underscore (internal)
    if (key.startsWith("_")) continue;

    const def: FieldDef = {
      name: key,
      displayName: field.display_name ?? key,
      value: field.value ?? "",
      options: field.options,
      info: field.info ?? "",
    };

    if (FILTER_FIELDS.has(key)) {
      filters.push(def);
    } else {
      main.push(def);
    }
  }

  return { main, filters };
}

interface InputSidebarProps {
  agent: AgentNodeInfo;
  onRun: (values: Record<string, any>) => void;
  isRunning: boolean;
}

export default function InputSidebar({ agent, onRun, isRunning }: InputSidebarProps) {
  const { main, filters } = extractFields(agent.template);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const f of [...main, ...filters]) {
      init[f.name] = f.value;
    }
    return init;
  });
  const [showFilters, setShowFilters] = useState(false);

  // No pre-flight — SecretStr fields backed by global variables don't surface
  // a `value` we can introspect (the template carries `load_from_db=true` and
  // resolves at run time on the backend). Trust the user's config; if it's
  // broken, the backend will surface a real error and PlayPanel renders it.
  const handleRunClick = () => onRun(values);

  // Sync if template values change externally (e.g., user edits node)
  useEffect(() => {
    const newVals: Record<string, any> = {};
    for (const f of [...main, ...filters]) {
      newVals[f.name] = f.value;
    }
    setValues((prev) => {
      // Only update fields that haven't been user-modified
      const merged = { ...prev };
      for (const [k, v] of Object.entries(newVals)) {
        if (!(k in merged)) merged[k] = v;
      }
      return merged;
    });
  }, [agent.template]);

  const update = (name: string, val: any) => {
    setValues((prev) => ({ ...prev, [name]: val }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-3 border-b border-border/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <ForwardedIconComponent
            name={agent.icon}
            className="h-4 w-4 text-primary"
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{agent.displayName}</h3>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 flex flex-col gap-3">
        {main.map((f) => (
          <Field
            key={f.name}
            field={f}
            value={values[f.name]}
            onChange={(v) => update(f.name, v)}
          />
        ))}

        {filters.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <ForwardedIconComponent
                name={showFilters ? "ChevronDown" : "ChevronRight"}
                className="h-3 w-3"
              />
              {showFilters ? "Hide filters" : "Filters"}
            </button>
            {showFilters &&
              filters.map((f) => (
                <Field
                  key={f.name}
                  field={f}
                  value={values[f.name]}
                  onChange={(v) => update(f.name, v)}
                />
              ))}
          </>
        )}
      </div>

      {/* Run button */}
      <div className="p-4 pt-2 border-t border-border/30 shrink-0">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleRunClick}
          disabled={isRunning}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <ForwardedIconComponent name="Loader" className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Agent
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  const cls =
    "w-full rounded-lg border border-border/50 bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {field.displayName}
      </span>
      {field.options && field.options.length > 0 ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.info?.slice(0, 50) || `Enter ${field.displayName.toLowerCase()}...`}
          className={cls}
        />
      )}
    </label>
  );
}
