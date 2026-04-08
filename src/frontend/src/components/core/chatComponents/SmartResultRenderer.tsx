/**
 * SmartResultRenderer — detects patterns in bot messages and renders them
 * as modern cards, tables, and structured layouts instead of raw markdown.
 *
 * This component wraps around the standard markdown renderer and intercepts
 * content that can be displayed more intuitively for non-technical users.
 */
import { motion } from "framer-motion";
import { type ReactNode, useMemo } from "react";
import ForwardedIconComponent from "../../common/genericIconComponent";

// ─── Pattern Detection ───────────────────────────────────────────────────────

interface DetectedSection {
  type: "key-value" | "heading" | "text" | "table" | "list" | "divider" | "error-inline";
  content: string;
  pairs?: Array<{ key: string; value: string }>;
  heading?: string;
  level?: number;
  rows?: string[][];
  headers?: string[];
  items?: string[];
  errorSource?: string;
  errorDetail?: string;
}

/**
 * Parses raw markdown text into structured sections for smart rendering.
 */
function parseSections(text: string): DetectedSection[] {
  if (!text || typeof text !== "string") return [];

  const lines = text.split("\n");
  const sections: DetectedSection[] = [];
  let currentKvPairs: Array<{ key: string; value: string }> = [];
  let currentText: string[] = [];
  let currentList: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushText = () => {
    if (currentText.length > 0) {
      const content = currentText.join("\n").trim();
      if (content) sections.push({ type: "text", content });
      currentText = [];
    }
  };

  const flushKv = () => {
    if (currentKvPairs.length > 0) {
      sections.push({
        type: "key-value",
        content: "",
        pairs: [...currentKvPairs],
      });
      currentKvPairs = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      sections.push({
        type: "list",
        content: "",
        items: [...currentList],
      });
      currentList = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      sections.push({
        type: "table",
        content: "",
        headers: [...tableHeaders],
        rows: [...tableRows],
      });
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (flush accumulators)
    if (!trimmed) {
      flushKv();
      flushList();
      if (inTable) flushTable();
      if (currentText.length > 0 && currentText[currentText.length - 1] !== "") {
        currentText.push("");
      }
      continue;
    }

    // Divider lines
    if (/^[-_*]{3,}\s*$/.test(trimmed)) {
      flushText();
      flushKv();
      flushList();
      sections.push({ type: "divider", content: "---" });
      continue;
    }

    // Filter out debug/log lines (timestamps with [debug], [error], etc.)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed) && /\[(debug|error|info|warning)\]/.test(trimmed)) {
      continue; // Skip log lines entirely — users should never see these
    }

    // Inline error detection: "Apollo error (422) {...}" or "Error code: 401 - {...}"
    const errorMatch = trimmed.match(/^(\w+)\s+error\s*\((\d+)\)\s*(.*)/i) ||
      trimmed.match(/^Error code:\s*(\d+)\s*[-–]\s*(.*)/i);
    if (errorMatch) {
      flushText();
      flushKv();
      flushList();
      const source = errorMatch[1] || "Service";
      const detail = errorMatch[errorMatch.length - 1] || "";
      // Try to extract a friendly message from JSON
      let friendlyDetail = detail;
      try {
        const parsed = JSON.parse(detail.replace(/'/g, '"'));
        friendlyDetail = parsed?.error || parsed?.message || detail;
      } catch {
        // Keep raw detail
      }
      sections.push({
        type: "error-inline",
        content: trimmed,
        errorSource: source,
        errorDetail: typeof friendlyDetail === 'string' ? friendlyDetail : JSON.stringify(friendlyDetail),
      });
      continue;
    }

    // Heading detection
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      flushText();
      flushKv();
      flushList();
      if (inTable) flushTable();
      sections.push({
        type: "heading",
        content: headingMatch[2].replace(/\*\*/g, ""),
        heading: headingMatch[2].replace(/\*\*/g, ""),
        level: headingMatch[1].length,
      });
      continue;
    }

    // Bold heading (standalone bold line like **Company Overview**)
    if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed) && !trimmed.includes("|")) {
      flushText();
      flushKv();
      flushList();
      if (inTable) flushTable();
      const headingText = trimmed.replace(/\*\*/g, "").replace(/:$/, "").trim();
      sections.push({
        type: "heading",
        content: headingText,
        heading: headingText,
        level: 3,
      });
      continue;
    }

    // Table detection
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      flushText();
      flushKv();
      flushList();

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Skip separator rows
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        inTable = true;
        continue;
      }

      if (!inTable && tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
        inTable = true;
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Key-value detection: "**Key**: Value" or "Key: Value" patterns
    const kvBoldMatch = trimmed.match(
      /^\*\*([^*]+)\*\*\s*:\s*(.+)/
    );
    const kvPlainMatch =
      !kvBoldMatch &&
      trimmed.match(/^([A-Z][A-Za-z\s/&]+(?:\([^)]*\))?)\s*:\s*(.+)/);
    const kvDashMatch =
      !kvBoldMatch &&
      !kvPlainMatch &&
      trimmed.match(/^[-•]\s*\*\*([^*]+)\*\*\s*:\s*(.+)/);

    if (kvBoldMatch || kvPlainMatch || kvDashMatch) {
      flushText();
      flushList();
      const match = kvBoldMatch || kvPlainMatch || kvDashMatch;
      currentKvPairs.push({
        key: match![1].trim(),
        value: match![2].replace(/\*\*/g, "").trim(),
      });
      continue;
    }

    // List detection
    const listMatch = trimmed.match(/^[-•*]\s+(.+)/);
    const numberedListMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (listMatch || numberedListMatch) {
      flushText();
      flushKv();
      const itemText = (listMatch || numberedListMatch)![1];
      currentList.push(itemText);
      continue;
    }

    // Default: plain text
    flushKv();
    flushList();
    currentText.push(line);
  }

  // Flush remaining
  flushText();
  flushKv();
  flushList();
  if (inTable) flushTable();

  return sections;
}

// ─── Section Renderers ───────────────────────────────────────────────────────

function getIconForKey(key: string): string {
  const k = key.toLowerCase();
  if (/email|mail/.test(k)) return "Mail";
  if (/phone|tel|mobile|call/.test(k)) return "Phone";
  if (/linkedin/.test(k)) return "Linkedin";
  if (/twitter|x\.com/.test(k)) return "Twitter";
  if (/company|org|business|employer/.test(k)) return "Building2";
  if (/role|title|position|designation/.test(k)) return "Briefcase";
  if (/location|city|address|country|region/.test(k)) return "MapPin";
  if (/website|url|web|domain|site/.test(k)) return "Globe";
  if (/revenue|funding|valuation|arr|mrr/.test(k)) return "DollarSign";
  if (/employee|team.?size|headcount|staff/.test(k)) return "Users";
  if (/industry|sector|vertical/.test(k)) return "Factory";
  if (/tech|stack|technology|platform/.test(k)) return "Cpu";
  if (/score|rating|fit/.test(k)) return "Target";
  if (/date|time|year|founded/.test(k)) return "Calendar";
  if (/name|person|contact/.test(k)) return "User";
  if (/summary|overview|description|about|bio/.test(k)) return "FileText";
  if (/pain.?point|challenge|problem/.test(k)) return "AlertTriangle";
  if (/opportunity|signal|intent/.test(k)) return "TrendingUp";
  if (/conversation|starter|icebreaker|approach/.test(k)) return "MessageCircle";
  if (/social|profile/.test(k)) return "Share2";
  if (/news|recent|update|activity/.test(k)) return "Newspaper";
  return "Info";
}

function KeyValueCard({ pairs }: { pairs: Array<{ key: string; value: string }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/30 to-transparent overflow-hidden"
    >
      <div className="divide-y divide-border/40">
        {pairs.map(({ key, value }, i) => {
          const icon = getIconForKey(key);
          const isLongValue = value.length > 100;

          return (
            <div
              key={i}
              className={`flex gap-3 px-4 py-2.5 ${isLongValue ? "flex-col" : "items-center"}`}
            >
              <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <ForwardedIconComponent
                    name={icon}
                    className="h-3.5 w-3.5 text-primary/60"
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {key}
                </span>
              </div>
              <span
                className={`text-sm text-foreground/90 ${isLongValue ? "pl-9.5 leading-relaxed" : "ml-auto text-right"}`}
              >
                {renderInlineValue(value)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/** Renders URLs as clickable links, emails as mailto links */
function renderInlineValue(value: string): ReactNode {
  // URL detection
  const urlRegex = /(https?:\/\/[^\s,)]+)/g;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  if (urlRegex.test(value)) {
    const parts = value.split(urlRegex);
    return (
      <>
        {parts.map((part, i) =>
          /^https?:\/\//.test(part) ? (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
            >
              {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
              {part.replace(/^https?:\/\/(www\.)?/, "").length > 40 ? "..." : ""}
            </a>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    );
  }

  if (emailRegex.test(value)) {
    return (
      <a
        href={`mailto:${value}`}
        className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
      >
        {value}
      </a>
    );
  }

  return value;
}

function ModernTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-border/60 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {headers.length > 0 && (
            <thead>
              <tr className="bg-muted/50 border-b border-border/40">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h.replace(/\*\*/g, "")}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border/30">
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="hover:bg-muted/20 transition-colors"
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-foreground/80">
                    {renderInlineValue(cell.replace(/\*\*/g, ""))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SmartHeading({ text, level }: { text: string; level: number }) {
  const sizes: Record<number, string> = {
    1: "text-lg font-bold",
    2: "text-base font-semibold",
    3: "text-sm font-semibold",
    4: "text-sm font-medium text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
      <div className="h-5 w-1 rounded-full bg-primary/40" />
      <span className={sizes[level] || sizes[3]}>{text}</span>
    </div>
  );
}

function ErrorInlineCard({ source, detail }: { source: string; detail: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15"
    >
      <ForwardedIconComponent
        name="AlertTriangle"
        className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground/80">
          {source} couldn't complete this step
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground/70">{detail}</span>
        )}
      </div>
    </motion.div>
  );
}

function SmartList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 pl-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/40 flex-shrink-0" />
          <span className="text-sm text-foreground/80 leading-relaxed">
            {renderInlineValue(item.replace(/\*\*/g, ""))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SmartText({ content }: { content: string }) {
  // Don't render empty/whitespace content
  if (!content.trim()) return null;

  return (
    <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
      {renderInlineValue(content)}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SmartResultRendererProps {
  text: string;
  /** Fallback renderer for content that doesn't match patterns */
  fallback?: ReactNode;
}

/**
 * Detects if the text has enough structure to warrant smart rendering.
 * Falls back to standard markdown for simple text.
 */
function hasStructuredContent(sections: DetectedSection[]): boolean {
  return sections.some(
    (s) =>
      s.type === "key-value" ||
      s.type === "table" ||
      s.type === "error-inline" ||
      (s.type === "heading" && sections.length > 2),
  );
}

export default function SmartResultRenderer({
  text,
  fallback,
}: SmartResultRendererProps) {
  const sections = useMemo(() => parseSections(text), [text]);
  const isStructured = useMemo(
    () => hasStructuredContent(sections),
    [sections],
  );

  // If content isn't structured enough, use the fallback markdown renderer
  if (!isStructured || !text.trim()) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, i) => {
        switch (section.type) {
          case "heading":
            return (
              <SmartHeading
                key={i}
                text={section.heading!}
                level={section.level || 3}
              />
            );
          case "key-value":
            return <KeyValueCard key={i} pairs={section.pairs!} />;
          case "table":
            return (
              <ModernTable
                key={i}
                headers={section.headers!}
                rows={section.rows!}
              />
            );
          case "list":
            return <SmartList key={i} items={section.items!} />;
          case "error-inline":
            return (
              <ErrorInlineCard
                key={i}
                source={section.errorSource || "Service"}
                detail={section.errorDetail || ""}
              />
            );
          case "divider":
            return (
              <hr key={i} className="border-border/30 my-1" />
            );
          case "text":
            return <SmartText key={i} content={section.content} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
