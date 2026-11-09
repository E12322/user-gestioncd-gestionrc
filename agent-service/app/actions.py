"""Actions d'ECRITURE que l'agent peut PROPOSER, et que seul un clic de l'utilisateur execute.

Cycle : le modele appelle un outil `propose_*` (app/agent.py) -> une proposition est creee (app/pending.py, liee a
l'utilisateur, usage unique, 5 minutes) -> le widget affiche Confirmer / Annuler -> `POST /agent/actions/{id}/confirm`
retrouve la proposition et appelle le service concerne AVEC LE JETON DE L'UTILISATEUR (il decide, pas l'agent).

Les arguments sont ceux enregistres COTE SERVEUR a la proposition : le client ne fournit que l'identifiant de la
proposition, jamais les parametres de l'action.
"""
from collections.abc import Awaitable, Callable

from app.tools.campus import CampusClient

Executor = Callable[[CampusClient, dict[str, str]], Awaitable[str]]

STATUS_FR = {"confirmed": "confirmée", "pending": "en attente de validation", "refused": "refusée"}


async def _create_room_reservation(campus: CampusClient, a: dict[str, str]) -> str:
    r = await campus.create_reservation({
        "roomId": a["room_id"], "date": a["date"], "start": a["start"], "end": a["end"],
        "attendees": int(a["attendees"]), "purpose": a["purpose"],
    })
    return (f"Réservation enregistrée : {r.get('roomName', 'salle')} le {r.get('date')} de {r.get('start')} "
            f"à {r.get('end')} (statut : {STATUS_FR.get(str(r.get('status')), r.get('status'))}).")


async def _decide_reservation(campus: CampusClient, a: dict[str, str]) -> str:
    r = await campus.decide_reservation(a["reservation_id"], a["decision"])
    who = r.get("requesterName") or "l'utilisateur"
    state = STATUS_FR.get(str(r.get("status")), r.get("status"))
    return f"Réservation de {who} ({r.get('roomName')}, {r.get('date')}) : {state}."


async def _borrow_book(campus: CampusClient, a: dict[str, str]) -> str:
    r = await campus.borrow_book(a["book_id"])
    title = r.get("bookTitle") or a.get("title", "livre")
    return f"Emprunt enregistré : « {title} », à rendre avant le {r.get('dueDate')}."


async def _reserve_book(campus: CampusClient, a: dict[str, str]) -> str:
    await campus.reserve_book(a["book_id"])
    return f"Réservation enregistrée : « {a.get('title', 'livre')} » (vous serez prévenu quand il sera disponible)."


async def _join_club(campus: CampusClient, a: dict[str, str]) -> str:
    r = await campus.join_club(a["club_id"])
    name = a.get("name") or "demandé"
    state = STATUS_FR.get(str(r.get("status")).lower(), r.get("status"))
    return f"Demande d'adhésion envoyée au club {name} (statut : {state})."


# nom de la proposition -> executeur. Le changement de telephone (user-service) reste traite dans main.confirm.
EXECUTORS: dict[str, Executor] = {
    "create_room_reservation": _create_room_reservation,
    "decide_reservation": _decide_reservation,
    "borrow_book": _borrow_book,
    "reserve_book": _reserve_book,
    "join_club": _join_club,
}
