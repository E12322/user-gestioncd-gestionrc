import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { normalize } from "@/shared/lib/format";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db, LOAN_RULES, type StoredLoan } from "../mocks";
import { addDays, diffDays, shiftDate, todayISO } from "../utils/time";
import { MAX_RENEWALS } from "../types";
import type { Book, BookFilters, BookInput, BookReservation, BookView, Loan, MyLibrary } from "../types";

/**
 * Stubs du library-service (via l'API Gateway). En production l'identité vient du JWT ;
 * en mock elle est passée explicitement (`Viewer`).
 * Erreurs : 403 interdit · 404 introuvable · 409 règle de prêt (indisponible, retard, plafond, doublon).
 */
export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "library-service";
const svc = () => assertAvailable("library");
const adminOnly = (viewer: Viewer) => {
  svc();
  if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
};
const clone = <T>(x: T): T => structuredClone(x);
const conflict = (message: string, code: string, conflicts: string[] = []) => new ApiError(409, message, { code, conflicts });

function bookById(id: string): Book {
  const b = db.books.find((x) => x.id === id);
  if (!b) throw new ApiError(404, "Ouvrage introuvable");
  return b;
}

const activeLoans = (bookId?: string) => db.loans.filter((l) => !l.returnedAt && (!bookId || l.bookId === bookId));
const waitingQueue = (bookId: string) =>
  db.reservations.filter((r) => r.bookId === bookId && r.status === "waiting").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const heldCount = (bookId: string) => db.reservations.filter((r) => r.bookId === bookId && r.status === "ready").length;
/** Exemplaires empruntables tout de suite (ni sortis, ni gardés pour une réservation prête). */
const availableCopies = (b: Book) => Math.max(0, b.copies - activeLoans(b.id).length - heldCount(b.id));

function decorate(l: StoredLoan): Loan {
  const book = bookById(l.bookId);
  const today = todayISO();
  const status = l.returnedAt ? "returned" : l.dueDate < today ? "overdue" : "active";
  const daysLate = l.returnedAt ? Math.max(0, diffDays(l.dueDate, l.returnedAt)) : status === "overdue" ? diffDays(l.dueDate, today) : 0;
  return { ...l, bookTitle: book.title, bookAuthor: book.author, status, daysLate };
}

function withState(b: Book, viewerId: string): BookView {
  const loan = activeLoans(b.id).find((l) => l.borrowerId === viewerId);
  const mine = db.reservations.find((r) => r.bookId === b.id && r.memberId === viewerId);
  const queue = waitingQueue(b.id);
  return {
    ...b,
    available: availableCopies(b),
    waiting: queue.length,
    myLoanId: loan?.id,
    myReservation: mine
      ? { id: mine.id, status: mine.status, position: mine.status === "waiting" ? queue.findIndex((r) => r.id === mine.id) + 1 : undefined }
      : undefined,
  };
}

// ---------- Catalogue ----------

/** GET /books?q=&category=&availableOnly= */
export const listBooks = (filters: BookFilters, viewer: Viewer, signal?: AbortSignal) =>
  api.get<BookView[]>("/books", {
    signal,
    mock: () => {
      svc();
      const q = normalize(filters.q?.trim() ?? "");
      return clone(
        db.books
          .filter(
            (b) =>
              (!filters.category || b.category === filters.category) && (!q || normalize(`${b.title} ${b.author} ${b.isbn}`).includes(q)),
          )
          .map((b) => withState(b, viewer.id))
          .filter((b) => !filters.availableOnly || b.available > 0),
      );
    },
  });

/** GET /books/{id} */
export const getBook = (id: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<BookView>(`/books/${id}`, {
    signal,
    mock: () => {
      svc();
      return clone(withState(bookById(id), viewer.id));
    },
  });

/** POST /books (administrateur) — 409 si l'ISBN existe déjà. */
export const createBook = (input: BookInput, viewer: Viewer) =>
  api.post<Book>("/books", {
    body: input,
    mock: () => {
      adminOnly(viewer);
      const digits = input.isbn.replace(/\D/g, "");
      const dup = db.books.find((b) => b.isbn.replace(/\D/g, "") === digits);
      if (dup) throw conflict("Cet ISBN existe déjà dans le catalogue", "ISBN_EXISTS", [`${dup.title} — ${dup.isbn}`]);
      const created: Book = {
        id: `b${++db.seq}`,
        title: input.title.trim(),
        author: input.author.trim(),
        isbn: input.isbn.trim(),
        category: input.category,
        year: input.year,
        copies: input.copies,
        description: input.description.trim(),
      };
      db.books.unshift(created);
      return clone(created);
    },
  });

// ---------- Prêts ----------

/**
 * POST /loans — emprunter un exemplaire. 409 si : déjà emprunté, prêt en retard, plafond atteint, ouvrage indisponible.
 * Une réservation « prête » de l'utilisateur est consommée à l'emprunt.
 */
export const borrowBook = (bookId: string, viewer: Viewer) =>
  api.post<Loan>("/loans", {
    body: { bookId },
    mock: () => {
      svc();
      const book = bookById(bookId);
      const mine = activeLoans().filter((l) => l.borrowerId === viewer.id);
      if (mine.some((l) => l.bookId === bookId)) throw conflict("Vous avez déjà emprunté cet ouvrage", "ALREADY_BORROWED");
      const late = mine.map(decorate).filter((l) => l.status === "overdue");
      if (late.length) {
        throw conflict(
          "Vous avez des prêts en retard",
          "HAS_OVERDUE",
          late.map((l) => `${l.bookTitle} — ${l.daysLate} jour(s) de retard`),
        );
      }
      const rules = LOAN_RULES[viewer.role];
      if (mine.length >= rules.limit)
        throw conflict(
          `Limite de ${rules.limit} prêts simultanés atteinte`,
          "LOAN_LIMIT",
          mine.map((l) => bookById(l.bookId).title),
        );
      const ready = db.reservations.find((r) => r.bookId === bookId && r.memberId === viewer.id && r.status === "ready");
      if (!ready && availableCopies(book) <= 0) {
        throw conflict("Aucun exemplaire n'est disponible", "BOOK_UNAVAILABLE", [
          `${book.title} — 0/${book.copies} exemplaire(s) disponible(s)`,
        ]);
      }
      if (ready) db.reservations.splice(db.reservations.indexOf(ready), 1);

      const created: StoredLoan = {
        id: `l-${++db.seq}`,
        bookId,
        borrowerId: viewer.id,
        borrowerName: viewer.name,
        borrowerRole: viewer.role,
        borrowedAt: todayISO(),
        dueDate: addDays(rules.days),
        renewals: 0,
      };
      db.loans.unshift(created);
      publishDomainEvent(SERVICE, "LivreEmprunté", `${viewer.name} · ${book.title}`);
      return clone(decorate(created));
    },
  });

/** GET /loans/me — mes prêts (en cours puis historique), mes réservations et mon plafond. */
export const getMyLibrary = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<MyLibrary>("/loans/me", {
    signal,
    mock: () => {
      svc();
      const order = { overdue: 0, active: 1, returned: 2 } as const;
      const loans = db.loans
        .filter((l) => l.borrowerId === viewer.id)
        .map(decorate)
        .sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate));
      const reservations: BookReservation[] = db.reservations
        .filter((r) => r.memberId === viewer.id)
        .map((r) => ({ ...r, position: r.status === "waiting" ? waitingQueue(r.bookId).findIndex((x) => x.id === r.id) + 1 : undefined }));
      return clone({ loans, reservations, limit: LOAN_RULES[viewer.role].limit });
    },
  });

/** PUT /loans/{id}/renew — prolonge le prêt (2 fois maximum, impossible en retard ou si l'ouvrage est réservé). */
export const renewLoan = (id: string, viewer: Viewer) =>
  api.put<Loan>(`/loans/${id}/renew`, {
    mock: () => {
      svc();
      const l = db.loans.find((x) => x.id === id);
      if (!l) throw new ApiError(404, "Prêt introuvable");
      if (l.borrowerId !== viewer.id) throw new ApiError(403, "Ce prêt n'est pas le vôtre");
      if (l.returnedAt) throw conflict("Ce prêt est déjà terminé", "ALREADY_RETURNED");
      if (decorate(l).status === "overdue")
        throw conflict("Un prêt en retard ne peut pas être prolongé", "OVERDUE", [
          `${bookById(l.bookId).title} — à rendre depuis le ${l.dueDate}`,
        ]);
      if (l.renewals >= MAX_RENEWALS) throw conflict(`Prolongation limitée à ${MAX_RENEWALS} fois`, "RENEWAL_LIMIT");
      if (waitingQueue(l.bookId).length)
        throw conflict("Cet ouvrage est réservé par un autre lecteur", "BOOK_RESERVED", [
          `${bookById(l.bookId).title} — ${waitingQueue(l.bookId).length} réservation(s) en attente`,
        ]);
      l.dueDate = shiftDate(l.dueDate, LOAN_RULES[viewer.role].days);
      l.renewals += 1;
      return clone(decorate(l));
    },
  });

/** GET /loans (administrateur) — tous les prêts : retards d'abord. */
export const listLoans = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<Loan[]>("/loans", {
    signal,
    mock: () => {
      adminOnly(viewer);
      const order = { overdue: 0, active: 1, returned: 2 } as const;
      return clone(db.loans.map(decorate).sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate)));
    },
  });

/** PUT /loans/{id}/return (administrateur) — publie LivreRetourné et prépare la première réservation en attente. */
export const returnLoan = (id: string, viewer: Viewer) =>
  api.put<Loan>(`/loans/${id}/return`, {
    mock: () => {
      adminOnly(viewer);
      const l = db.loans.find((x) => x.id === id);
      if (!l) throw new ApiError(404, "Prêt introuvable");
      if (l.returnedAt) throw conflict("Ce prêt est déjà rendu", "ALREADY_RETURNED");
      l.returnedAt = todayISO();
      const next = waitingQueue(l.bookId)[0];
      if (next) next.status = "ready";
      const title = bookById(l.bookId).title;
      publishDomainEvent(SERVICE, "LivreRetourné", next ? `${title} · réservé pour ${next.memberName}` : `${l.borrowerName} · ${title}`);
      return clone(decorate(l));
    },
  });

// ---------- Réservations ----------

/** POST /books/{id}/reservations — rejoindre la file d'attente d'un ouvrage indisponible. */
export const reserveBook = (bookId: string, viewer: Viewer) =>
  api.post<BookReservation>(`/books/${bookId}/reservations`, {
    mock: () => {
      svc();
      const book = bookById(bookId);
      if (activeLoans(bookId).some((l) => l.borrowerId === viewer.id))
        throw conflict("Vous avez déjà emprunté cet ouvrage", "ALREADY_BORROWED");
      if (db.reservations.some((r) => r.bookId === bookId && r.memberId === viewer.id))
        throw conflict("Vous avez déjà réservé cet ouvrage", "ALREADY_RESERVED");
      if (availableCopies(book) > 0) throw conflict("Un exemplaire est disponible : empruntez-le directement", "BOOK_AVAILABLE");
      const created: BookReservation = {
        id: `r-${++db.seq}`,
        bookId,
        bookTitle: book.title,
        memberId: viewer.id,
        memberName: viewer.name,
        status: "waiting",
        createdAt: db.now(),
      };
      db.reservations.push(created);
      return clone({ ...created, position: waitingQueue(bookId).findIndex((r) => r.id === created.id) + 1 });
    },
  });

/** DELETE /reservations/{id} — annule ma réservation ; un exemplaire gardé passe au suivant de la file. */
export const cancelReservation = (id: string, viewer: Viewer) =>
  api.delete<void>(`/reservations/${id}`, {
    mock: () => {
      svc();
      const r = db.reservations.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "Réservation introuvable");
      if (r.memberId !== viewer.id) throw new ApiError(403, "Cette réservation n'est pas la vôtre");
      db.reservations.splice(db.reservations.indexOf(r), 1);
      if (r.status === "ready") {
        const next = waitingQueue(r.bookId)[0];
        if (next) next.status = "ready";
      }
    },
  });
