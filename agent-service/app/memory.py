"""Memoire de conversation (court terme).

Cle = (matricule du JWT, id de conversation) : un utilisateur ne peut JAMAIS relire la conversation d'un autre,
meme en devinant son id. On garde les N derniers echanges complets (appels d'outils inclus, jamais coupes en deux).
"""
import time
from typing import Protocol

from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

MAX_RUNS = 6  # echanges conserves
TTL_SECONDS = 7 * 24 * 3600


class ConversationStore(Protocol):
    async def load(self, sub: str, conversation_id: str) -> list[ModelMessage]: ...
    async def append(self, sub: str, conversation_id: str, messages: list[ModelMessage]) -> None: ...


class InMemoryStore:
    """Developpement et tests. Perdu au redemarrage ; plusieurs instances ne le partagent pas -> MongoStore."""

    def __init__(self) -> None:
        self._data: dict[tuple[str, str], tuple[float, list[bytes]]] = {}

    async def load(self, sub: str, conversation_id: str) -> list[ModelMessage]:
        updated, runs = self._data.get((sub, conversation_id), (0.0, []))
        if time.time() - updated > TTL_SECONDS:
            self._data.pop((sub, conversation_id), None)
            return []
        return [m for run in runs for m in ModelMessagesTypeAdapter.validate_json(run)]

    async def append(self, sub: str, conversation_id: str, messages: list[ModelMessage]) -> None:
        _, runs = self._data.get((sub, conversation_id), (0.0, []))
        runs = [*runs, ModelMessagesTypeAdapter.dump_json(messages)][-MAX_RUNS:]
        self._data[(sub, conversation_id)] = (time.time(), runs)


class MongoStore:
    """Production : collection `agent_conversations`, index TTL. (Non teste contre un vrai MongoDB pour l'instant.)"""

    def __init__(self, uri: str, database: str = "smartcampus_agent") -> None:
        from pymongo import AsyncMongoClient  # import tardif : dependance optionnelle

        self._col = AsyncMongoClient(uri)[database]["agent_conversations"]
        self._indexed = False

    async def _ensure_index(self) -> None:
        if not self._indexed:
            await self._col.create_index("updatedAt", expireAfterSeconds=TTL_SECONDS)
            self._indexed = True

    @staticmethod
    def _key(sub: str, cid: str) -> str:
        return f"{sub}:{cid}"

    async def load(self, sub: str, conversation_id: str) -> list[ModelMessage]:
        doc = await self._col.find_one({"_id": self._key(sub, conversation_id)})
        runs = doc["runs"] if doc else []
        return [m for run in runs for m in ModelMessagesTypeAdapter.validate_json(run)]

    async def append(self, sub: str, conversation_id: str, messages: list[ModelMessage]) -> None:
        from datetime import UTC, datetime

        await self._ensure_index()
        run = ModelMessagesTypeAdapter.dump_json(messages).decode()
        await self._col.update_one(
            {"_id": self._key(sub, conversation_id)},
            {"$push": {"runs": {"$each": [run], "$slice": -MAX_RUNS}}, "$set": {"updatedAt": datetime.now(UTC)}},
            upsert=True,
        )
