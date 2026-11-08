import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import { listChambres, listChambresDisponibles, listContrats, listContratsResident, listDemandes, listTickets, type Viewer } from "../api";
import type { ChambreFilter, ContratStatut, DemandeStatut } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useChambres(filter: ChambreFilter = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listChambres(filter, viewer, signal), [viewer.role, filter.type, filter.batiment, filter.disponible]);
}

export function useChambresDisponibles(filter: ChambreFilter = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listChambresDisponibles(filter, viewer, signal), [viewer.role, filter.type, filter.batiment]);
}

/** Demandes visibles par l'utilisateur : les siennes (étudiant) ou toutes (admin). */
export function useDemandes(filter: { statut?: DemandeStatut } = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listDemandes(filter, viewer, signal), [viewer.id, viewer.role, filter.statut]);
}

export function useMesDemandes() {
  const viewer = useViewer();
  return useQuery((signal) => listDemandes({}, viewer, signal), [viewer.id, viewer.role]);
}

/** Tous les contrats (vue administrateur). */
export function useContrats(filter: { statut?: ContratStatut } = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listContrats(filter, viewer, signal), [viewer.role, filter.statut]);
}

/** Contrats du résident courant. */
export function useMesContrats() {
  const viewer = useViewer();
  return useQuery((signal) => listContratsResident(viewer.id, undefined, viewer, signal), [viewer.id, viewer.role]);
}

/** Tous les contrats (admin) ou ceux du résident courant (étudiant). */
export function useContratsVisibles() {
  const viewer = useViewer();
  return useQuery(
    (signal) => (viewer.role === "admin" ? listContrats({}, viewer, signal) : listContratsResident(viewer.id, undefined, viewer, signal)),
    [viewer.id, viewer.role],
  );
}

export function useTickets() {
  const viewer = useViewer();
  return useQuery((signal) => listTickets(viewer, signal), [viewer.id, viewer.role]);
}
