"""Agent : un seul Agent Pydantic AI, dont le comportement (prompt + outils visibles) depend du ROLE du JWT.

Le role ne vient JAMAIS du texte de l'utilisateur. Un outil est cache au modele si la permission manque, et le
user-service le refuserait de toute facon (defense en profondeur). Le modele ne peut qu'LIRE ou PROPOSER ;
toute ecriture passe par une confirmation humaine (app/pending.py).
"""
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
        f"Permissions : {perms}."
    )


async def _needs_users_manage(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
    """Cache l'outil au modele si l'utilisateur n'a pas la permission."""
    return tool_def if "users.manage" in ctx.deps.permissions else None


def _needs(permission: str):
    """Fabrique un filtre `prepare` : l'outil n'existe pas pour le modele sans cette permission."""

    async def prepare(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
        return tool_def if permission in ctx.deps.permissions else None

    return prepare


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
