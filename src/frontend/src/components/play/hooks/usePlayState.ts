import { useCallback, useState } from "react";

export type PlayState = "form" | "running" | "dashboard";

export interface PlayStateHook {
  state: PlayState;
  startRun: () => void;
  finishRun: (output: string) => void;
  reset: () => void;
  agentOutput: string;
}

export function usePlayState(): PlayStateHook {
  const [state, setState] = useState<PlayState>("form");
  const [agentOutput, setAgentOutput] = useState("");

  const startRun = useCallback(() => {
    setAgentOutput("");
    setState("running");
  }, []);

  const finishRun = useCallback((output: string) => {
    setAgentOutput(output);
    setState("dashboard");
  }, []);

  const reset = useCallback(() => {
    setAgentOutput("");
    setState("form");
  }, []);

  return { state, startRun, finishRun, reset, agentOutput };
}
