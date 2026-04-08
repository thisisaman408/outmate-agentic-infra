import Markdown from "react-markdown";
import rehypeMathjax from "rehype-mathjax/browser";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { EMPTY_OUTPUT_SEND_MESSAGE } from "@/constants/constants";
import { extractLanguage, isCodeBlock } from "@/utils/codeBlockUtils";
import { preprocessChatMessage } from "@/utils/markdownUtils";
import { cn } from "@/utils/utils";
import CodeTabsComponent from "../../../../../../components/core/codeTabsComponent";

type MarkdownFieldProps = {
  chat: any;
  isEmpty: boolean;
  chatMessage: string;
  editedFlag: React.ReactNode;
  isAudioMessage?: boolean;
};

export const MarkdownField = ({
  chat,
  isEmpty,
  chatMessage,
  editedFlag,
  isAudioMessage,
}: MarkdownFieldProps) => {
  // Process the chat message to handle <think> tags and clean up tables
  const processedChatMessage = preprocessChatMessage(chatMessage);

  return (
    <div className="w-full items-baseline gap-2">
      <Markdown
        remarkPlugins={[remarkGfm as any]}
        rehypePlugins={[rehypeMathjax, rehypeRaw]}
        className={cn(
          "markdown prose flex w-full max-w-full flex-col items-baseline text-sm font-normal word-break-break-word dark:prose-invert",
          isEmpty ? "text-muted-foreground" : "text-primary",
        )}
        components={{
          p({ node, ...props }) {
            return (
              <p className="w-fit max-w-full my-1.5 last:mb-0 first:mt-0 leading-relaxed">
                {props.children}
              </p>
            );
          },
          ol({ node, ...props }) {
            return <ol className="max-w-full my-2 space-y-1">{props.children}</ol>;
          },
          ul({ node, ...props }) {
            return <ul className="max-w-full mb-2 space-y-1">{props.children}</ul>;
          },
          li({ node, ...props }) {
            return (
              <li className="leading-relaxed text-foreground/80">
                {props.children}
              </li>
            );
          },
          pre({ node, ...props }) {
            return <>{props.children}</>;
          },
          hr({ node, ...props }) {
            return <hr className="w-full mt-3 mb-5 border-border/40" {...props} />;
          },
          h1({ node, ...props }) {
            return (
              <div className="flex items-center gap-2 mt-5 mb-2">
                <div className="h-6 w-1 rounded-full bg-primary/50" />
                <h1 className="text-lg font-bold" {...props} />
              </div>
            );
          },
          h2({ node, ...props }) {
            return (
              <div className="flex items-center gap-2 mt-4 mb-2">
                <div className="h-5 w-1 rounded-full bg-primary/40" />
                <h2 className="text-base font-semibold" {...props} />
              </div>
            );
          },
          h3({ node, ...props }) {
            return (
              <div className="flex items-center gap-2 mt-3 mb-1.5">
                <div className="h-4 w-1 rounded-full bg-primary/30" />
                <h3 className="text-sm font-semibold" {...props} />
              </div>
            );
          },
          h4({ node, ...props }) {
            return (
              <h4 className="text-sm font-medium text-muted-foreground mt-3 mb-1" {...props} />
            );
          },
          strong({ node, ...props }) {
            return <strong className="font-semibold text-foreground" {...props} />;
          },
          a({ node, ...props }) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/80 hover:text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors"
              >
                {props.children}
              </a>
            );
          },
          blockquote({ node, ...props }) {
            return (
              <blockquote className="border-l-2 border-primary/30 pl-4 py-1 my-2 text-muted-foreground italic">
                {props.children}
              </blockquote>
            );
          },
          table: ({ node, ...props }) => {
            return (
              <div className="my-3 max-w-full overflow-hidden rounded-xl border border-border/60">
                <div className="max-h-[600px] w-full overflow-auto">
                  <table className="!my-0 w-full text-sm">{props.children}</table>
                </div>
              </div>
            );
          },
          thead: ({ node, ...props }) => {
            return (
              <thead className="bg-muted/50 border-b border-border/40">
                {props.children}
              </thead>
            );
          },
          th: ({ node, ...props }) => {
            return (
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {props.children}
              </th>
            );
          },
          tbody: ({ node, ...props }) => {
            return (
              <tbody className="divide-y divide-border/30">
                {props.children}
              </tbody>
            );
          },
          tr: ({ node, ...props }) => {
            return (
              <tr className="hover:bg-muted/20 transition-colors">
                {props.children}
              </tr>
            );
          },
          td: ({ node, ...props }) => {
            return (
              <td className="px-4 py-2.5 text-foreground/80">
                {props.children}
              </td>
            );
          },
          code: ({ node, className, children, ...props }) => {
            let content = children as string;
            if (
              Array.isArray(children) &&
              children.length === 1 &&
              typeof children[0] === "string"
            ) {
              content = children[0] as string;
            }
            if (typeof content === "string") {
              if (content.length) {
                if (content[0] === "▍") {
                  return <span className="form-modal-markdown-span"></span>;
                }

                // Specifically handle <think> tags that were wrapped in backticks
                if (content === "<think>" || content === "</think>") {
                  return <span>{content}</span>;
                }
              }

              if (isCodeBlock(className, props, content)) {
                return (
                  <CodeTabsComponent
                    language={extractLanguage(className)}
                    code={String(content).replace(/\n$/, "")}
                  />
                );
              }

              return (
                <code
                  className={cn(
                    "rounded bg-muted/60 px-1.5 py-0.5 text-xs font-mono",
                    className,
                  )}
                  {...props}
                >
                  {content}
                </code>
              );
            }
          },
        }}
      >
        {isEmpty && !chat.stream_url
          ? EMPTY_OUTPUT_SEND_MESSAGE
          : processedChatMessage}
      </Markdown>
      {editedFlag}
    </div>
  );
};
