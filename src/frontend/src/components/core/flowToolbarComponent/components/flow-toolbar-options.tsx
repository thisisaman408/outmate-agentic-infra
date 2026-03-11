import IconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import ApiModal from "@/modals/apiModal";
import useFlowStore from "@/stores/flowStore";
import PlaygroundButton from "./playground-button";

const FlowToolbarOptions = () => {
  const hasIO = useFlowStore((state) => state.hasIO);

  return (
    <div className="flex items-center gap-1">
      <ApiModal>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-3 text-sm font-medium"
          data-testid="api-button"
        >
          <IconComponent name="Code2" className="h-4 w-4" />
          API
        </Button>
      </ApiModal>
      <PlaygroundButton hasIO={hasIO} />
    </div>
  );
};

export default FlowToolbarOptions;
