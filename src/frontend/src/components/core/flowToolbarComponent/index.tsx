import { track } from "@/customization/utils/analytics";
import { usePlaygroundStore } from "@/stores/playgroundStore";
import { Panel } from "@xyflow/react";
import { memo, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import useFlowStore from "../../../stores/flowStore";
import { useShortcutsStore } from "../../../stores/shortcuts";
import { cn, isThereModal } from "../../../utils/utils";
import FlowToolbarOptions from "./components/flow-toolbar-options";

const FlowToolbar = memo(function FlowToolbar(): JSX.Element {
  const preventDefault = true;
  const isPlaygroundOpen = usePlaygroundStore((state) => state.isOpen);
  const setPlaygroundOpen = usePlaygroundStore((state) => state.setIsOpen);

  const handleChatWShortcut = (e: KeyboardEvent) => {
    if (isThereModal() && !isPlaygroundOpen) return;
    if (useFlowStore.getState().hasIO) {
      setPlaygroundOpen(!isPlaygroundOpen);
    }
  };

  const openPlayground = useShortcutsStore((state) => state.openPlayground);

  useHotkeys(openPlayground, handleChatWShortcut, { preventDefault });

  useEffect(() => {
    if (isPlaygroundOpen) {
      track("Playground Button Clicked");
    }
  }, [isPlaygroundOpen]);

  return (
    <>
      <Panel className="!top-auto !m-2" position="top-right">
        <div
          className={cn(
            "hover:shadow-round-btn-shadow flex h-11 items-center justify-center gap-7 rounded-md border bg-background px-1.5 shadow transition-all",
          )}
        >
          <FlowToolbarOptions />
        </div>
      </Panel>
    </>
  );
});

export default FlowToolbar;
