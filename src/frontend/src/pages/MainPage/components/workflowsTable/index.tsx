import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FlowType } from "@/types/flow";
import WorkflowsTableRow from "./row";

type WorkflowsTableProps = {
  flows: FlowType[];
  onCreate: () => void;
};

const COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "toggle", label: "OFF / ON", className: "w-14" },
  { key: "name", label: "NAME", className: "min-w-[200px]" },
  { key: "status", label: "STATUS" },
  { key: "actions", label: "ACTIONS" },
  { key: "target", label: "TARGET" },
  { key: "trigger", label: "TRIGGER" },
  { key: "in_progress", label: "IN PROGRESS" },
  { key: "completed", label: "COMPLETED" },
  { key: "failed", label: "FAILED" },
  { key: "owner", label: "OWNER" },
  { key: "folder", label: "FOLDER" },
  { key: "last_run", label: "LAST RUN" },
  { key: "next_run", label: "NEXT RUN" },
  { key: "menu", label: "", className: "w-12" },
];

const WorkflowsTable = ({ flows, onCreate }: WorkflowsTableProps) => {
  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  className={`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 ${
                    c.className ?? ""
                  }`}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>No workflows yet.</span>
                    <Button
                      size="sm"
                      onClick={onCreate}
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      Create your first workflow
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              flows.map((flow) => (
                <WorkflowsTableRow key={flow.id} flow={flow} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default WorkflowsTable;
