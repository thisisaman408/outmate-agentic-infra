import { useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { useUpdateSessionName } from "@/controllers/API/queries/messages/use-rename-session";
import { useVoiceStore } from "@/stores/voiceStore";
import { cn } from "@/utils/utils";
import { useSessionHasMessages } from "../hooks/use-session-has-messages";
import { SessionMoreMenu } from "./session-more-menu";
import { SessionRename } from "./session-rename";

export interface SessionSelectorProps {
  session: string;
  currentFlowId: string;
  deleteSession: (session: string) => void;
  toggleVisibility: () => void;
  isVisible: boolean;
  inspectSession?: (session: string) => void;
  updateVisibleSession: (session: string) => void;
  selectedView?: { type: string; id: string };
  setSelectedView?: (view: { type: string; id: string } | undefined) => void;
  playgroundPage?: boolean;
  setActiveSession?: (session: string) => void;
  handleRename?: (oldSessionId: string, newSessionId: string) => Promise<void>;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

/**
 * Returns a friendly display name for a session.
 * "Default Session" for the flow ID session, and cleans up "Chat X" names.
 */
function getDisplayName(session: string, currentFlowId: string): string {
  if (session === currentFlowId) return "Default Chat";
  return session;
}

export function SessionSelector({
  session,
  currentFlowId,
  deleteSession,
  toggleVisibility,
  isVisible,
  inspectSession,
  updateVisibleSession,
  selectedView,
  setSelectedView,
  playgroundPage = false,
  setActiveSession,
  handleRename,
  menuOpen,
  onMenuOpenChange,
}: SessionSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { mutate: updateSessionName } = useUpdateSessionName();
  const setNewSessionCloseVoiceAssistant = useVoiceStore(
    (state) => state.setNewSessionCloseVoiceAssistant,
  );

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleRenameSave = async (newSessionId: string) => {
    setIsEditing(false);
    const trimmed = newSessionId.trim();
    if (!trimmed || trimmed === session) return;

    if (handleRename) {
      await handleRename(session, trimmed);
      updateVisibleSession(trimmed);
      if (
        selectedView?.type === "Session" &&
        selectedView?.id === session &&
        setSelectedView
      ) {
        setSelectedView({ type: "Session", id: trimmed });
      }
    } else {
      await updateSessionName(
        { old_session_id: session, new_session_id: trimmed },
        {
          onSuccess: () => {
            updateVisibleSession(trimmed);
            if (
              selectedView?.type === "Session" &&
              selectedView?.id === session &&
              setSelectedView
            ) {
              setSelectedView({ type: "Session", id: trimmed });
            }
          },
        },
      );
    }
  };

  const isDefaultSession = session === currentFlowId;
  const hasMessages = useSessionHasMessages({
    sessionId: session,
    flowId: currentFlowId,
  });
  const canModifySession = !isDefaultSession;
  const canDeleteSession = hasMessages;
  const canRenameSession = canModifySession && hasMessages;

  const displayName = getDisplayName(session, currentFlowId);

  return (
    <div
      data-testid="session-selector"
      onClick={(e) => {
        setNewSessionCloseVoiceAssistant(true);
        if (isEditing) e.stopPropagation();
        else toggleVisibility();
      }}
      className={cn(
        "group cursor-pointer rounded-lg text-left transition-all duration-150",
        isVisible
          ? "bg-primary/8 border border-primary/15"
          : "hover:bg-muted/50 border border-transparent",
      )}
    >
      <div className="flex h-9 items-center justify-between overflow-hidden w-full">
        <div className="flex w-full min-w-0 items-center gap-2 px-2.5">
          {/* Chat icon */}
          <ForwardedIconComponent
            name={isVisible ? "MessageSquare" : "MessageSquareDashed"}
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 transition-colors",
              isVisible ? "text-primary/70" : "text-muted-foreground/40",
            )}
          />

          {isEditing ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="w-full"
            >
              <SessionRename
                sessionId={session}
                onSave={handleRenameSave}
                onDone={() => {
                  setIsEditing(false);
                }}
              />
            </div>
          ) : (
            <ShadTooltip styleClasses="z-50" content={displayName}>
              <div className="relative w-full overflow-hidden">
                <span
                  className={cn(
                    "w-full truncate text-[13px] transition-colors",
                    isVisible
                      ? "font-medium text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {displayName}
                </span>
              </div>
            </ShadTooltip>
          )}
        </div>

        <SessionMoreMenu
          onRename={handleEditClick}
          onMessageLogs={() => inspectSession?.(session)}
          onDelete={() => deleteSession(session)}
          showRename={canRenameSession}
          showDelete={canDeleteSession}
          side="bottom"
          align="end"
          dataTestid={`session-${session}-more-menu`}
          sideOffset={4}
          contentClassName="z-[100] [&>div.p-1]:!h-auto [&>div.p-1]:!min-h-0"
          isVisible={true}
          tooltipContent="More options"
          tooltipSide="left"
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
        />
      </div>
    </div>
  );
}
