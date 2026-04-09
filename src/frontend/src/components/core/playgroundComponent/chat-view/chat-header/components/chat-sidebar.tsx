import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import useFlowStore from "@/stores/flowStore";
import { useGetFlowId } from "../../../hooks/use-get-flow-id";
import { useEditSessionInfo } from "../hooks/use-edit-session-info";
import { SessionSelector } from "./session-selector";

interface ChatSidebarProps {
  sessions: string[];
  onNewChat?: () => void;
  onSessionSelect?: (sessionId: string) => void;
  currentSessionId?: string;
  onDeleteSession?: (sessionId: string) => void;
  onOpenLogs?: (sessionId: string) => void;
  renameLocalSession?: (oldSessionId: string, newSessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  onNewChat,
  onSessionSelect,
  currentSessionId,
  onDeleteSession,
  onOpenLogs,
  renameLocalSession,
}: ChatSidebarProps) {
  const [openMenuSession, setOpenMenuSession] = useState<string | null>(null);
  const currentFlowId = useGetFlowId();
  const isShareablePlayground = useFlowStore((state) => state.playgroundPage);
  const { handleDelete, handleRename } = useEditSessionInfo({
    flowId: currentFlowId,
    renameLocalSession,
  });

  const sessionIds = useMemo(() => sessions, [sessions]);

  const visibleSession = currentSessionId;

  const handleDeleteSession = (session: string) => {
    onDeleteSession?.(session);
  };

  const handleSessionClick = (session: string) => {
    onSessionSelect?.(session);
  };

  return (
    <div className="flex flex-col pb-4 gap-3">
      {/* Header with new chat button */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <ForwardedIconComponent
            name="MessagesSquare"
            className="h-3.5 w-3.5 text-muted-foreground/60"
          />
          <span className="text-xs font-semibold text-muted-foreground">
            Chats
          </span>
        </div>
        <ShadTooltip
          styleClasses="z-50"
          content="New Chat"
          side={isShareablePlayground ? "bottom" : "top"}
        >
          <Button
            data-testid="new-chat"
            variant="ghost"
            className="flex h-7 w-7 items-center justify-center !p-0 rounded-lg hover:bg-primary/10 transition-colors"
            onClick={onNewChat}
          >
            <ForwardedIconComponent
              name="Plus"
              className="h-4 w-4 text-primary/70"
            />
          </Button>
        </ShadTooltip>
      </div>

      {/* Session list */}
      {sessionIds.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
            <ForwardedIconComponent
              name="MessageSquarePlus"
              className="h-5 w-5 text-muted-foreground/40"
            />
          </div>
          <span className="text-xs text-muted-foreground/60">
            No chats yet. Start a new one!
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {sessionIds.map((session) => (
            <SessionSelector
              key={session}
              session={session}
              currentFlowId={currentFlowId}
              deleteSession={handleDeleteSession}
              toggleVisibility={() => handleSessionClick(session)}
              isVisible={visibleSession === session}
              updateVisibleSession={handleSessionClick}
              inspectSession={onOpenLogs}
              handleRename={handleRename}
              setActiveSession={() => {
                // TODO: Implement active session
              }}
              selectedView={undefined}
              setSelectedView={() => {}}
              playgroundPage={true}
              menuOpen={openMenuSession === session}
              onMenuOpenChange={(open) => {
                setOpenMenuSession(open ? session : null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
