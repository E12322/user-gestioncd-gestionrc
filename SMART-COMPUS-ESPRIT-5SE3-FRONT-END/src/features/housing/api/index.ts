import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db } from "../mocks";
import { MONTANT_MENSUEL_PAR_TYPE, capaciteValide } from "../types";
import type {
  Chambre,
  ChambreFilter,
  ChambreInput,
  Contrat,
  ContratStatut,
  Demande,
  DemandeInput,
  DemandeStatut,
  Ticket,
  TicketInput,
  TicketStatus,
} from "../types";

/**
 * Client du microservice Résidences (via l'API Gateway en production).
 * Les fonctions appellent les routes NestJS (/chambres, /demandes, /contrats)
 * et, tant que VITE_USE_MOCKS ≠ "false", une implémentation en mémoire joue
 * les mêmes règles métier (occupation atomique, transitions, contrats).
 *
 * Erreurs : 403 interdit · 404 introuvable · 409 conflit · 422 saisie invalide.
 */

export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "housing-service";

const svc = (viewer: Viewer) => {
  assertAvailable("housing");
  if (viewer.role === "teacher") throw new ApiError(403, "Accès interdit aux enseignants");
};
const adminOnly = (viewer: Viewer) => {
  svc(viewer);
  if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
};
const studentOnly = (viewer: Viewer) => {
  svc(viewer);
  if (viewer.role !== "student") throw new ApiError(403, "Réservé aux étudiants");
};

const clone = <T>(x: T): T => structuredClone(x);

const qs = (params: Record<string, string | boolean | undefined>) => {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

// ---------------------------------------------------------------------------
// Règles métier partagées (mocks)
// ---------------------------------------------------------------------------

const findChambre = (id: string): Chambre => {
  const chambre = db.chambres.find((c) => c.id === id);
  if (!chambre) throw new ApiError(404, "Chambre introuvable");
  return chambre;
};

const findDemande = (id: string): Demande => {
  const demande = db.demandes.find((d) => d.id === id);
  if (!demande) throw new ApiError(404, "Demande introuvable");
  return demande;
};

const assertUniqueChambre = (batiment: string, numero: string, ignoreId?: string) => {
  const exists = db.chambres.some((c) => c.batiment === batiment && c.numero === numero && c.id !== ignoreId);
  if (exists) throw new ApiError(409, `La chambre ${numero} du ${batiment} existe déjà`);
};

const assertCapaciteCoherente = (type: ChambreInput["type"], capacite: number) => {
  if (!capaciteValide(type, capacite)) {
    throw new ApiError(422, `Capacité ${capacite} invalide pour une chambre de type ${type}`);
  }
};

const assertDatesValides = (dateArrivee: string, dateDepart: string) => {
  if (dateArrivee >= dateDepart) {
    throw new ApiError(422, "La date d'arrivée doit être strictement antérieure à la date de départ");
  }
};

const assertDansAnneeAcademique = (dateArrivee: string, dateDepart: string) => {
  const finAnnee = academicYearEnd(dateArrivee);
  if (dateDepart > finAnnee) {
    throw new ApiError(422, `La date de départ dépasse la fin de l'année académique (${finAnnee})`);
  }
};

/** Fin de l'année académique (31 juillet) associée au début du contrat. */
const academicYearEnd = (dateDebut: string): string => {
  const [year, month] = dateDebut.split("-").map(Number);
  return month >= 8 ? `${year + 1}-07-31` : `${year}-07-31`;
};

const TRANSITIONS: Record<DemandeStatut, DemandeStatut[]> = {
  EN_ATTENTE: ["APPROUVEE", "REFUSEE", "ANNULEE"],
  APPROUVEE: ["ANNULEE"],
  REFUSEE: [],
  ANNULEE: [],
};

const occuper = (chambre: Chambre) => {
  if (!chambre.disponible) {
    throw new ApiError(409, `La chambre ${chambre.numero} est déjà occupée`, {
      code: "ROOM_FULL",
      conflicts: [`${chambre.batiment} — chambre ${chambre.numero}`],
    });
  }
  chambre.disponible = false;
  chambre.updatedAt = db.now();
};

const liberer = (chambreId: string) => {
  const chambre = db.chambres.find((c) => c.id === chambreId);
  if (chambre) {
    chambre.disponible = true;
    chambre.updatedAt = db.now();
  }
};

const creerContrat = (demande: Demande, chambre: Chambre): Contrat => {
  const existant = db.contrats.find((k) => k.demandeId === demande.id);
  if (existant) return existant;

  assertDatesValides(demande.dateArrivee, demande.dateDepart);
  const finAnnee = academicYearEnd(demande.dateArrivee);
  if (demande.dateDepart > finAnnee) {
    throw new ApiError(422, `La date de fin dépasse la fin de l'année académique (${finAnnee})`);
  }

  const contrat: Contrat = {
    id: db.nextId("k"),
    residentId: demande.etudiantId,
    chambreId: chambre.id,
    demandeId: demande.id,
    dateDebut: demande.dateArrivee,
    dateFin: demande.dateDepart,
    montantMensuel: MONTANT_MENSUEL_PAR_TYPE[chambre.type],
    statut: "ACTIF",
    createdAt: db.now(),
    updatedAt: db.now(),
  };
  db.contrats.unshift(contrat);
  return contrat;
};

const resilierContratInterne = (contrat: Contrat) => {
  if (contrat.statut !== "ACTIF") {
    throw new ApiError(409, `Le contrat n'est pas actif (statut : ${contrat.statut})`);
  }
  contrat.statut = "RESILIE";
  contrat.updatedAt = db.now();
  liberer(contrat.chambreId);
};

// ---------------------------------------------------------------------------
// Chambres — GET/POST/PATCH/DELETE /chambres
// ---------------------------------------------------------------------------

const byBatimentNumero = (a: Chambre, b: Chambre) => a.batiment.localeCompare(b.batiment, "fr") || a.numero.localeCompare(b.numero, "fr");

const matchesFilter = (c: Chambre, f: ChambreFilter) =>
  (f.type === undefined || c.type === f.type) &&
  (f.batiment === undefined || c.batiment === f.batiment) &&
  (f.disponible === undefined || c.disponible === f.disponible);

/** GET /chambres */
export const listChambres = (filter: ChambreFilter, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Chambre[]>(`/chambres${qs({ type: filter.type, batiment: filter.batiment, disponible: filter.disponible })}`, {
    signal,
    mock: () => {
      svc(viewer);
      return clone(db.chambres.filter((c) => matchesFilter(c, filter)).sort(byBatimentNumero));
    },
  });

/** GET /chambres/disponibles */
export const listChambresDisponibles = (filter: ChambreFilter, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Chambre[]>(`/chambres/disponibles${qs({ type: filter.type, batiment: filter.batiment })}`, {
    signal,
    mock: () => {
      svc(viewer);
      return clone(db.chambres.filter((c) => matchesFilter(c, { ...filter, disponible: true })).sort(byBatimentNumero));
    },
  });

/** POST /chambres (administrateur) */
export const createChambre = (input: ChambreInput, viewer: Viewer) =>
  api.post<Chambre>("/chambres", {
    body: input,
    mock: () => {
      adminOnly(viewer);
      assertCapaciteCoherente(input.type, input.capacite);
      assertUniqueChambre(input.batiment, input.numero);
      const chambre: Chambre = {
        ...input,
        disponible: input.disponible ?? true,
        id: db.nextId("ch"),
        createdAt: db.now(),
        updatedAt: db.now(),
      };
      db.chambres.push(chambre);
      return clone(chambre);
    },
  });

/** PATCH /chambres/{id} (administrateur) */
export const updateChambre = (id: string, patch: Partial<ChambreInput>, viewer: Viewer) =>
  api.patch<Chambre>(`/chambres/${id}`, {
    body: patch,
    mock: () => {
      adminOnly(viewer);
      const chambre = findChambre(id);
      const type = patch.type ?? chambre.type;
      const capacite = patch.capacite ?? chambre.capacite;
      assertCapaciteCoherente(type, capacite);
      if (patch.batiment !== undefined || patch.numero !== undefined) {
        assertUniqueChambre(patch.batiment ?? chambre.batiment, patch.numero ?? chambre.numero, id);
      }
      Object.assign(chambre, patch, { updatedAt: db.now() });
      return clone(chambre);
    },
  });

/** DELETE /chambres/{id} (administrateur) */
export const deleteChambre = (id: string, viewer: Viewer) =>
  api.delete<void>(`/chambres/${id}`, {
    mock: () => {
      adminOnly(viewer);
      const chambre = findChambre(id);
      db.chambres.splice(db.chambres.indexOf(chambre), 1);
    },
  });

// ---------------------------------------------------------------------------
// Demandes — /demandes
// ---------------------------------------------------------------------------

/** GET /demandes — l'étudiant ne voit que les siennes, l'admin toutes. */
export const listDemandes = (
  filter: { statut?: DemandeStatut; chambreId?: string; etudiantId?: string },
  viewer: Viewer,
  signal?: AbortSignal,
) => {
  const etudiantId = viewer.role === "admin" ? filter.etudiantId : viewer.id;
  return api.get<Demande[]>(`/demandes${qs({ statut: filter.statut, chambreId: filter.chambreId, etudiantId })}`, {
    signal,
    mock: () => {
      svc(viewer);
      return clone(
        db.demandes
          .filter((d) => (filter.statut === undefined || d.statut === filter.statut) && (!etudiantId || d.etudiantId === etudiantId))
          .sort((a, b) => b.dateDepot.localeCompare(a.dateDepot)),
      );
    },
  });
};

/** GET /demandes/{id} */
export const getDemande = (id: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Demande>(`/demandes/${id}`, {
    signal,
    mock: () => {
      svc(viewer);
      return clone(findDemande(id));
    },
  });

/** POST /demandes — publie DemandeDéposée. */
export const createDemande = (input: DemandeInput, viewer: Viewer) =>
  api.post<Demande>("/demandes", {
    body: input,
    mock: () => {
      studentOnly(viewer);
      assertDatesValides(input.dateArrivee, input.dateDepart);
      assertDansAnneeAcademique(input.dateArrivee, input.dateDepart);
      const active = db.demandes.find((d) => d.etudiantId === input.etudiantId && (d.statut === "EN_ATTENTE" || d.statut === "APPROUVEE"));
      if (active) {
        throw new ApiError(
          409,
          `Une demande ${active.statut === "EN_ATTENTE" ? "est déjà en attente" : "est déjà approuvée"} pour cet étudiant (une seule chambre à la fois)`,
        );
      }
      if (input.chambreId) findChambre(input.chambreId);

      const demande: Demande = {
        id: db.nextId("d"),
        etudiantId: input.etudiantId,
        statut: "EN_ATTENTE",
        dateDepot: db.now(),
        dateArrivee: input.dateArrivee,
        dateDepart: input.dateDepart,
        chambreId: input.chambreId ?? null,
        createdAt: db.now(),
        updatedAt: db.now(),
      };
      db.demandes.unshift(demande);
      publishDomainEvent(SERVICE, "DemandeDéposée", `${viewer.name} · arrivée le ${input.dateArrivee}`);
      return clone(demande);
    },
  });

/**
 * PATCH /demandes/{id}/statut — approbation : occupe la chambre, crée le contrat
 * (événements DemandeApprouvée + ContratCréé). Annulation d'une demande
 * approuvée : libère la chambre et résilie le contrat.
 */
export const updateDemandeStatut = (id: string, statut: DemandeStatut, chambreId: string | undefined, viewer: Viewer) =>
  api.patch<Demande>(`/demandes/${id}/statut`, {
    body: { statut, ...(chambreId ? { chambreId } : {}) },
    mock: () => {
      svc(viewer);
      const demande = findDemande(id);

      if (statut === demande.statut) throw new ApiError(409, `La demande est déjà au statut ${statut}`);
      if (!TRANSITIONS[demande.statut].includes(statut)) throw new ApiError(409, `Transition ${demande.statut} → ${statut} non autorisée`);

      if (statut === "APPROUVEE") {
        adminOnly(viewer);
        const cibleId = chambreId ?? demande.chambreId;
        if (!cibleId) throw new ApiError(422, "Une chambre est requise pour approuver la demande");
        const chambre = findChambre(cibleId);
        occuper(chambre);
        demande.statut = "APPROUVEE";
        demande.chambreId = chambre.id;
        demande.updatedAt = db.now();
        const contrat = creerContrat(demande, chambre);
        publishDomainEvent(SERVICE, "DemandeApprouvée", `${demande.etudiantId} · chambre ${chambre.numero}`);
        publishDomainEvent(SERVICE, "ContratCréé", `${contrat.id} · ${contrat.montantMensuel} DT/mois`);
        return clone(demande);
      }

      if (chambreId) throw new ApiError(422, "chambreId ne peut être fourni que pour une approbation");

      const ancienStatut = demande.statut;
      if (statut === "REFUSEE" || statut === "ANNULEE") {
        if (viewer.role !== "admin" && demande.etudiantId !== viewer.id) throw new ApiError(403, "Cette demande n'est pas la vôtre");
      }

      demande.statut = statut;
      demande.updatedAt = db.now();

      if (statut === "ANNULEE" && ancienStatut === "APPROUVEE" && demande.chambreId) {
        liberer(demande.chambreId);
        const contrat = db.contrats.find((k) => k.demandeId === demande.id);
        if (contrat && contrat.statut === "ACTIF") {
          contrat.statut = "RESILIE";
          contrat.updatedAt = db.now();
          publishDomainEvent(SERVICE, "ContratRésilié", contrat.id);
        }
      }

      publishDomainEvent(SERVICE, statut === "REFUSEE" ? "DemandeRefusée" : "DemandeAnnulée", demande.etudiantId);
      return clone(demande);
    },
  });

/** Annulation par l'étudiant (EN_ATTENTE ou APPROUVEE) ou refus par l'admin. */
export const cancelDemande = (id: string, viewer: Viewer) => updateDemandeStatut(id, "ANNULEE", undefined, viewer);
export const refuseDemande = (id: string, viewer: Viewer) => updateDemandeStatut(id, "REFUSEE", undefined, viewer);
export const approveDemande = (id: string, chambreId: string, viewer: Viewer) => updateDemandeStatut(id, "APPROUVEE", chambreId, viewer);

// ---------------------------------------------------------------------------
// Contrats — /contrats
// ---------------------------------------------------------------------------

/** GET /contrats (administrateur, filtres optionnels) */
export const listContrats = (
  filter: { statut?: ContratStatut; residentId?: string; chambreId?: string },
  viewer: Viewer,
  signal?: AbortSignal,
) =>
  api.get<Contrat[]>(`/contrats${qs(filter)}`, {
    signal,
    mock: () => {
      adminOnly(viewer);
      return clone(
        db.contrats
          .filter(
            (k) =>
              (filter.statut === undefined || k.statut === filter.statut) &&
              (filter.residentId === undefined || k.residentId === filter.residentId),
          )
          .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut)),
      );
    },
  });

/** GET /contrats/resident/{residentId} */
export const listContratsResident = (residentId: string, statut: ContratStatut | undefined, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Contrat[]>(`/contrats/resident/${encodeURIComponent(residentId)}${qs({ statut })}`, {
    signal,
    mock: () => {
      svc(viewer);
      if (viewer.role !== "admin" && viewer.id !== residentId) throw new ApiError(403, "Ces contrats ne sont pas les vôtres");
      return clone(
        db.contrats
          .filter((k) => k.residentId === residentId && (statut === undefined || k.statut === statut))
          .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut)),
      );
    },
  });

/** GET /contrats/{id} */
export const getContrat = (id: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Contrat>(`/contrats/${id}`, {
    signal,
    mock: () => {
      svc(viewer);
      const contrat = db.contrats.find((k) => k.id === id);
      if (!contrat) throw new ApiError(404, "Contrat introuvable");
      return clone(contrat);
    },
  });

/** PATCH /contrats/{id}/resilier — libère aussi la chambre. */
export const resilierContrat = (id: string, viewer: Viewer) =>
  api.patch<Contrat>(`/contrats/${id}/resilier`, {
    mock: () => {
      adminOnly(viewer);
      const contrat = db.contrats.find((k) => k.id === id);
      if (!contrat) throw new ApiError(404, "Contrat introuvable");
      resilierContratInterne(contrat);
      publishDomainEvent(SERVICE, "ContratRésilié", `${contrat.id} · chambre libérée`);
      return clone(contrat);
    },
  });

// ---------------------------------------------------------------------------
// Maintenance — service mocké, hors périmètre des 3 microservices backend.
// La route /tickets n'est pas dans VITE_REAL_API_PREFIXES : le client la sert
// toujours via le mock ci-dessous, même quand les autres routes passent en réel.
// ---------------------------------------------------------------------------

/** GET /tickets — l'étudiant voit les siens, l'administrateur tous. */
export const listTickets = (viewer: Viewer, signal?: AbortSignal) => {
  return api.get<Ticket[]>("/tickets", {
    signal,
    mock: () => {
      svc(viewer);
      return clone(
        db.tickets
          .filter((t) => viewer.role === "admin" || t.studentId === viewer.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
  });
};

/** POST /tickets — signalement d'une panne. */
export const createTicket = (input: TicketInput, viewer: Viewer) => {
  return api.post<Ticket>("/tickets", {
    body: input,
    mock: () => {
      svc(viewer);
      const now = db.now();
      const created: Ticket = {
        id: db.nextId("t"),
        studentId: viewer.id,
        studentName: viewer.name,
        batiment: input.batiment,
        location: input.location.trim(),
        category: input.category,
        description: input.description.trim(),
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      db.tickets.unshift(created);
      return clone(created);
    },
  });
};

/** PUT /tickets/{id}/status (administrateur) — Signalé → En cours → Résolu. */
export const updateTicketStatus = (id: string, status: TicketStatus, viewer: Viewer) => {
  return api.put<Ticket>(`/tickets/${id}/status`, {
    body: { status },
    mock: () => {
      adminOnly(viewer);
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) throw new ApiError(404, "Signalement introuvable");
      ticket.status = status;
      ticket.updatedAt = db.now();
      return clone(ticket);
    },
  });
};
