import asyncio

import httpx
from fastapi.testclient import TestClient
from pydantic_ai import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

import app.main as main
from app.memory import InMemoryStore
from app.tools.campus import MAX_ITEMS, CampusClient
from app.tools.users import ToolError
from tests.conftest import make_token

COURSES = [
    {"id": i, "code": f"INF-{i:02d}", "intitule": f"Cours {i}", "departement": "Info", "credits": 3,
     "semestre": "S1", "enseignantNom": "Mme X", "capacite": 40, "nature": "OBLIGATOIRE",
     "videoUrl": "http://secret", "contenu": "long texte"} for i in range(30)
]
ROOMS = [
    {"id": "1", "name": "Amphi A", "building": "Bloc A", "floor": 0, "kind": "amphi", "capacity": 220,
     "equipment": [{"id": "p", "label": "Videoprojecteur"}], "bookedHoursToday": 0.0, "openHours": 11},
    {"id": "3", "name": "Salle C12", "building": "Bloc C", "floor": 1, "kind": "classroom", "capacity": 40,
     "equipment": [], "bookedHoursToday": 1.0, "openHours": 11},
]
BOOKS = [{"id": "b1", "title": "Clean Architecture", "author": "Martin", "category": "Info", "copies": 2,
          "available": 0, "waiting": 2, "myLoanId": "l-9", "isbn": "x"}]
LOANS = {"loans": [{"id": "l-1", "bookTitle": "T", "bookAuthor": "A", "dueDate": "2026-11-10", "status": "active",
                    "borrowerId": "ETU-1", "borrowerName": "Autre"}], "reservations": [], "limit": 3}
CLUBS = [
    {"id": "k1", "name": "Club Robotique", "category": "Technologie", "description": "Robots", "meetingPlace": "B",
     "members": 48, "maxMembers": 60, "secretField": "x"},
    {"id": "k2", "name": "Club Theatre", "category": "Arts", "description": "Scene", "meetingPlace": "A",
     "members": 10, "maxMembers": 30},
]
EVENTS = [{"id": "ev-1", "title": "Journee des clubs", "description": "d", "date": "2026-11-11", "start": "10:00",
           "end": "16:00", "location": "Esplanade", "clubName": None, "internal": "x"}]
seen_auth: list[str] = []


def _client(status: int = 200) -> CampusClient:
    def handler(request: httpx.Request) -> httpx.Response:
        seen_auth.append(request.headers.get("authorization", ""))
        if status != 200:
            return httpx.Response(status, json={})
        path = request.url.path
        if path == "/api/academic/v1/courses":
            return httpx.Response(200, json=COURSES)
        if path == "/api/rooms":
            return httpx.Response(200, json=ROOMS)
        if path == "/api/chambres":
            return httpx.Response(200, json=[{"id": 1, "numero": "A1"}])
        if path == "/books":
            return httpx.Response(200, json=BOOKS)
        if path == "/loans/me":
            return httpx.Response(200, json=LOANS)
        if path == "/clubs":
            return httpx.Response(200, json=CLUBS)
        if path == "/events":
            return httpx.Response(200, json=EVENTS)
        if path == "/memberships/mine":
            return httpx.Response(200, json=[{"id": "m1", "clubId": "k1", "status": "PENDING"}])
        if path == "/events/my-registrations":
            return httpx.Response(200, json=[])
        return httpx.Response(404, json={})

    return CampusClient(
        academic_url="http://a", resources_url="http://r", residences_url="http://h", library_url="http://l",
        token="JWT-USER", transport=httpx.MockTransport(handler),
    )


def run(coro):
    return asyncio.run(coro)


def test_courses_are_capped_filtered_and_trimmed():
    out = run(_client().list_courses())
    assert out["total"] == 30 and out["shown"] == MAX_ITEMS and len(out["items"]) == MAX_ITEMS
    assert "videoUrl" not in out["items"][0] and "contenu" not in out["items"][0]
    one = run(_client().list_courses("inf-07"))
    assert one["total"] == 1 and one["items"][0]["code"] == "INF-07"


def test_rooms_filter_by_capacity_and_flatten_equipment():
    out = run(_client().list_rooms(min_capacity=100))
    assert [r["name"] for r in out["items"]] == ["Amphi A"]
    assert out["items"][0]["equipment"] == ["Videoprojecteur"]


def test_books_hide_personal_fields_and_loans_keep_only_mine_fields():
    assert "myLoanId" not in run(_client().list_books())["items"][0]
    loans = run(_client().my_library())["loans"][0]
    assert "borrowerName" not in loans and loans["bookTitle"] == "T"


def test_clubs_and_events_are_filtered_and_trimmed():
    clubs = run(_client().list_clubs("robot"))
    assert clubs["total"] == 1 and "secretField" not in clubs["items"][0]
    events = run(_client().list_events())
    assert events["items"][0]["title"] == "Journee des clubs" and "internal" not in events["items"][0]
    mine = run(_client().my_student_life())
    assert mine["memberships"]["total"] == 1 and mine["event_registrations"]["total"] == 0


def test_calls_carry_the_user_token():
    seen_auth.clear()
    run(_client().list_chambres())
    assert seen_auth == ["Bearer JWT-USER"]


def test_service_errors_are_readable():
    for status, word in ((403, "refus"), (500, "500")):
        try:
            run(_client(status).list_rooms())
        except ToolError as exc:
            assert word in str(exc).lower()
        else:
            raise AssertionError("ToolError attendue")


# --- Visibilite des outils selon la permission du role (le modele ne voit pas ce qu'il ne peut pas utiliser) ---
seen: dict = {"tools": None}
CLUB_TOOLS = {"list_clubs", "list_events", "get_my_club_activity"}


def _model():
    def fn(messages, info: AgentInfo) -> ModelResponse:
        seen["tools"] = sorted(t.name for t in info.function_tools)
        return ModelResponse(parts=[ToolCallPart("final_result", {"answer": "ok", "confidence": "high"})])

    return FunctionModel(fn)


def test_campus_tools_visible_per_role(monkeypatch):
    monkeypatch.setattr(main, "_store", InMemoryStore())
    client = TestClient(main.app)
    for role, expected in (
        ("student", {"list_courses", "list_rooms", "list_chambres", "search_books", "get_my_loans", *CLUB_TOOLS}),
        ("teacher", {"list_courses", "list_rooms", "search_books", "get_my_loans", *CLUB_TOOLS}),
    ):
        h = {"Authorization": f"Bearer {make_token(role=role)}"}
        with main.get_agent().override(model=_model()):
            assert client.post("/agent/chat", json={"message": "bonjour"}, headers=h).status_code == 200
        campus = {t for t in seen["tools"] if t in {"list_courses", "list_rooms", "list_chambres", "search_books",
                                                    "get_my_loans", *CLUB_TOOLS}}
        assert campus == expected, role
