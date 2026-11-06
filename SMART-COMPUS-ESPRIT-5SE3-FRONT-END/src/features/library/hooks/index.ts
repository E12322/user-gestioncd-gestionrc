import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import { getBook, getMyLibrary, listBooks, listLoans, type Viewer } from "../api";
import type { BookFilters } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useBooks(filters: BookFilters = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listBooks(filters, viewer, signal), [filters.q, filters.category, filters.availableOnly, viewer.id]);
}

export function useBook(id: string) {
  const viewer = useViewer();
  return useQuery((signal) => getBook(id, viewer, signal), [id, viewer.id]);
}

export function useMyLibrary() {
  const viewer = useViewer();
  return useQuery((signal) => getMyLibrary(viewer, signal), [viewer.id, viewer.role]);
}

export function useLoans() {
  const viewer = useViewer();
  return useQuery((signal) => listLoans(viewer, signal), [viewer.role]);
}
