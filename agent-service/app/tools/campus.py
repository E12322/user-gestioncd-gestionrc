"""Client des modules du campus (cours, salles, chambres, livres, clubs, evenements).

Comme pour le user-service, chaque appel porte le JWT DE L'UTILISATEUR : chaque service applique ses propres
droits. L'agent ne voit que des champs utiles (liste blanche) et au plus MAX_ITEMS elements, pour limiter le
volume envoye au modele et ne jamais lui transmettre de donnees inutiles.

LECTURES : librement par le modele. ECRITURES (create_reservation, decide_reservation, borrow_book, reserve_book,
join_club) : appelees UNIQUEMENT apres confirmation humaine (voir app/actions.py et POST /agent/actions/{id}/confirm).
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


def _server_message(response: httpx.Response) -> str:
    """Message metier renvoye par un service (ex. « Salle deja reservee »), borne et sans detail technique."""
    try:
        body = response.json()
    except ValueError:
        return ""
    if isinstance(body, dict):
        for key in ("message", "detail", "error"):
            value = body.get(key)
            if isinstance(value, str):
                return value.strip()[:200]
    return ""


class CampusClient:
    def __init__(
        self, *, academic_url: str, resources_url: str, residences_url: str, library_url: str, token: str,
        student_life_url: str = "http://localhost:4005", transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._urls = {
            "academic": academic_url.rstrip("/"), "resources": resources_url.rstrip("/"),
            "residences": residences_url.rstrip("/"), "library": library_url.rstrip("/"),
            "student-life": student_life_url.rstrip("/"),
        }
        self._http = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {token}"}, timeout=httpx.Timeout(8.0), transport=transport
        )

    async def _request(
        self, method: str, service: str, path: str, *, params: dict[str, Any] | None = None, json: Any = None
    ) -> Any:
        try:
            r = await self._http.request(
                method, f"{self._urls[service]}{path}", json=json,
                params={k: v for k, v in (params or {}).items() if v is not None},
            )
        except httpx.HTTPError as exc:
            raise ToolError(f"Le service {service} est injoignable.") from exc
        if r.status_code in (401, 403):
            raise ToolError(f"Acces refuse par le service {service}.")
        if r.status_code == 404:
            raise ToolError("Ressource introuvable.")
        if r.status_code in (400, 409, 422):
            detail = _server_message(r)
            raise ToolError(f"Demande refusee par le service {service}" + (f" : {detail}" if detail else "."))
        if r.status_code >= 400:
            raise ToolError(f"Le service {service} a repondu {r.status_code}.")
        if r.status_code == 204 or not r.content:
            return None
        return r.json()

    async def _get(self, service: str, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", service, path, params=params)

    @staticmethod
    def _cap(items: list[Any]) -> dict[str, Any]:
        return {"total": len(items), "shown": min(len(items), MAX_ITEMS), "items": items[:MAX_ITEMS]}

    # ------------------------------------------------------------------ lectures

    async def list_courses(self, query: str | None = None) -> dict[str, Any]:
        fields = ("code", "intitule", "departement", "enseignantNom", "description")
        data = await self._get("academic", "/api/academic/v1/courses")
        rows = [
            _pick(c, ("id", "code", "intitule", "departement", "credits", "semestre", "enseignantNom", "capacite",
                      "nature"))
            for c in data if _match(c, fields, query)
        ]
        return self._cap(rows)

    async def _rooms(self) -> list[dict[str, Any]]:
        return await self._get("resources", "/api/rooms")

    async def list_rooms(self, query: str | None = None, min_capacity: int | None = None) -> dict[str, Any]:
        data = await self._rooms()
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

    async def get_room(self, room_id: str) -> dict[str, Any]:
        for r in await self._rooms():
            if str(r.get("id")) == str(room_id):
                return _pick(r, ("id", "name", "building", "capacity", "openHours"))
        raise ToolError("Salle introuvable.")

    async def room_availability(self, room_id: str, date: str) -> dict[str, Any]:
        data = await self._get("resources", f"/api/rooms/{room_id}/availability", {"date": date})
        return {"roomId": data.get("roomId"), "date": data.get("date"), "busy": data.get("slots", [])}

    async def list_reservations(self, scope: str = "mine") -> dict[str, Any]:
        data = await self._get("resources", "/api/reservations", {"scope": scope})
        rows = [
            _pick(r, ("id", "roomName", "building", "requesterName", "date", "start", "end", "attendees", "purpose",
                      "status"))
            for r in data
        ]
        return self._cap(rows)

    async def find_reservation(self, reservation_id: str) -> dict[str, Any]:
        """Une reservation precise (admin : parmi toutes). Sans plafond de liste, pour ne jamais la manquer."""
        for r in await self._get("resources", "/api/reservations", {"scope": "all"}):
            if str(r.get("id")) == str(reservation_id):
                return _pick(r, ("id", "roomName", "requesterName", "date", "start", "end", "attendees", "purpose",
                                 "status"))
        raise ToolError("Reservation introuvable.")

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

    async def get_book(self, book_id: str) -> dict[str, Any]:
        b = await self._get("library", f"/books/{book_id}")
        return _pick(b, ("id", "title", "author", "copies", "available", "waiting", "myLoanId", "myReservation"))

    async def my_library(self) -> dict[str, Any]:
        data = await self._get("library", "/loans/me")
        loans = [
            _pick(loan, ("id", "bookTitle", "bookAuthor", "borrowedAt", "dueDate", "returnedAt", "status", "daysLate"))
            for loan in data.get("loans", [])
        ]
        reservations = data.get("reservations", [])
        return {"loans": loans[:MAX_ITEMS], "reservations": reservations[:MAX_ITEMS], "limit": data.get("limit")}

    async def list_clubs(self, query: str | None = None) -> dict[str, Any]:
        data = await self._get("student-life", "/clubs")
        fields = ("name", "category", "description", "meetingPlace")
        rows = [
            _pick(c, ("id", "name", "category", "description", "meetingPlace", "members", "maxMembers", "myMembership"))
            for c in data if _match(c, fields, query)
        ]
        return self._cap(rows)

    async def get_club(self, club_id: str) -> dict[str, Any]:
        c = await self._get("student-life", f"/clubs/{club_id}")
        return _pick(c, ("id", "name", "category", "members", "maxMembers", "myMembership"))

    async def list_events(self, query: str | None = None) -> dict[str, Any]:
        data = await self._get("student-life", "/events")
        fields = ("title", "description", "location", "clubName")
        rows = [
            _pick(e, ("id", "title", "description", "date", "start", "end", "location", "clubName"))
            for e in data if _match(e, fields, query)
        ]
        return self._cap(rows)

    async def my_student_life(self) -> dict[str, Any]:
        """Adhesions et inscriptions aux evenements du compte connecte (les services filtrent deja par utilisateur)."""
        memberships = await self._get("student-life", "/memberships/mine")
        registrations = await self._get("student-life", "/events/my-registrations")
        return {"memberships": self._cap(memberships), "event_registrations": self._cap(registrations)}

    # ------------------------------------------------------------------ ecritures (apres confirmation humaine)

    async def create_reservation(self, payload: dict[str, Any]) -> dict[str, Any]:
        r = await self._request("POST", "resources", "/api/reservations", json=payload)
        return _pick(r, ("id", "roomName", "date", "start", "end", "status"))

    async def decide_reservation(self, reservation_id: str, status: str) -> dict[str, Any]:
        r = await self._request(
            "PUT", "resources", f"/api/reservations/{reservation_id}/status", json={"status": status}
        )
        return _pick(r, ("id", "roomName", "requesterName", "date", "start", "end", "status"))

    async def borrow_book(self, book_id: str) -> dict[str, Any]:
        r = await self._request("POST", "library", "/loans", json={"bookId": book_id})
        return _pick(r, ("id", "bookTitle", "borrowedAt", "dueDate", "status"))

    async def reserve_book(self, book_id: str) -> dict[str, Any]:
        r = await self._request("POST", "library", f"/books/{book_id}/reservations")
        return r if isinstance(r, dict) else {}

    async def join_club(self, club_id: str) -> dict[str, Any]:
        r = await self._request("POST", "student-life", f"/clubs/{club_id}/members")
        return _pick(r, ("id", "clubId", "status"))

    async def aclose(self) -> None:
        await self._http.aclose()
