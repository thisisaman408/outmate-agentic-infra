// Real-time integration connection status from the agentic backend.
// Backend: GET /api/v1/integrations/status
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";

export type IntegrationStatus = {
  id: string;
  name: string;
  category: string;
  sub_label: string | null;
  connected: boolean;
};

export const useIntegrationsStatus = () =>
  useQuery<IntegrationStatus[]>({
    queryKey: ["useIntegrationsStatus"],
    queryFn: async () => {
      const res = await api.get<IntegrationStatus[]>(
        "/api/v1/integrations/status",
      );
      return res.data ?? [];
    },
    staleTime: 60_000,
  });
