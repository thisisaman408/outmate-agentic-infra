import type { AxiosResponse } from "axios";
import type { useQueryFunctionType } from "../../../../types/api";
import { api } from "../../api";
import { getURL } from "../../helpers/constants";
import { UseRequestProcessor } from "../../services/request-processor";

export type AgenticRunRow = {
  title: string;
  template: string;
  columns: Record<string, unknown>;
  sections: Record<string, string>;
};

export type AgenticRun = {
  run_id: string;
  status: "completed" | "failed";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  vertex_count: number;
  output_text: string;
  rows: AgenticRunRow[];
};

export type AgenticRunsResponse = {
  flow_id: string;
  flow_name: string;
  template: string;
  runs: AgenticRun[];
  fetched_at: string;
};

interface AgenticRunsParams {
  flowId: string;
  limit?: number;
}

export const useGetAgenticRunsQuery: useQueryFunctionType<
  AgenticRunsParams,
  AxiosResponse<AgenticRunsResponse>
> = (params) => {
  const { query } = UseRequestProcessor();

  const responseFn = async () => {
    const response = await api.get<AgenticRunsResponse>(
      `${getURL("AGENTIC_RUNS")}`,
      {
        params: { flow_id: params.flowId, limit: params.limit ?? 50 },
      },
    );
    return response;
  };

  return query(["useGetAgenticRunsQuery", params.flowId], responseFn, {
    enabled: !!params.flowId,
    refetchOnWindowFocus: false,
  });
};
