import TopBar from "@/components/workflow/TopBar";
import SubTabs from "@/components/workflow/SubTabs";
import CoPilotPanel from "@/components/workflow/CoPilotPanel";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import ToolboxPanel from "@/components/workflow/ToolboxPanel";

export default function WorkflowBuilderPage() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "var(--wf-bg-page)", fontFamily: "Inter, sans-serif" }}>
      <TopBar />
      <SubTabs />
      <div className="flex flex-1 overflow-hidden">
        <CoPilotPanel />
        <WorkflowCanvas />
        <ToolboxPanel />
      </div>
    </div>
  );
}
