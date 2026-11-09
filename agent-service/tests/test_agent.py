import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic_ai import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

import app.main as main
from app.tools.users import UserServiceClient
from tests.conftest import make_token

seen: dict = {"tool_names": None, "auth": []}


def user_service(status=200):
    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"].append(request.headers.get("authorization"))
        if status != 200:
            return httpx.Response(status, json={"message": "x"})
        return httpx.Response(200, json={"_id": "ETU-2026-0001", "firstName": "Amel", "role": "student"})
    return httpx.MockTransport(handler)


@pytest.fixture
def client(monkeypatch):
    def install(status=200):
        monkeypatch.setattr(
            main, "UserServiceClient",
            lambda url, token: UserServiceClient(url, token, transport=user_service(status)),
        )
        return TestClient(main.app)
    return install


def scripted_model(call_tool: str | None = "get_my_profile", args: dict | None = None):
    """Faux modele : appelle un outil puis rend une reponse structuree (aucun appel reseau a Claude)."""
    def fn(messages, info: AgentInfo) -> ModelResponse:
        seen["tool_names"] = sorted(t.name for t in info.function_tools)
        already_called = any(getattr(p, "part_kind", "") == "tool-return" for m in messages for p in m.parts)
        if call_tool and not already_called:
            return ModelResponse(parts=[ToolCallPart(call_tool, args or {})])
        out = info.output_tools[0]
        return ModelResponse(parts=[ToolCallPart(out.name, {"answer": "Voici votre profil.", "confidence": "high"})])
    return FunctionModel(fn)


def chat(c, role="student", sub="ETU-2026-0001", **kw):
    with main.get_agent().override(model=scripted_model(**kw)):
        return c.post("/agent/chat", json={"message": "mon profil ?"},
                      headers={"Authorization": f"Bearer {make_token(role=role, sub=sub)}"})


def test_happy_path_returns_structured_response_and_audit_trail(client):
    r = chat(client())
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] and body["confidence"] == "high" and body["role"] == "student"
    assert body["actions"] == [
        {"tool": "get_my_profile", "args": {"user_id": "ETU-2026-0001"}, "status": "done",
         "confirmation_id": None, "summary": None}
    ]


def test_user_token_is_forwarded_not_a_service_account(client):
    seen["auth"].clear()
    chat(client())
    assert seen["auth"] and all(a and a.startswith("Bearer ey") for a in seen["auth"])


def test_student_does_not_see_admin_tool_but_admin_does(client):
    chat(client(), role="student")
    assert "get_user_profile" not in seen["tool_names"] and "get_my_profile" in seen["tool_names"]
    chat(client(), role="admin", sub="ADM-2026-0001", call_tool=None)
    assert "get_user_profile" in seen["tool_names"]


def test_forbidden_by_user_service_is_reported_as_denied(client):
    r = chat(client(status=403))
    assert r.status_code == 200
    assert r.json()["actions"][0]["status"] == "denied"


def test_service_down_is_reported_as_error_not_crash(client, monkeypatch):
    def boom(request):
        raise httpx.ConnectError("down")
    monkeypatch.setattr(main, "UserServiceClient",
                        lambda url, token: UserServiceClient(url, token, transport=httpx.MockTransport(boom)))
    r = chat(TestClient(main.app))
    assert r.status_code == 200 and r.json()["actions"][0]["status"] == "error"


def test_message_too_long_is_413(client):
    r = client().post("/agent/chat", json={"message": "a" * 5000},
                      headers={"Authorization": f"Bearer {make_token()}"})
    assert r.status_code == 413


def test_empty_message_is_422(client):
    r = client().post("/agent/chat", json={"message": ""}, headers={"Authorization": f"Bearer {make_token()}"})
    assert r.status_code == 422


def test_provider_quota_is_reported_as_429_not_a_generic_failure(client):
    from pydantic_ai.exceptions import ModelRateLimitError

    def quota(messages, info):
        raise ModelRateLimitError("m", "quota exceeded for project 123", body={"error": "quota"})

    c = client()
    with main.get_agent().override(model=FunctionModel(quota)):
        r = c.post("/agent/chat", json={"message": "x"}, headers={"Authorization": f"Bearer {make_token()}"})
    assert r.status_code == 429 and r.headers["retry-after"] == "60"
    assert "quota" not in r.text.lower() and "123" not in r.text  # pas de detail technique renvoye au client


def test_overloaded_provider_is_503(client):
    from pydantic_ai.exceptions import ModelUnavailableError

    def down(messages, info):
        raise ModelUnavailableError("m", "high demand")

    c = client()
    with main.get_agent().override(model=FunctionModel(down)):
        r = c.post("/agent/chat", json={"message": "x"}, headers={"Authorization": f"Bearer {make_token()}"})
    assert r.status_code == 503 and "high demand" not in r.text
