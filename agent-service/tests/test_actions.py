"""Actions d'ecriture de l'agent : le modele PROPOSE (apres avoir verifie), seul un clic EXECUTE, avec le jeton de
l'utilisateur. Les services du campus sont simules ; on verifie ce qui leur est envoye (et surtout ce qui ne l'est pas)."""
import json
from datetime import timedelta

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic_ai import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

import app.main as main
from app.agent import today
from app.memory import InMemoryStore
from app.tools.campus import CampusClient
from tests.conftest import make_token

DAY = (today() + timedelta(days=3)).isoformat()


class FakeCampus:
    """Services du campus simules. `calls` garde (methode, chemin, en-tete Authorization, corps JSON)."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str | None, object]] = []
        self.busy: list[dict] = []
        self.book = {"id": "b1", "title": "Clean Architecture", "author": "Martin", "copies": 2, "available": 1,
                     "waiting": 0}
        self.club = {"id": "k1", "name": "Club Robotique", "members": 10, "maxMembers": 60}
        self.reservation = {"id": "7", "roomName": "Salle C12", "requesterName": "Prof A", "date": DAY,
                            "start": "10:00", "end": "11:00", "purpose": "Cours", "status": "pending"}

    def writes(self) -> list[tuple[str, str]]:
        return [(m, p) for m, p, _, _ in self.calls if m != "GET"]

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        path = request.url.path
        self.calls.append((request.method, path, request.headers.get("authorization"), body))
        m = request.method
        if (m, path) == ("GET", "/api/rooms"):
            return httpx.Response(200, json=[{"id": "3", "name": "Salle C12", "capacity": 40, "openHours": 11}])
        if m == "GET" and path.endswith("/availability"):
            return httpx.Response(200, json={"roomId": "3", "date": DAY, "slots": self.busy})
        if (m, path) == ("POST", "/api/reservations"):
            return httpx.Response(201, json={"id": "9", "roomName": "Salle C12", "date": body["date"],
                                             "start": body["start"], "end": body["end"], "status": "pending"})
        if (m, path) == ("GET", "/api/reservations"):
            return httpx.Response(200, json=[self.reservation])
        if m == "PUT" and path.endswith("/status"):
            return httpx.Response(200, json={**self.reservation, "status": body["status"]})
        if (m, path) == ("GET", "/books/b1"):
            return httpx.Response(200, json=self.book)
        if (m, path) == ("POST", "/loans"):
            return httpx.Response(201, json={"id": "l-9", "bookTitle": "Clean Architecture", "dueDate": "2026-12-01",
                                             "status": "active"})
        if (m, path) == ("POST", "/books/b1/reservations"):
            return httpx.Response(201, json={"id": "r-1"})
        if (m, path) == ("GET", "/clubs/k1"):
            return httpx.Response(200, json=self.club)
        if (m, path) == ("POST", "/clubs/k1/members"):
            return httpx.Response(201, json={"id": "m-1", "clubId": "k1", "status": "PENDING"})
        return httpx.Response(404, json={"message": "introuvable"})


@pytest.fixture
def backend(monkeypatch):
    fake = FakeCampus()
    monkeypatch.setattr(main, "_store", InMemoryStore())
    monkeypatch.setattr(
        main, "make_campus",
        lambda settings, principal: CampusClient(
            academic_url="http://a", resources_url="http://r", residences_url="http://h", library_url="http://l",
            student_life_url="http://s", token=principal.token, transport=httpx.MockTransport(fake.handler)),
    )
    return fake


@pytest.fixture
def client(backend):
    return TestClient(main.app)


def steps(*calls, answer="Voila."):
    """Modele simule qui enchaine plusieurs outils (comme un vrai agent), puis repond."""
    queue = list(calls)

    def fn(messages, info: AgentInfo) -> ModelResponse:
        if queue:
            name, args = queue.pop(0)
            return ModelResponse(parts=[ToolCallPart(name, args)])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name,
                                                 {"answer": answer, "confidence": "high"})])

    return FunctionModel(fn)


def bearer_sub(auth: str | None) -> str:
    """Identite portee par le jeton que le service a RECU (compare le `sub`, pas la chaine entiere : l'`iat` varie)."""
    assert auth and auth.startswith("Bearer ")
    return jwt.decode(auth[7:], options={"verify_signature": False})["sub"]


def headers(role, sub):
    return {"Authorization": f"Bearer {make_token(role=role, sub=sub, name='Prof A')}"}


def chat(client, model, role="teacher", sub="ENS-2026-0007"):
    with main.get_agent().override(model=model):
        return client.post("/agent/chat", json={"message": "x"}, headers=headers(role, sub))


def confirm(client, action_id, role="teacher", sub="ENS-2026-0007"):
    return client.post(f"/agent/actions/{action_id}/confirm", headers=headers(role, sub))


def pending_of(response):
    return [a for a in response.json()["actions"] if a["status"] == "needs_confirmation"]


ROOM = ("propose_room_reservation", {"room_id": "3", "day": DAY, "start": "10:00", "end": "11:00", "attendees": 10,
                                    "purpose": "Cours de microservices"})


# ------------------------------------------------------------------ reservation de salle
def test_room_reservation_is_checked_then_proposed_but_not_executed(client, backend):
    r = chat(client, steps(("list_rooms", {}), ("check_room_availability", {"room_id": "3", "day": DAY}), ROOM))
    assert r.status_code == 200
    tools = [a["tool"] for a in r.json()["actions"]]
    assert tools[:2] == ["list_rooms", "check_room_availability"]  # il a enchaine des outils de lecture d'abord
    act = pending_of(r)[0]
    assert act["tool"] == "propose_room_reservation" and "Salle C12" in act["summary"] and DAY in act["summary"]
    assert backend.writes() == []  # AUCUNE ecriture sans clic


def test_confirm_executes_with_the_users_token_and_server_side_args(client, backend):
    act = pending_of(chat(client, steps(ROOM)))[0]
    r = confirm(client, act["confirmation_id"])
    assert r.status_code == 200
    done = r.json()["action"]
    assert done["status"] == "done" and "Réservation enregistrée" in done["summary"]
    method, path, auth, body = next(c for c in backend.calls if c[0] == "POST")
    assert (method, path) == ("POST", "/api/reservations")
    assert bearer_sub(auth) == "ENS-2026-0007"  # JETON DE L'UTILISATEUR, pas d'identite propre
    assert body == {"roomId": "3", "date": DAY, "start": "10:00", "end": "11:00", "attendees": 10,
                    "purpose": "Cours de microservices"}


def test_a_confirmation_is_single_use_and_bound_to_its_owner(client, backend):
    act = pending_of(chat(client, steps(ROOM)))[0]
    assert confirm(client, act["confirmation_id"], sub="ENS-2026-0099").status_code == 404  # un autre utilisateur
    assert backend.writes() == []
    assert confirm(client, act["confirmation_id"]).status_code == 200
    assert confirm(client, act["confirmation_id"]).status_code == 404  # deja utilisee
    assert len(backend.writes()) == 1


def test_a_conflicting_slot_opens_no_proposal(client, backend):
    backend.busy = [{"start": "10:30", "end": "12:00", "status": "confirmed"}]
    r = chat(client, steps(ROOM))
    assert pending_of(r) == []
    assert [a["status"] for a in r.json()["actions"]] == ["error"]
    assert backend.writes() == []


def test_a_pending_overlap_does_not_block_but_a_confirmed_one_does(client, backend):
    backend.busy = [{"start": "10:00", "end": "11:00", "status": "pending"}]
    assert len(pending_of(chat(client, steps(ROOM)))) == 1


@pytest.mark.parametrize("changes", [
    {"day": (today() - timedelta(days=1)).isoformat()},  # dans le passe
    {"start": "07:00", "end": "08:30"},  # avant l'ouverture
    {"start": "18:00", "end": "20:00"},  # apres la fermeture
    {"start": "11:00", "end": "10:00"},  # fin avant debut
    {"attendees": 500},  # depasse la capacite
    {"day": "demain"},  # format invalide
    {"purpose": "ok"},  # motif trop court
])
def test_invalid_reservations_never_open_a_proposal(client, backend, changes):
    r = chat(client, steps(("propose_room_reservation", {**ROOM[1], **changes})))
    assert pending_of(r) == [] and backend.writes() == []


# ------------------------------------------------------------------ visibilite par role
TOOLS_BY_ROLE = {
    # l'etudiant peut CONSULTER les disponibilites (lecture), mais ne voit aucun outil de reservation de salle
    "student": {"propose_book_loan", "propose_book_reservation", "propose_club_join", "check_room_availability"},
    "teacher": {"propose_room_reservation", "propose_book_loan", "propose_book_reservation", "propose_club_join",
                "list_reservations", "check_room_availability"},
    "admin": {"propose_room_reservation", "propose_reservation_decision", "propose_book_loan",
              "propose_book_reservation", "propose_club_join", "list_reservations", "check_room_availability"},
}
ALL = {"propose_room_reservation", "propose_reservation_decision", "propose_book_loan", "propose_book_reservation",
       "propose_club_join", "list_reservations"}


@pytest.mark.parametrize("role", ["student", "teacher", "admin"])
def test_action_tools_are_hidden_from_roles_that_cannot_use_them(client, role):
    seen = {}

    def fn(messages, info: AgentInfo) -> ModelResponse:
        seen["tools"] = {t.name for t in info.function_tools}
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {"answer": "ok", "confidence": "high"})])

    chat(client, FunctionModel(fn), role=role, sub="X-2026-0001")
    visible = seen["tools"] & (ALL | {"check_room_availability"})
    assert visible == TOOLS_BY_ROLE[role] & (ALL | {"check_room_availability"})


# ------------------------------------------------------------------ decision d'un administrateur
def test_admin_decision_is_proposed_then_executed_on_confirmation(client, backend):
    r = chat(client, steps(("list_reservations", {}),
                           ("propose_reservation_decision", {"reservation_id": "7", "decision": "confirmed"})),
             role="admin", sub="ADM-2026-0002")
    act = pending_of(r)[0]
    assert "Confirmer la reservation de Prof A" in act["summary"]
    assert ("GET", "/api/reservations") in [(m, p) for m, p, _, _ in backend.calls]
    assert backend.writes() == []
    assert confirm(client, act["confirmation_id"], role="admin", sub="ADM-2026-0002").json()["action"]["status"] == "done"
    _, path, _, body = next(c for c in backend.calls if c[0] == "PUT")
    assert path == "/api/reservations/7/status" and body == {"status": "confirmed"}


def test_an_already_decided_reservation_cannot_be_decided_again(client, backend):
    backend.reservation["status"] = "confirmed"
    r = chat(client, steps(("propose_reservation_decision", {"reservation_id": "7", "decision": "refused"})),
             role="admin", sub="ADM-2026-0002")
    assert pending_of(r) == [] and backend.writes() == []


# ------------------------------------------------------------------ livres
def test_book_loan_proposed_then_executed(client, backend):
    act = pending_of(chat(client, steps(("propose_book_loan", {"book_id": "b1"})), role="student", sub="ETU-2026-0002"))[0]
    assert "Clean Architecture" in act["summary"] and backend.writes() == []
    r = confirm(client, act["confirmation_id"], role="student", sub="ETU-2026-0002")
    assert r.json()["action"]["status"] == "done" and "Emprunt enregistré" in r.json()["action"]["summary"]
    _, path, auth, body = next(c for c in backend.calls if c[0] == "POST")
    assert (path, body) == ("/loans", {"bookId": "b1"})
    assert bearer_sub(auth) == "ETU-2026-0002"


def test_no_loan_proposal_when_no_copy_is_available_but_a_reservation_is_offered(client, backend):
    backend.book["available"] = 0
    backend.book["waiting"] = 2
    r = chat(client, steps(("propose_book_loan", {"book_id": "b1"}), ("propose_book_reservation", {"book_id": "b1"})),
             role="student", sub="ETU-2026-0002")
    kinds = [(a["tool"], a["status"]) for a in r.json()["actions"]]
    assert kinds == [("propose_book_loan", "error"), ("propose_book_reservation", "needs_confirmation")]
    act = pending_of(r)[0]
    assert confirm(client, act["confirmation_id"], role="student", sub="ETU-2026-0002").json()["action"]["status"] == "done"
    assert ("POST", "/books/b1/reservations") in backend.writes()


def test_loan_refused_when_the_book_is_already_borrowed_by_the_user(client, backend):
    backend.book["myLoanId"] = "l-1"
    r = chat(client, steps(("propose_book_loan", {"book_id": "b1"})), role="student", sub="ETU-2026-0002")
    assert pending_of(r) == []


# ------------------------------------------------------------------ clubs
def test_club_join_proposed_then_executed(client, backend):
    act = pending_of(chat(client, steps(("propose_club_join", {"club_id": "k1"})), role="student", sub="ETU-2026-0002"))[0]
    assert "Club Robotique" in act["summary"] and backend.writes() == []
    r = confirm(client, act["confirmation_id"], role="student", sub="ETU-2026-0002")
    assert r.json()["action"]["status"] == "done" and "Club Robotique" in r.json()["action"]["summary"]
    assert backend.writes() == [("POST", "/clubs/k1/members")]


def test_full_club_or_existing_membership_opens_no_proposal(client, backend):
    backend.club["members"] = 60
    assert pending_of(chat(client, steps(("propose_club_join", {"club_id": "k1"})), role="student", sub="E-1")) == []
    backend.club.update(members=10, myMembership={"id": "m-1", "status": "CONFIRMED"})
    assert pending_of(chat(client, steps(("propose_club_join", {"club_id": "k1"})), role="student", sub="E-1")) == []
    assert backend.writes() == []


# ------------------------------------------------------------------ confirmation : echec d'un service
def test_a_service_refusal_at_confirmation_is_reported_not_hidden(client, backend, monkeypatch):
    act = pending_of(chat(client, steps(ROOM)))[0]
    original = backend.handler

    def refusing(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(409, json={"message": "Salle C12 est déjà réservée sur ce créneau"})
        return original(request)

    monkeypatch.setattr(backend, "handler", refusing)
    done = confirm(client, act["confirmation_id"]).json()["action"]
    assert done["status"] == "error" and "déjà réservée" in done["summary"]


def test_a_forbidden_confirmation_is_marked_denied(client, backend, monkeypatch):
    act = pending_of(chat(client, steps(ROOM)))[0]
    monkeypatch.setattr(backend, "handler", lambda request: httpx.Response(403, json={}))
    assert confirm(client, act["confirmation_id"]).json()["action"]["status"] == "denied"
