import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertCajaMovement, CajaMovement } from "@shared/schema";

export interface CajaMovementRow {
  id: string;
  source: "transaction" | "manual";
  type: "ingreso" | "egreso";
  amountUSD: number;
  originalAmount: number;
  originalCurrency: string;
  category: string;
  description: string;
  reference?: string;
  createdBy: string;
  createdAt: string;
}

export interface CajaSummary {
  movements: CajaMovementRow[];
  ingresosUSD: number;
  egresosUSD: number;
  saldoUSD: number;
  saldoAperturaUSD: number;
}

export function useCajaSummary() {
  return useQuery<CajaSummary>({
    queryKey: ["/api/caja/summary"],
    staleTime: 5000,
    refetchInterval: 15000,
  });
}

export function useCreateCajaMovement() {
  return useMutation({
    mutationFn: async (data: Omit<InsertCajaMovement, "createdBy">) => {
      const res = await apiRequest("POST", "/api/caja/movements", data);
      if (!res.ok) throw new Error("Error al registrar movimiento");
      return res.json() as Promise<CajaMovement>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caja/summary"] });
    },
  });
}
