import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ChatMessageType, ContentBlock } from "@/types/chat";
import { cn } from "@/utils/utils";
import { getFriendlyErrorSummary } from "../utils/extract-error-message";

interface ErrorViewProps {
  blocks: ContentBlock[];
  showError: boolean;
  lastMessage: boolean;
  closeChat?: () => void;
  fitViewNode: (id: string) => void;
  chat: ChatMessageType;
}

/**
 * Animated thinking state while flow is running.
 */
function ThinkingState() {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex w-full gap-3 rounded-md p-2"
    >
      <div className="relative hidden h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-white text-2xl @[45rem]/chat-panel:!flex border-0">
        <div className="flex h-5 w-5 items-center justify-center">
          <ForwardedIconComponent
            name="Indicator"
            className="h-[6px] w-[6px] text-black"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-xs text-muted-foreground/60">Thinking...</span>
      </div>
    </motion.div>
  );
}

interface ErrorCardProps {
  content: ContentBlock["contents"][number] & { type: "error" };
  chat: ChatMessageType;
  closeChat?: () => void;
  fitViewNode: (id: string) => void;
}

/**
 * Friendly error card — shows a human-readable message with optional expandable details.
 */
function ErrorCard({
  content,
  chat,
  closeChat,
  fitViewNode,
}: ErrorCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const friendlyMessage = getFriendlyErrorSummary(content.reason);

  const handleComponentClick = () => {
    fitViewNode(chat.properties?.source?.id ?? "");
    closeChat?.();
  };

  const hasDetails = content.field || content.component || content.reason;

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
      <ForwardedIconComponent
        name="AlertTriangle"
        className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5"
      />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Friendly message */}
        <span className="text-sm text-foreground/80">
          {friendlyMessage}
        </span>

        {/* Clickable component link if available */}
        {content.component && closeChat && (
          <button
            onClick={handleComponentClick}
            className="text-xs text-primary/70 hover:text-primary underline self-start transition-colors"
          >
            Go to {chat.properties?.source?.display_name || content.component}
          </button>
        )}

        {/* Technical details toggle */}
        {hasDetails && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors self-start mt-0.5"
            >
              {showDetails ? "Hide technical details" : "Technical details"}
            </button>

            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <div className="mt-1 p-2 rounded bg-muted/30 text-xs text-muted-foreground font-mono space-y-1">
                  {content.field && <div>Field: {content.field}</div>}
                  {content.component && <div>Component: {content.component}</div>}
                  {content.reason && (
                    <div className="whitespace-pre-wrap break-all">{content.reason}</div>
                  )}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Main error view component — shows friendly errors instead of raw technical details.
 */
export const ErrorView = ({
  closeChat,
  fitViewNode,
  chat,
  showError,
  lastMessage,
  blocks,
}: ErrorViewProps) => {
  const showLoading = !showError && lastMessage;

  return (
    <AnimatePresence mode="wait">
      {showLoading ? (
        <ThinkingState />
      ) : (
        <motion.div
          key="errors"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-2 w-full"
        >
          {blocks.map((block, blockIndex) => (
            <div key={blockIndex}>
              {block.contents.map((content, contentIndex) => {
                if (content.type === "error") {
                  return (
                    <ErrorCard
                      key={contentIndex}
                      content={content}
                      chat={chat}
                      closeChat={closeChat}
                      fitViewNode={fitViewNode}
                    />
                  );
                }
                return null;
              })}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
