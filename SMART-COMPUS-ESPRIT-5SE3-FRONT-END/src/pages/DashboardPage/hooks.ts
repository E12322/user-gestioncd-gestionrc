import { api } from "@/shared/api/client";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import { buildDashboard } from "./mock";
import type { DashboardData } from "./types";

export function useDashboard() {
  const { role } = useAuth();
  return useQuery((signal) => api.get<DashboardData>("/dashboard", { signal, mock: () => buildDashboard(role) }), [role]);
}
