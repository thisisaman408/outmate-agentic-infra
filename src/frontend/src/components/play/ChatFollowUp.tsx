import { Send } from "lucide-react";
import { useState } from "react";

interface ChatFollowUpProps {
  sendMessage: (params: { inputValue: string; files?: string[] }) => Promise<void>;
}

export default function ChatFollowUp({ sendMessage }: ChatFollowUpProps) {
  const [value, setValue] = useState("");

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    await sendMessage({ inputValue: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a follow-up question..."
        className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim()}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-all hover:shadow-md"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
