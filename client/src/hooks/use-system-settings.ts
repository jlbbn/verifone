import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type SystemSettings, DEFAULT_SYSTEM_SETTINGS } from "@shared/schema";

export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
    staleTime: 5000,
    refetchInterval: 8000,
    placeholderData: DEFAULT_SYSTEM_SETTINGS,
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: async (patch: Partial<SystemSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings", patch);
      if (!res.ok) throw new Error("Error al guardar configuración");
      return res.json() as Promise<SystemSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}

export { DEFAULT_SYSTEM_SETTINGS };
export type { SystemSettings };
