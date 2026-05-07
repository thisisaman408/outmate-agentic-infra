// Hooks for the per-flow schedule (cron / interval) endpoint.
// Backend: GET / PUT / DELETE /api/v1/flows/{flow_id}/schedule
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";

export type ScheduleType = "manual" | "interval" | "cron";

export type FlowSchedule = {
  id: string;
  flow_id: string;
  schedule_type: ScheduleType;
  expression: string | null;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

const key = (flowId: string) => ["useFlowSchedule", flowId];

export const useGetFlowSchedule = (flowId: string | null | undefined) =>
  useQuery<FlowSchedule | null>({
    queryKey: key(flowId ?? ""),
    queryFn: async () => {
      if (!flowId) return null;
      const res = await api.get<FlowSchedule | null>(
        `/api/v1/flows/${flowId}/schedule`,
      );
      return res.data ?? null;
    },
    enabled: !!flowId,
    staleTime: 30_000,
  });

export const useUpsertFlowSchedule = (flowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      schedule_type: ScheduleType;
      expression?: string | null;
      enabled?: boolean;
    }) => {
      const res = await api.put<FlowSchedule>(
        `/api/v1/flows/${flowId}/schedule`,
        payload,
      );
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(key(flowId), data);
      qc.invalidateQueries({ queryKey: key(flowId) });
    },
  });
};

export const useDeleteFlowSchedule = (flowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/api/v1/flows/${flowId}/schedule`);
    },
    onSuccess: () => {
      qc.setQueryData(key(flowId), null);
      qc.invalidateQueries({ queryKey: key(flowId) });
    },
  });
};
