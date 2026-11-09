"""Client LECTURE SEULE des modules du campus (cours, salles, chambres, livres).

Comme pour le user-service, chaque appel porte le JWT DE L'UTILISATEUR : chaque service applique ses propres
droits. L'agent ne voit que des champs utiles (liste blanche) et au plus MAX_ITEMS elements, pour limiter le
volume envoye au modele et ne jamais lui transmettre de donnees inutiles.
"""
from typing import Any

import httpx

from app.tools.users import ToolError

MAX_ITEMS = 20


def _pick(item: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    return {k: item[k] for k in fields if k in item and item[k] is not None}


def _match(item: dict[str, Any], fields: tuple[str, ...], query: str | None) -> bool:
    if not query:
        return True
    q = query.strip().lower()
    return any(q in str(item.get(f, "")).lower() for f in fields)


class CampusClient:
    def __init__(
        self, *, academic_url: str, resources_url: str, residences_url: str, library_url: str, token: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._urls = {
            "academic": academic_url.rstrip("/"), "resources": resources_url.rstrip("/"),
            "residences": residences_url.rstrip("/"), "library": library_url.rstrip("/"),
        }
        self._http = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {token}"}, timeout=httpx.Timeout(8.0), transport=transport
        )

    async def _get(self, service: str, path: str, params: dict[str, Any] | None = None) -> Any:
        try:
            r = await self._http.get(
                f"{self._urls[service]}{path}", params={k: v for k, v in (params or {}).items() if v is not None}
            )
        except httpx.HTTPError as exc:
            raise ToolError(f"Le service {service} est injoignable.") from exc
        if r.status_code in (401, 403):
            raise ToolError(f"Acces refuse par le service {service}.")
        if r.status_code == 404:
            raise ToolError("Ressource introuvable.")
        if r.status_code >= 400:
            raise ToolError(f"Le service {service} a repondu {r.status_code}.")
        return r.json()

    @staticmethod
    def _cap(items: list[Any]) -> dict[str, Any]:
        return {"total": len(items), "shown": min(len(items), MAX_ITEMS), "items": items[:MAX_ITEMS]}

    async def list_courses(self, query: str | None = None) -> dict[str, Any]:
        fields = ("code", "intitule", "departement", "enseignantNom", "description")
        data = await self._get("academic", "/api/academic/v1/courses")
        rows = [
            _pick(c, ("id", "code", "intitule", "departement", "credits", "semestre", "enseignantNom", "capacite",
                      "nature"))
            for c in data if _match(c, fields, query)
        ]
        return self._cap(rows)

    async def list_rooms(self, query: str | None = None, min_capacity: int | None = None) -> dict[str, Any]:
        data = await self._get("resources", "/api/rooms")
        rows = []
        for r in data:
            if not _match(r, ("name", "building", "kind"), query):
                continue
            if min_capacity and r.get("capacity", 0) < min_capacity:
                continue
            row = _pick(r, ("id", "name", "building", "floor", "kind", "capacity", "bookedHoursToday", "openHours"))
            row["equipment"] = [e.get("label") for e in r.get("equipment", []) if isinstance(e, dict)]
            rows.append(row)
        return self._cap(rows)

    async def list_chambres(self) -> dict[str, Any]:
        data = await self._get("residences", "/api/chambres")
        rows = data if isinstance(data, list) else data.get("items", data.get("data", []))
        return self._cap(rows)

    async def list_books(self, query: str | None = None, available_only: bool = False) -> dict[str, Any]:
        data = await self._get("library", "/books", {"availableOnly": "true" if available_only else None})
        fields = ("title", "author", "category", "isbn", "description")
        rows = [
            _pick(b, ("id", "title", "author", "category", "year", "copies", "available", "waiting"))
            for b in data if _match(b, fields, query)
        ]
        return self._cap(rows)

    async def my_library(self) -> dict[str, Any]:
        data = await self._get("library", "/loans/me")
        loans = [
            _pick(loan, ("id", "bookTitle", "bookAuthor", "borrowedAt", "dueDate", "returnedAt", "status", "daysLate"))
            for loan in data.get("loans", [])
        ]
        reservations = data.get("reservations", [])
        return {"loans": loans[:MAX_ITEMS], "reservations": reservations[:MAX_ITEMS], "limit": data.get("limit")}

    async def aclose(self) -> None:
        await self._http.aclose()
