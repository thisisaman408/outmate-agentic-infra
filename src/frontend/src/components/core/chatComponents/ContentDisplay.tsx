import { type ReactNode, useState } from "react";
import Markdown from "react-markdown";
import rehypeMathjax from "rehype-mathjax/browser";
import remarkGfm from "remark-gfm";
import type { ContentType, JSONValue } from "@/types/chat";
import { extractLanguage, isCodeBlock } from "@/utils/codeBlockUtils";
import ForwardedIconComponent from "../../common/genericIconComponent";
import SimplifiedCodeTabComponent from "../codeTabsComponent";
import SmartResultRenderer from "./SmartResultRenderer";

/**
 * Renders a JSON value as a clean key-value card instead of raw JSON.
 */
function JsonCard({ data }: { data: JSONValue }) {
  const [showRaw, setShowRaw] = useState(false);

  if (data === null || data === undefined) return null;

  // For primitives, just show the value
  if (typeof data !== "object") {
    return <span className="text-sm">{String(data)}</span>;
  }

  // For arrays, render as a clean list
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-xs text-muted-foreground/60">Empty list</span>;
    return (
      <div className="flex flex-col gap-1">
        {data.map((item, i) => (
          <div key={i} className="text-sm pl-2 border-l-2 border-border/50">
            {typeof item === "object" ? (
              <JsonCard data={item} />
            ) : (
              <span>{String(item)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // For objects, render as key-value pairs
  const entries = Object.entries(data as Record<string, JSONValue>);
  if (entries.length === 0) return <span className="text-xs text-muted-foreground/60">No data</span>;

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([key, value]) => {
        const label = key
          .replace(/_/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^\w/, (c) => c.toUpperCase());

        // Nested objects
        if (value !== null && typeof value === "object") {
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground/80">{label}</span>
              <div className="pl-3 border-l-2 border-border/30">
                <JsonCard data={value} />
              </div>
            </div>
          );
        }

        // Simple values
        return (
          <div key={key} className="flex gap-2 items-baseline text-sm">
            <span className="text-xs text-muted-foreground/70 whitespace-nowrap min-w-0 flex-shrink-0">{label}:</span>
            <span className="text-foreground/80 break-all">
              {value === null || value === undefined ? (
                <span className="text-muted-foreground/40">—</span>
              ) : (
                String(value)
              )}
            </span>
          </div>
        );
      })}

      {/* Toggle to show raw JSON for power users */}
      {entries.length > 0 && (
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors self-start mt-1"
        >
          {showRaw ? "Hide raw data" : "Show raw data"}
        </button>
      )}
      {showRaw && (
        <SimplifiedCodeTabComponent
          language="json"
          code={JSON.stringify(data, null, 2)}
        />
      )}
    </div>
  );
}

/**
 * Shared markdown components config for rendering tool output.
 */
const markdownComponents = {
  a: ({ node, ...props }: any) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  ),
  p({ node, ...props }: any) {
    return (
      <span className="block w-fit max-w-full">
        {props.children}
      </span>
    );
  },
  pre({ node, ...props }: any) {
    return <>{props.children}</>;
  },
  ol({ node, ...props }: any) {
    return <ol className="max-w-full">{props.children}</ol>;
  },
  ul({ node, ...props }: any) {
    return <ul className="max-w-full">{props.children}</ul>;
  },
  code: ({ node, className, children, ...props }: any) => {
    const content = String(children);
    if (typeof content === "string" && content.length && content[0] === "▍") {
      return <span className="form-modal-markdown-span"></span>;
    }
    if (isCodeBlock(className, props, content)) {
      return (
        <SimplifiedCodeTabComponent
          language={extractLanguage(className)}
          code={content.replace(/\n$/, "")}
        />
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export default function ContentDisplay({
  content,
  chatId,
  playgroundPage,
}: {
  content: ContentType;
  chatId: string;
  playgroundPage?: boolean;
}) {
  let contentData: ReactNode | null = null;

  switch (content.type) {
    case "text":
      contentData = (
        <div className="ml-1">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeMathjax]}
            className="markdown prose max-w-full text-sm font-normal dark:prose-invert"
            components={markdownComponents}
          >
            {String(content.text)}
          </Markdown>
        </div>
      );
      break;

    case "code":
      contentData = (
        <SimplifiedCodeTabComponent
          language={content.language}
          code={content.code}
        />
      );
      break;

    case "json":
      contentData = <JsonCard data={content.data} />;
      break;

    case "error": {
      // Friendly error display
      const hasDetails = content.traceback || content.solution;
      const [showDetails, setShowDetails] = useState(false);

      contentData = (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <ForwardedIconComponent
              name="AlertTriangle"
              className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-foreground/80">
                {content.reason || "Something went wrong with this step."}
              </span>
              {content.solution && (
                <span className="text-xs text-muted-foreground">
                  {content.solution}
                </span>
              )}
            </div>
          </div>
          {hasDetails && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors self-start"
              >
                {showDetails ? "Hide technical details" : "Show technical details"}
              </button>
              {showDetails && content.traceback && (
                <SimplifiedCodeTabComponent
                  language="text"
                  code={content.traceback}
                />
              )}
            </>
          )}
        </div>
      );
      break;
    }

    case "tool_use": {
      const formatToolOutput = (output: JSONValue) => {
        if (output === null || output === undefined) return null;

        // If it's a string, use SmartResultRenderer for structured content
        if (typeof output === "string") {
          return (
            <SmartResultRenderer
              text={output}
              fallback={
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeMathjax]}
                  className="markdown prose max-w-full text-sm font-normal dark:prose-invert"
                  components={markdownComponents}
                >
                  {output}
                </Markdown>
              }
            />
          );
        }

        // For objects/arrays, render as clean card
        return <JsonCard data={output} />;
      };

      const hasOutput = content.output !== undefined && content.output !== null;
      const hasError = content.error != null;
      const [showInput, setShowInput] = useState(false);

      contentData = (
        <div className="flex flex-col gap-2">
          {/* Output first — this is what users care about */}
          {hasOutput && content.output !== undefined && (
            <div>{formatToolOutput(content.output as JSONValue)}</div>
          )}

          {/* Error display */}
          {hasError && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/5 border border-red-500/10">
              <ForwardedIconComponent
                name="AlertTriangle"
                className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5"
              />
              <div className="text-sm text-red-400/80">
                {typeof content.error === "string"
                  ? content.error
                  : JSON.stringify(content.error, null, 2)}
              </div>
            </div>
          )}

          {/* No output and no error */}
          {!hasOutput && !hasError && (
            <span className="text-xs text-muted-foreground/50">
              No output from this step.
            </span>
          )}

          {/* Input hidden by default — toggle for power users */}
          <button
            onClick={() => setShowInput(!showInput)}
            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors self-start"
          >
            {showInput ? "Hide input data" : "Show input data"}
          </button>
          {showInput && (
            <SimplifiedCodeTabComponent
              language="json"
              code={JSON.stringify(content.tool_input, null, 2)}
            />
          )}
        </div>
      );
      break;
    }

    case "media":
      contentData = (
        <div className="flex flex-col gap-2">
          {content.urls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={content.caption || `Media ${index}`}
              className="rounded-md max-w-full"
            />
          ))}
          {content.caption && (
            <span className="text-xs text-muted-foreground">{content.caption}</span>
          )}
        </div>
      );
      break;
  }

  return (
    <div className="relative">
      {contentData}
    </div>
  );
}
