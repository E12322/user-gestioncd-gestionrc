"""Actions d'ecriture EN ATTENTE de confirmation humaine.

Le modele ne peut que PROPOSER. L'execution passe par POST /agent/actions/{id}/confirm, appele par l'interface apres
un clic de l'utilisateur. Une proposition est : liee a un utilisateur, a usage unique, courte (5 min), plafonnee.
(En RAM : une seule instance. Plusieurs instances -> stocker dans MongoDB/Redis.)
"""
import secrets
import time
from dataclasses import dataclass
from functools import lru_cache

TTL_SECONDS = 300
MAX_PENDING_PER_USER = 5


@dataclass(frozen=True)
class PendingAction:
    id: str
    sub: str
    tool: str
    args: dict[str, str]
    summary: str
    expires: float


class TooManyPendingError(Exception):
    pass


class PendingStore:
    def __init__(self) -> None:
        self._items: dict[str, PendingAction] = {}

    def _purge(self) -> None:
        now = time.time()
        self._items = {k: v for k, v in self._items.items() if v.expires > now}

    def propose(self, sub: str, tool: str, args: dict[str, str], summary: str) -> PendingAction:
        self._purge()
        if sum(1 for p in self._items.values() if p.sub == sub) >= MAX_PENDING_PER_USER:
            raise TooManyPendingError
        action = PendingAction(secrets.token_urlsafe(16), sub, tool, args, summary, time.time() + TTL_SECONDS)
        self._items[action.id] = action
        return action

    def take(self, sub: str, action_id: str) -> PendingAction | None:
        """Retire ET renvoie l'action (usage unique). Inconnue, expiree ou d'un autre -> None (indiscernable)."""
        self._purge()
        action = self._items.get(action_id)
        if action is None or action.sub != sub:
            return None
        del self._items[action_id]
        return action


@lru_cache
def get_pending() -> PendingStore:
    return PendingStore()
