"""Agent : un seul Agent Pydantic AI, dont le comportement (prompt + outils visibles) depend du ROLE du JWT.

Le role ne vient JAMAIS du texte de l'utilisateur. Un outil est cache au modele si la permission manque, et le
user-service le refuserait de toute facon (defense en profondeur). Le modele ne peut qu'LIRE ou PROPOSER ;
toute ecriture passe par une confirmation humaine (app/pending.py).
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic_ai import Agent, RunContext
from pydantic_ai.tools import ToolDefinition

from app.auth import Principal
from app.knowledge import KnowledgeBase, get_knowledge
from app.pending import PendingStore, TooManyPendingError, get_pending
from app.permissions import permissions_for
from app.schemas import Action, AgentAnswer
from app.tools.campus import CampusClient
from app.tools.users import ToolError, UserServiceClient

PROMPTS = Path(__file__).parent / "prompts"
PHONE_RE = re.compile(r"\+?[0-9 ]{8,20}")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
TIME_RE = re.compile(r"\d{2}:\d{2}")
OPEN_MIN, CLOSE_MIN = 8 * 60, 19 * 60  # salles ouvertes de 8h a 19h
TUNIS = timezone(timedelta(hours=1))  # Tunisie : UTC+1, sans heure d'ete


def today() -> date:
    return datetime.now(TUNIS).date()


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


@dataclass
class AgentDeps:
    principal: Principal
    users: UserServiceClient
    campus: CampusClient | None = None
    actions: list[Action] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    pending: PendingStore = field(default_factory=get_pending)
    knowledge: KnowledgeBase = field(default_factory=get_knowledge)

    @property
    def permissions(self) -> frozenset[str]:
        return permissions_for(self.principal.role)


def _read(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


def build_instructions(ctx: RunContext[AgentDeps]) -> str:
    p = ctx.deps.principal
    perms = ", ".join(sorted(ctx.deps.permissions))
    return (
        f"{_read('base')}\n{_read(p.role)}\n"
        f"Utilisateur connecte : {p.name} (matricule {p.sub}, role {p.role}).\n"
        f"Permissions : {perms}.\n"
        f"Date du jour : {today().isoformat()} (fuseau de Tunis). Convertis « demain », « lundi »… en date AAAA-MM-JJ."
    )


async def _needs_users_manage(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
    """Cache l'outil au modele si l'utilisateur n'a pas la permission."""
    return tool_def if "users.manage" in ctx.deps.permissions else None


def _needs(permission: str):
    """Fabrique un filtre `prepare` : l'outil n'existe pas pour le modele sans cette permission."""

    async def prepare(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
        return tool_def if permission in ctx.deps.permissions else None

    return prepare


def _needs_role(permission: str, roles: frozenset[str]):
    """Comme `_needs`, et reserve l'outil a certains roles (le service refuserait les autres de toute facon)."""

    async def prepare(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
        ok = permission in ctx.deps.permissions and ctx.deps.principal.role in roles
        return tool_def if ok else None

    return prepare


STAFF = frozenset({"teacher", "admin"})
ADMIN = frozenset({"admin"})


def _propose_action(
    ctx: RunContext[AgentDeps], tool: str, pending_tool: str, args: dict[str, str], summary: str
) -> dict[str, Any]:
    """Cree une PROPOSITION d'ecriture (rien n'est execute) et la trace pour l'interface (bouton Confirmer)."""
    shown: dict[str, str | int | bool | None] = dict(args)
    try:
        pa = ctx.deps.pending.propose(ctx.deps.principal.sub, pending_tool, args, summary)
    except TooManyPendingError:
        ctx.deps.actions.append(Action(tool=tool, args=shown, status="error"))
        return {"error": "Trop de demandes en attente : l'utilisateur doit d'abord les confirmer ou les annuler."}
    ctx.deps.actions.append(
        Action(tool=tool, args=shown, status="needs_confirmation", confirmation_id=pa.id, summary=summary)
    )
    return {"status": "needs_confirmation", "message": "En attente de confirmation. Rien n'est effectue."}


def _refuse(ctx: RunContext[AgentDeps], tool: str, args: dict[str, Any], message: str) -> dict[str, str]:
    """Verification prealable echouee : on n'ouvre PAS de proposition, on explique pourquoi au modele."""
    denied = "acces refuse" in message.lower()
    ctx.deps.actions.append(Action(tool=tool, args=args, status="denied" if denied else "error"))
    return {"error": message}


async def _campus(ctx: RunContext[AgentDeps], tool: str, args: dict[str, Any], call) -> Any:
    """Appelle un module du campus (lecture) ; `call` recoit le client, absent si non configure."""
    if ctx.deps.campus is None:
        ctx.deps.actions.append(Action(tool=tool, args=args, status="error"))
        return {"error": "Ce module n'est pas disponible."}
    return await _call(ctx, tool, args, call(ctx.deps.campus))


async def _call(ctx: RunContext[AgentDeps], tool: str, args: dict[str, Any], coro) -> Any:
    """Execute un appel de service, journalise l'action (auditable) et renvoie une erreur lisible au modele."""
    try:
        result = await coro
    except ToolError as exc:
        denied = "refus" in str(exc).lower()
        ctx.deps.actions.append(Action(tool=tool, args=args, status="denied" if denied else "error"))
        return {"error": str(exc)}
    ctx.deps.actions.append(Action(tool=tool, args=args, status="done"))
    return result


def resolve_model(spec: str):
    """`AGENT_MODEL` peut etre une liste separee par des virgules : si le premier modele est surcharge (503) ou a
    epuise son quota (429), le suivant est essaye automatiquement (le quota gratuit est PAR modele)."""
    names = [m.strip() for m in spec.split(",") if m.strip()]
    if len(names) <= 1:
        return names[0] if names else spec
    from pydantic_ai.models import infer_model
    from pydantic_ai.models.fallback import FallbackModel

    return FallbackModel(*[infer_model(n) for n in names])


def build_agent(model: str) -> Agent[AgentDeps, AgentAnswer]:
    agent: Agent[AgentDeps, AgentAnswer] = Agent(
        resolve_model(model),
        deps_type=AgentDeps,
        output_type=AgentAnswer,
        instructions=build_instructions,
        retries=2,
        defer_model_check=True,  # pas de cle API requise a l'import (tests, CI)
    )

    @agent.tool
    async def get_my_profile(ctx: RunContext[AgentDeps]) -> Any:
        """Profil du compte connecte (nom, e-mail, role, statut). Aucun parametre : c'est toujours le sien."""
        uid = ctx.deps.principal.sub
        return await _call(ctx, "get_my_profile", {"user_id": uid}, ctx.deps.users.get_profile(uid))

    @agent.tool
    async def get_my_login_history(ctx: RunContext[AgentDeps], limit: int = 10) -> Any:
        """Dernieres connexions du compte connecte (date, succes ou echec). `limit` entre 1 et 50."""
        limit = max(1, min(limit, 50))
        uid = ctx.deps.principal.sub
        return await _call(
            ctx, "get_my_login_history", {"user_id": uid, "limit": limit}, ctx.deps.users.get_login_history(uid, limit)
        )

    @agent.tool(prepare=_needs_users_manage)
    async def get_user_profile(ctx: RunContext[AgentDeps], user_id: str) -> Any:
        """ADMIN : profil d'un compte par matricule (ex. ETU-2026-0001). Lecture seule."""
        return await _call(ctx, "get_user_profile", {"user_id": user_id}, ctx.deps.users.get_profile(user_id))

    @agent.tool(prepare=_needs("academic.view"))
    async def list_courses(ctx: RunContext[AgentDeps], query: str | None = None) -> Any:
        """Cours du catalogue academique (code, intitule, departement, credits, semestre, enseignant, capacite).
        `query` filtre par mot-cle (code, intitule, departement, enseignant). Lecture seule."""
        args = {"query": query}
        return await _campus(ctx, "list_courses", args, lambda c: c.list_courses(query))

    @agent.tool(prepare=_needs("resources.book"))
    async def list_rooms(
        ctx: RunContext[AgentDeps], query: str | None = None, min_capacity: int | None = None
    ) -> Any:
        """Salles du campus (nom, batiment, etage, type, capacite, equipements). `query` filtre par nom, batiment
        ou type ; `min_capacity` par capacite minimale. Lecture seule : tu ne reserves rien."""
        args = {"query": query, "min_capacity": min_capacity}
        return await _campus(ctx, "list_rooms", args, lambda c: c.list_rooms(query, min_capacity))

    @agent.tool(prepare=_needs("housing.request"))
    async def list_chambres(ctx: RunContext[AgentDeps]) -> Any:
        """Chambres des residences universitaires. Lecture seule : tu ne fais aucune demande d'hebergement."""
        return await _campus(ctx, "list_chambres", {}, lambda c: c.list_chambres())

    @agent.tool(prepare=_needs("library.borrow"))
    async def search_books(
        ctx: RunContext[AgentDeps], query: str | None = None, available_only: bool = False
    ) -> Any:
        """Livres de la bibliotheque (titre, auteur, categorie, exemplaires, disponibles, file d'attente).
        `query` filtre par titre, auteur, categorie ou ISBN. Lecture seule : tu n'empruntes rien."""
        args = {"query": query, "available_only": available_only}
        return await _campus(ctx, "search_books", args, lambda c: c.list_books(query, available_only))

    @agent.tool(prepare=_needs("library.borrow"))
    async def get_my_loans(ctx: RunContext[AgentDeps]) -> Any:
        """Emprunts et reservations du compte connecte (echeances, retards). Toujours les siens."""
        return await _campus(ctx, "get_my_loans", {}, lambda c: c.my_library())

    @agent.tool(prepare=_needs("clubs.join"))
    async def list_clubs(ctx: RunContext[AgentDeps], query: str | None = None) -> Any:
        """Clubs etudiants (nom, categorie, description, lieu de reunion, membres, places, mon adhesion).
        `query` filtre par nom, categorie ou description. Lecture seule : tu ne fais aucune demande d'adhesion."""
        args = {"query": query}
        return await _campus(ctx, "list_clubs", args, lambda c: c.list_clubs(query))

    @agent.tool(prepare=_needs("clubs.join"))
    async def list_events(ctx: RunContext[AgentDeps], query: str | None = None) -> Any:
        """Evenements du campus (titre, date, horaires, lieu, club organisateur). `query` filtre par mot-cle.
        Lecture seule : tu n'inscris personne."""
        args = {"query": query}
        return await _campus(ctx, "list_events", args, lambda c: c.list_events(query))

    @agent.tool(prepare=_needs("clubs.join"))
    async def get_my_club_activity(ctx: RunContext[AgentDeps]) -> Any:
        """Adhesions aux clubs et inscriptions aux evenements du compte connecte. Toujours les siennes."""
        return await _campus(ctx, "get_my_club_activity", {}, lambda c: c.my_student_life())

    # ------------------------------------------------------------------------------------------------------
    # Outils d'ACTION : ils ne font que PROPOSER. L'execution passe par POST /agent/actions/{id}/confirm
    # (clic de l'utilisateur), avec le jeton de l'utilisateur ; chaque outil verifie d'abord la faisabilite.
    # ------------------------------------------------------------------------------------------------------

    @agent.tool(prepare=_needs("resources.book"))
    async def check_room_availability(ctx: RunContext[AgentDeps], room_id: str, day: str) -> Any:
        """Creneaux DEJA OCCUPES d'une salle pour un jour (`day` au format AAAA-MM-JJ). Lecture seule. A appeler avant
        de proposer une reservation, ou pour dire a l'utilisateur quand une salle est libre."""
        args = {"room_id": room_id, "day": day}
        return await _campus(ctx, "check_room_availability", args, lambda c: c.room_availability(room_id, day))

    @agent.tool(prepare=_needs_role("resources.book", STAFF))
    async def list_reservations(ctx: RunContext[AgentDeps]) -> Any:
        """Reservations de salles : celles de l'utilisateur ; pour un administrateur, TOUTES (statut pending = a
        valider, confirmed, refused). Lecture seule."""
        scope = "all" if ctx.deps.principal.role == "admin" else "mine"
        return await _campus(ctx, "list_reservations", {"scope": scope}, lambda c: c.list_reservations(scope))

    @agent.tool(prepare=_needs_role("resources.book", STAFF))
    async def propose_room_reservation(
        ctx: RunContext[AgentDeps], room_id: str, day: str, start: str, end: str, attendees: int, purpose: str
    ) -> Any:
        """PROPOSE de reserver une salle (rien n'est reserve avant le clic de l'utilisateur). `room_id` : identifiant
        d'une salle (voir list_rooms) ; `day` : AAAA-MM-JJ ; `start` et `end` : HH:MM (salles ouvertes 08:00-19:00) ;
        `attendees` : nombre de personnes ; `purpose` : motif court. Verifie la capacite et les conflits d'abord."""
        tool = "propose_room_reservation"
        args = {"room_id": room_id, "day": day, "start": start, "end": end, "attendees": attendees, "purpose": purpose}
        if ctx.deps.campus is None:
            return _refuse(ctx, tool, args, "Ce module n'est pas disponible.")
        purpose = purpose.strip()
        if not (DATE_RE.fullmatch(day) and TIME_RE.fullmatch(start) and TIME_RE.fullmatch(end)):
            return _refuse(ctx, tool, args, "Format invalide : date AAAA-MM-JJ, heures HH:MM.")
        try:
            wanted_day = date.fromisoformat(day)
            s, e = _minutes(start), _minutes(end)
        except ValueError:
            return _refuse(ctx, tool, args, "Date ou heure invalide.")
        if wanted_day < today():
            return _refuse(ctx, tool, args, "La date est dans le passe.")
        if not (OPEN_MIN <= s < e <= CLOSE_MIN):
            return _refuse(ctx, tool, args, "Le creneau doit tenir entre 08:00 et 19:00 (debut avant fin).")
        if not 3 <= len(purpose) <= 200 or not 1 <= attendees <= 1000:
            return _refuse(ctx, tool, args, "Motif (3 a 200 caracteres) ou nombre de personnes invalide.")
        try:
            room = await ctx.deps.campus.get_room(room_id)
            if attendees > int(room.get("capacity", 0)):
                return _refuse(ctx, tool, args, f"{room['name']} accueille au maximum {room['capacity']} personnes.")
            busy = (await ctx.deps.campus.room_availability(room_id, day))["busy"]
        except ToolError as exc:
            return _refuse(ctx, tool, args, str(exc))
        clash = [
            b for b in busy
            if b.get("status") == "confirmed" and _minutes(b["start"]) < e and _minutes(b["end"]) > s
        ]
        if clash:
            taken = ", ".join(f"{b['start']}-{b['end']}" for b in clash)
            msg = f"{room['name']} est deja reservee ce jour-la : {taken}. Proposer un autre creneau."
            return _refuse(ctx, tool, args, msg)
        summary = (f"Reserver {room['name']} le {day} de {start} a {end} pour {attendees} personne(s) "
                   f"({purpose}).")
        return _propose_action(ctx, tool, "create_room_reservation", {
            "room_id": room_id, "date": day, "start": start, "end": end, "attendees": str(attendees),
            "purpose": purpose, "room_name": str(room["name"]),
        }, summary)

    @agent.tool(prepare=_needs_role("resources.manage", ADMIN))
    async def propose_reservation_decision(
        ctx: RunContext[AgentDeps], reservation_id: str, decision: Literal["confirmed", "refused"]
    ) -> Any:
        """ADMIN : PROPOSE de confirmer (`confirmed`) ou refuser (`refused`) une reservation en attente (identifiant
        fourni par list_reservations). Rien n'est decide avant le clic de l'administrateur."""
        tool = "propose_reservation_decision"
        args = {"reservation_id": reservation_id, "decision": decision}
        if ctx.deps.campus is None:
            return _refuse(ctx, tool, args, "Ce module n'est pas disponible.")
        try:
            r = await ctx.deps.campus.find_reservation(reservation_id)
        except ToolError as exc:
            return _refuse(ctx, tool, args, str(exc))
        if r.get("status") != "pending":
            return _refuse(ctx, tool, args, "Cette reservation a deja ete traitee.")
        verb = "Confirmer" if decision == "confirmed" else "Refuser"
        summary = (f"{verb} la reservation de {r.get('requesterName')} : {r.get('roomName')} le {r.get('date')} "
                   f"de {r.get('start')} a {r.get('end')} ({r.get('purpose')}).")
        return _propose_action(ctx, tool, "decide_reservation",
                               {"reservation_id": reservation_id, "decision": decision}, summary)

    @agent.tool(prepare=_needs("library.borrow"))
    async def propose_book_loan(ctx: RunContext[AgentDeps], book_id: str) -> Any:
        """PROPOSE d'emprunter un livre (identifiant fourni par search_books). Rien n'est emprunte avant le clic.
        Refuse si aucun exemplaire n'est disponible (proposer alors propose_book_reservation)."""
        tool = "propose_book_loan"
        args = {"book_id": book_id}
        if ctx.deps.campus is None:
            return _refuse(ctx, tool, args, "Ce module n'est pas disponible.")
        try:
            book = await ctx.deps.campus.get_book(book_id)
        except ToolError as exc:
            return _refuse(ctx, tool, args, str(exc))
        if book.get("myLoanId"):
            return _refuse(ctx, tool, args, "L'utilisateur a deja emprunte ce livre.")
        if int(book.get("available", 0)) <= 0:
            msg = "Aucun exemplaire disponible : proposer plutot une reservation (file d'attente)."
            return _refuse(ctx, tool, args, msg)
        summary = (f"Emprunter « {book['title']} » de {book['author']} "
                   f"({book['available']} exemplaire(s) disponible(s)).")
        pending_args = {"book_id": book_id, "title": str(book["title"])}
        return _propose_action(ctx, tool, "borrow_book", pending_args, summary)

    @agent.tool(prepare=_needs("library.borrow"))
    async def propose_book_reservation(ctx: RunContext[AgentDeps], book_id: str) -> Any:
        """PROPOSE de reserver un livre INDISPONIBLE (file d'attente). Rien n'est reserve avant le clic. Refuse si des
        exemplaires sont disponibles (proposer alors propose_book_loan)."""
        tool = "propose_book_reservation"
        args = {"book_id": book_id}
        if ctx.deps.campus is None:
            return _refuse(ctx, tool, args, "Ce module n'est pas disponible.")
        try:
            book = await ctx.deps.campus.get_book(book_id)
        except ToolError as exc:
            return _refuse(ctx, tool, args, str(exc))
        if book.get("myReservation"):
            return _refuse(ctx, tool, args, "L'utilisateur a deja reserve ce livre.")
        if int(book.get("available", 0)) > 0:
            return _refuse(ctx, tool, args, "Des exemplaires sont disponibles : proposer plutot un emprunt.")
        summary = f"Reserver « {book['title']} » (file d'attente : {book.get('waiting', 0)} personne(s))."
        return _propose_action(ctx, tool, "reserve_book", {"book_id": book_id, "title": str(book["title"])}, summary)

    @agent.tool(prepare=_needs("clubs.join"))
    async def propose_club_join(ctx: RunContext[AgentDeps], club_id: str) -> Any:
        """PROPOSE de demander l'adhesion a un club (identifiant fourni par list_clubs). Rien n'est envoye avant le
        clic. Refuse si le club est complet ou si l'utilisateur en est deja membre."""
        tool = "propose_club_join"
        args = {"club_id": club_id}
        if ctx.deps.campus is None:
            return _refuse(ctx, tool, args, "Ce module n'est pas disponible.")
        try:
            club = await ctx.deps.campus.get_club(club_id)
        except ToolError as exc:
            return _refuse(ctx, tool, args, str(exc))
        if club.get("myMembership"):
            return _refuse(ctx, tool, args, "L'utilisateur a deja une adhesion ou une demande pour ce club.")
        if int(club.get("members", 0)) >= int(club.get("maxMembers", 0) or 10**9):
            return _refuse(ctx, tool, args, f"Le club {club['name']} est complet.")
        summary = (f"Demander l'adhesion au club {club['name']} "
                   f"({club.get('members')}/{club.get('maxMembers')} membres).")
        return _propose_action(ctx, tool, "join_club", {"club_id": club_id, "name": str(club["name"])}, summary)

    @agent.tool
    async def search_knowledge(ctx: RunContext[AgentDeps], query: str) -> Any:
        """Cherche dans le reglement et les guides (uniquement ceux visibles pour le role de l'utilisateur).
        Renvoie des extraits avec leur source ; cite-la dans ta reponse."""
        hits = ctx.deps.knowledge.search(query[:300], ctx.deps.principal.role)
        for h in hits:
            if h["source"] not in ctx.deps.sources:
                ctx.deps.sources.append(h["source"])
        ctx.deps.actions.append(Action(tool="search_knowledge", args={"results": len(hits)}, status="done"))
        return hits or {"info": "Aucun document pertinent."}

    @agent.tool
    async def propose_phone_update(ctx: RunContext[AgentDeps], phone: str) -> Any:
        """Prepare la modification du TELEPHONE du compte connecte. N'EXECUTE RIEN : l'utilisateur devra confirmer
        dans l'interface. Format : chiffres, espaces, + optionnel (8 a 20 caracteres)."""
        phone = phone.strip()
        if not PHONE_RE.fullmatch(phone):
            ctx.deps.actions.append(Action(tool="propose_phone_update", status="error"))
            return {"error": "Numero invalide (8 a 20 chiffres, espaces ou + au debut)."}
        summary = f"Remplacer votre numero de telephone par {phone}"
        try:
            pa = ctx.deps.pending.propose(ctx.deps.principal.sub, "update_my_phone", {"phone": phone}, summary)
        except TooManyPendingError:
            ctx.deps.actions.append(Action(tool="propose_phone_update", status="error"))
            return {"error": "Trop de demandes en attente : l'utilisateur doit d'abord les confirmer ou les annuler."}
        ctx.deps.actions.append(
            Action(
                tool="propose_phone_update", args={"phone": phone}, status="needs_confirmation",
                confirmation_id=pa.id, summary=summary,
            )
        )
        return {"status": "needs_confirmation", "message": "En attente de confirmation. Rien n'est modifie."}

    return agent
