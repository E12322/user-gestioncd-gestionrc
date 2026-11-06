import { useQuery } from "@/shared/api/useQuery";
import { getLoginHistory, getPermissions, getUser, listUsers } from "../api";
import type { LoginHistoryFilters, UserFilters } from "../types";

export const useUsers = (filters: UserFilters) =>
  useQuery((signal) => listUsers(filters, signal), [filters.q, filters.role, filters.status]);

export const useUser = (id: string) => useQuery((signal) => getUser(id, signal), [id]);

export const useLoginHistory = (filters: LoginHistoryFilters) =>
  useQuery((signal) => getLoginHistory(filters, signal), [filters.userId, filters.result]);

export const usePermissions = () => useQuery((signal) => getPermissions(signal));
