import OutmateLogo from "@/assets/outmateLogo.svg?react";
import IconComponent, {
    ForwardedIconComponent,
} from "@/components/common/genericIconComponent";
import { ContentBlockDisplay } from "@/components/core/chatComponents/ContentBlockDisplay";
import SmartResultRenderer from "@/components/core/chatComponents/SmartResultRenderer";
import { useUpdateMessage } from "@/controllers/API/queries/messages";
import { CustomMarkdownField } from "@/customization/components/custom-markdown-field";
import useAlertStore from "@/stores/alertStore";
import useFlowStore from "@/stores/flowStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { chatMessagePropsType } from "@/types/components";
import { cn } from "@/utils/utils";
import { memo, useMemo, useState } from "react";
import { useMessageDuration } from "../hooks/use-message-duration";
import { useStreamingMessage } from "../hooks/use-streaming-message";
import {
    getContentBlockLoadingState,
    getContentBlockState,
} from "../utils/content-blocks";
import { convertFiles } from "../utils/convert-files";
import EditMessageField from "./edit-message-field";
import { EditMessageButton } from "./message-options";

/**
 * Extracts all tool outputs from content_blocks and compiles them into
 * a single displayable text. Used when the agent produces tool call data
 * but no final synthesized message.
 */
function compileToolOutputs(contentBlocks: any[] | undefined): string {
  if (!contentBlocks?.length) return "";

  const parts: string[] = [];

  for (const block of contentBlocks) {
    if (!block.contents) continue;
    for (const content of block.contents) {
      if (content.type !== "tool_use") continue;

      const output = content.output;
      if (output === null || output === undefined) continue;

      if (typeof output === "string") {
        const trimmed = output.trim();
        if (trimmed) parts.push(trimmed);
      } else if (typeof output === "object") {
        // For JSON outputs, convert to key-value markdown
        try {
          const obj = output as Record<string, any>;
          const lines: string[] = [];
          for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined || value === "") continue;
            const label = key
              .replace(/_/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .replace(/^\w/, (c) => c.toUpperCase());
            if (typeof value === "object") {
              lines.push(`**${label}:** ${JSON.stringify(value)}`);
            } else {
              lines.push(`**${label}:** ${String(value)}`);
            }
          }
          if (lines.length > 0) parts.push(lines.join("\n"));
        } catch {
          parts.push(JSON.stringify(output, null, 2));
        }
      }
    }
  }

  return parts.join("\n\n");
}

export const BotMessage = memo(
  ({ chat, lastMessage, updateChat, playgroundPage }: chatMessagePropsType) => {
    const setErrorData = useAlertStore((state) => state.setErrorData);
    const [editMessage, setEditMessage] = useState(false);
    const isBuilding = useFlowStore((state) => state.isBuilding);
    const buildStartTime = useFlowStore((state) => state.buildStartTime);
    const buildDuration = useFlowStore((state) => state.buildDuration);
    const flow_id = useFlowsManagerStore((state) => state.currentFlowId);

    const isAudioMessage = chat.category === "audio";

    const { chatMessage: decodedMessage, isStreaming } = useStreamingMessage({
      chat,
      isBuilding,
      updateChat,
    });

    const rawEmpty = decodedMessage?.trim() === "";
    const chatMessage = chat.message ? chat.message.toString() : "";

    // Count tool calls from content_blocks
    const toolCallCount =
      chat.content_blocks?.reduce(
        (count, block) =>
          count +
          (block.contents
            ? block.contents.filter((c) => c.type === "tool_use").length
            : 0),
        0,
      ) ?? 0;

    // If the message text is empty but tool calls were made,
    // automatically compile and display the tool outputs instead of
    // hiding them behind the collapsed steps accordion.
    const hasFallback = rawEmpty && !isStreaming && toolCallCount > 0;
    const compiledOutput = useMemo(
      () => (hasFallback ? compileToolOutputs(chat.content_blocks) : ""),
      [hasFallback, chat.content_blocks],
    );
    const hasCompiledData = compiledOutput.trim().length > 0;
    const isEmpty = rawEmpty && !hasFallback;
    const effectiveMessage = hasFallback
      ? (hasCompiledData ? compiledOutput : decodedMessage)
      : decodedMessage;
    const { mutate: updateMessageMutation } = useUpdateMessage();

    const handleEditMessage = (message: string) => {
      updateMessageMutation(
        {
          message: {
            id: chat.id,
            files: convertFiles(chat.files),
            sender_name: chat.sender_name ?? "AI",
            text: message,
            sender: "Machine",
            flow_id,
            session_id: chat.session ?? "",
          },
          refetch: true,
        },
        {
          onSuccess: () => {
            updateChat?.(chat, message);
            setEditMessage(false);
          },
          onError: () => {
            setErrorData({
              title: "Error updating messages.",
            });
          },
        },
      );
    };

    const handleEvaluateAnswer = (evaluation: boolean | null) => {
      updateMessageMutation(
        {
          message: {
            ...chat,
            files: convertFiles(chat.files),
            sender_name: chat.sender_name ?? "AI",
            text: chat.message.toString(),
            sender: "Machine",
            flow_id,
            session_id: chat.session ?? "",
            properties: {
              ...chat.properties,
              state: chat.properties?.state as
                | "complete"
                | "partial"
                | undefined,
              positive_feedback: evaluation,
            },
          },
        },
        {
          onError: () => {
            setErrorData({
              title: "Error updating messages.",
            });
          },
        },
      );
    };

    const editedFlag = chat.edit ? (
      <div className="mt-2 text-xs text-muted-foreground text-right">
        (Edited)
      </div>
    ) : null;

    const thinkingActive = Boolean(isBuilding && lastMessage);

    const { displayTime: liveDisplayTime } = useMessageDuration({
      lastMessage,
      isBuilding,
      buildStartTime,
      buildDuration,
    });

    // Prefer persisted duration (frozen value) over live timer
    // This ensures nested agent segments show their own duration after reset
    const persistedDuration = chat.properties?.build_duration;
    const displayTime =
      typeof persistedDuration === "number" && persistedDuration > 0
        ? persistedDuration
        : liveDisplayTime;

    return (
      <>
        <div className="w-full word-break-break-word mt-3">
          <div
            className={cn(
              "group relative flex w-full flex-col gap-3 rounded-xl px-4 py-4",
              "bg-gradient-to-b from-muted/20 to-transparent",
              "border border-border/30",
              "transition-all duration-200",
              editMessage ? "" : "hover:border-border/50 hover:shadow-sm",
            )}
          >
            <div className="flex w-full items-start gap-3">
              {(thinkingActive || displayTime > 0 || chatMessage !== "") && (
                <div
                  className="relative hidden h-7 w-7 mt-[-1px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-2xl @[45rem]/chat-panel:!flex border-0"
                  style={
                    chat.properties?.background_color
                      ? { backgroundColor: chat.properties.background_color }
                      : {}
                  }
                >
                  <div className="flex h-5 w-5 items-center justify-center">
                    <OutmateLogo className="h-4 w-4 text-primary" />
                  </div>
                </div>
              )}

              <div className="flex w-full flex-col min-w-0">
                {/* Subtle completion indicator — no timing shown to users */}
                {!thinkingActive && displayTime > 0 && !isBuilding && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <ForwardedIconComponent
                      name="CheckCircle"
                      className="h-3.5 w-3.5 text-emerald-500"
                    />
                    <span className="text-[11px] text-muted-foreground/60">Done</span>
                  </div>
                )}

                {((chat.content_blocks && chat.content_blocks.length > 0) ||
                  (isBuilding && lastMessage)) && (
                  <ContentBlockDisplay
                    playgroundPage={playgroundPage}
                    contentBlocks={chat.content_blocks || []}
                    isLoading={getContentBlockLoadingState(
                      chat,
                      isBuilding,
                      lastMessage,
                    )}
                    state={getContentBlockState(chat, isBuilding, lastMessage)}
                    chatId={chat.id}
                    hideHeader={true}
                  />
                )}

                <div className="form-modal-chat-text-position flex-grow mt-2">
                  <div className="form-modal-chat-text">
                    <div className="flex w-full flex-col">
                      <div
                        className="flex w-full flex-col dark:text-white"
                        data-testid="div-chat-message"
                      >
                        <div
                          data-testid={`chat-message-${chat.sender_name}-${chatMessage}`}
                          className="flex w-full flex-col"
                        >
                          {(chatMessage === "" || (isEmpty && !isStreaming)) &&
                          isBuilding &&
                          lastMessage ? (
                            <div className="flex items-center gap-1.5 py-2">
                              <div className="flex gap-1">
                                <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                                <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                                <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                              </div>
                              <span className="text-xs text-muted-foreground/50 ml-1">Thinking...</span>
                            </div>
                          ) : (
                            <div className="w-full">
                              {editMessage ? (
                                <EditMessageField
                                  key={`edit-message-${chat.id}`}
                                  message={effectiveMessage}
                                  onEdit={handleEditMessage}
                                  onCancel={() => setEditMessage(false)}
                                />
                              ) : (
                                <>
                                  <CustomMarkdownField
                                    isAudioMessage={isAudioMessage}
                                    chat={chat}
                                    isEmpty={isEmpty && !isStreaming}
                                    chatMessage={effectiveMessage}
                                    editedFlag={editedFlag}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!editMessage && (
              <div className="invisible absolute -top-4 right-0 group-hover:visible">
                <EditMessageButton
                  onCopy={() => navigator.clipboard.writeText(chatMessage)}
                  onEdit={() => setEditMessage(true)}
                  className="h-fit group-hover:visible"
                  isBotMessage={true}
                  onEvaluate={handleEvaluateAnswer}
                  evaluation={chat.properties?.positive_feedback}
                  isAudioMessage={isAudioMessage}
                />
              </div>
            )}
          </div>
        </div>
        <div id={lastMessage ? "last-chat-message" : undefined} />
      </>
    );
  },
);
