import { useEffect, useRef, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/controllers/API/api";
import { getURL } from "@/controllers/API/helpers/constants";
import useAlertStore from "@/stores/alertStore";
import useFlowStore from "@/stores/flowStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import { cn } from "@/utils/utils";

type ChatTurn = {
  role: "user" | "assistant" | "error";
  text: string;
};

const SUGGESTIONS = [
  "Run the agent on Acme Corp / Jane Smith",
  "What does this workflow do, end-to-end?",
  "Which tools does the agent have access to?",
  "Run with sample input and show the output",
];

// Pull a human-readable text answer out of Langflow's RunResponse shape.
// Langflow nests messages a few different ways depending on component type.
const extractAssistantText = (result: any): string => {
  if (!result) return "";
  const outputs = result?.outputs;
  if (Array.isArray(outputs)) {
    for (const o of outputs) {
      const inner = o?.outputs;
      if (!Array.isArray(inner)) continue;
      for (const i of inner) {
        const direct = i?.results?.message?.text ?? i?.results?.text;
        if (typeof direct === "string" && direct.trim()) return direct;
        const msg = i?.messages?.[0]?.message ?? i?.messages?.[0]?.text;
        if (typeof msg === "string" && msg.trim()) return msg;
      }
    }
  }
  if (typeof result?.message === "string") return result.message;
  if (typeof result?.text === "string") return result.text;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};

const CopilotTab = () => {
  const currentFlow = useFlowStore((s) => s.currentFlow);
  const currentSavedFlow = useFlowsManagerStore((s) => s.currentFlow);
  const flow = currentSavedFlow ?? currentFlow;
  const setErrorData = useAlertStore((s) => s.setErrorData);

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages or busy-state change.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const flowName = flow?.name ?? "this workflow";
  const agentName = (() => {
    const nodes = (flow?.data?.nodes ?? []) as any[];
    const agent = nodes.find((n: any) => {
      const t = String(
        n?.data?.type ?? n?.data?.node?.display_name ?? "",
      ).toLowerCase();
      return /agent/.test(t);
    });
    return (
      agent?.data?.node?.display_name ??
      agent?.data?.type ??
      null
    );
  })();

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !flow) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const target = flow.endpoint_name || flow.id;
      const resp = await api.post(
        getURL("RUN_SESSION", { flowIdOrName: target }),
        {
          input_value: trimmed,
          input_type: "chat",
          output_type: "chat",
          stream: false,
        },
      );
      const replyText = extractAssistantText(resp?.data);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: replyText || "(no output produced)",
        },
      ]);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ?? err?.message ?? "request failed";
      setMessages((prev) => [
        ...prev,
        { role: "error", text: String(detail) },
      ]);
      setErrorData({ title: "Co-pilot run failed", list: [String(detail)] });
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const headline = agentName
    ? `Chat with ${agentName}`
    : `Chat with ${flowName}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ForwardedIconComponent
              name="Sparkles"
              className="h-5 w-5 text-amber-300"
            />
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-bold tracking-tight">{headline}</h2>
            <p className="text-xs text-muted-foreground">
              Sends a real run to{" "}
              <code className="rounded bg-muted/40 px-1 py-0.5 text-[11px]">
                /api/v1/run/{flow?.endpoint_name || flow?.id || "…"}
              </code>{" "}
              and shows the agent's reply.
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-auto px-6 py-6"
        data-testid="copilot-thread"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ask {agentName ? agentName : "the workflow"} anything — the
              message is sent as input and the response from the run is shown
              below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-full border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  data-testid={`copilot-suggestion-${s
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex w-full",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-2.5 text-sm",
                    m.role === "user" &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-100",
                    m.role === "assistant" &&
                      "border-border/40 bg-card/60 text-foreground",
                    m.role === "error" &&
                      "border-rose-500/30 bg-rose-500/10 text-rose-200",
                  )}
                  data-testid={`copilot-msg-${m.role}`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/40 bg-card/60 px-4 py-2.5 text-sm text-muted-foreground">
                  <ForwardedIconComponent
                    name="Loader2"
                    className="h-3.5 w-3.5 animate-spin"
                  />
                  Running workflow…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/40 px-6 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 rounded-2xl border border-border/40 bg-card/50 p-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              busy
                ? "Waiting for the previous run to finish…"
                : "Ask the agent anything — Enter to send, Shift+Enter for newline."
            }
            disabled={busy}
            className="min-h-[80px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
            data-testid="copilot-prompt"
          />
          <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {agentName ? `Connected to ${agentName}` : "Powered by Outmate AI"}
            </span>
            <Button
              size="sm"
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className={cn(
                "gap-1.5 bg-amber-500 font-semibold text-amber-950 hover:bg-amber-400",
              )}
              data-testid="copilot-send"
            >
              {busy ? "Running…" : "Send"}
              <ForwardedIconComponent name="ArrowRight" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopilotTab;
