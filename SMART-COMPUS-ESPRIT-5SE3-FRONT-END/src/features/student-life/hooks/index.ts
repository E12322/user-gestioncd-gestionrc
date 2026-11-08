import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  getClub,
  getClubReport,
  listClubMembers,
  listClubs,
  listEvents,
  listMemberships,
  listMyMemberships,
  listMyRegistrations,
  type Viewer,
} from "../api";
import type { ClubFilters, EventFilters } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useClubs(filters: ClubFilters = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listClubs(filters, viewer, signal), [filters.q, filters.category, viewer.id]);
}

export function useClub(id: string) {
  const viewer = useViewer();
  return useQuery((signal) => getClub(id, viewer, signal), [id, viewer.id]);
}

export function useEvents(filters: EventFilters = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listEvents(filters, viewer, signal), [filters.clubId, viewer.id]);
}

export function useMemberships() {
  const viewer = useViewer();
  return useQuery((signal) => listMemberships(viewer, signal), [viewer.role]);
}

export function useMyMemberships() {
  const viewer = useViewer();
  return useQuery((signal) => listMyMemberships(viewer, signal), [viewer.id]);
}

export function useClubMembers(clubId: string) {
  const viewer = useViewer();
  return useQuery((signal) => listClubMembers(clubId, viewer, signal), [clubId, viewer.id]);
}

export function useClubReport(clubId: string, year: number) {
  const viewer = useViewer();
  return useQuery((signal) => getClubReport(clubId, year, viewer, signal), [clubId, year, viewer.id]);
}

export function useMyRegistrations() {
  const viewer = useViewer();
  return useQuery((signal) => listMyRegistrations(viewer, signal), [viewer.id]);
}
