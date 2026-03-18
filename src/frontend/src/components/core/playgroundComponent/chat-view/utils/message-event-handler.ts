import type { Message } from "@/types/messages";
import { removeMessages, updateMessage } from "./message-utils";

/**
 * Handles message-related events from the build process.
 * This keeps all chat message logic within the chat-view scope.
 */
export const handleMessageEvent = (
  eventType: string,
  data: unknown,
): boolean => {
  const d = data as any;
  switch (eventType) {
    case "add_message": {
      // Add/update message in React Query cache (replaces placeholder if exists)
      updateMessage(d as Message);
      return true;
    }
    case "token": {
      // Update message text in React Query cache for streaming
      updateMessage({
        id: d.id,
        flow_id: d.flow_id || "",
        session_id: d.session_id || "",
        text: d.chunk || "",
        sender: d.sender || "Machine",
        sender_name: d.sender_name || "AI",
        timestamp: d.timestamp || new Date().toISOString(),
        files: d.files || [],
        edit: d.edit || false,
        background_color: d.background_color || "",
        text_color: d.text_color || "",
        properties: { ...d.properties, state: "partial" },
      } as Message);
      return true;
    }
    case "remove_message": {
      // Remove message from React Query cache
      removeMessages([d.id], d.session_id || "", d.flow_id || "");
      return true;
    }
    case "error": {
      if (d?.category === "error") {
        // Add error message to React Query cache
        updateMessage(d as Message);
      }
      return true;
    }
    default:
      // Not a message event, return false to indicate it wasn't handled
      return false;
  }
};
