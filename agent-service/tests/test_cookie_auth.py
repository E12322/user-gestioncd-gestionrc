"""Session par cookie httpOnly `sc_access` (celle du front) : acceptee, mais avec la protection CSRF du user-service."""
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic_ai import ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

import app.main as main
from app.agent import resolve_model
from app.memory import InMemoryStore
from app.tools.users import UserServiceClient
from tests.conftest import make_token

ORIGIN = "http://localhost:5173"  # CORS_ORIGINS par defaut


@pytest.fixture
def c(monkeypatch):
    monkeypatch.setattr(main, "_store", InMemoryStore())
    handler = lambda request: httpx.Response(200, json={"id": "x"})  # noqa: E731
    monkeypatch.setattr(main, "UserServiceClient",
                        lambda url, token: UserServiceClient(url, token, transport=httpx.MockTransport(handler)))
    return TestClient(main.app)


def model():
    def fn(messages, info: AgentInfo) -> ModelResponse:
        out = {"answer": "ok", "confidence": "low"}
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, out)])
    return FunctionModel(fn)


def post(c, path="/agent/chat", json=None, cookie=True, headers=None, token=None):
    if cookie:
        c.cookies.set("sc_access", token or make_token())
    with main.get_agent().override(model=model()):
        return c.post(path, json=json or {"message": "x"}, headers=headers or {})


def test_cookie_session_with_csrf_headers_is_accepted(c):
    r = post(c, headers={"X-Auth-Mode": "cookie", "Origin": ORIGIN})
    assert r.status_code == 200 and r.json()["role"] == "student"


def test_cookie_without_auth_mode_header_is_csrf_rejected(c):
    r = post(c, headers={"Origin": ORIGIN})
    assert r.status_code == 403 and "CSRF" in r.json()["detail"]


def test_cookie_from_foreign_origin_is_csrf_rejected(c):
    r = post(c, headers={"X-Auth-Mode": "cookie", "Origin": "https://evil.example"})
    assert r.status_code == 403


def test_cookie_confirm_action_is_also_csrf_protected(c):
    assert post(c, "/agent/actions/abc/confirm", headers={"Origin": "https://evil.example"}).status_code == 403
    assert post(c, "/agent/actions/abc/confirm", headers={"X-Auth-Mode": "cookie", "Origin": ORIGIN}).status_code == 404


def test_bearer_takes_precedence_and_needs_no_csrf_headers(c):
    r = post(c, cookie=False, headers={"Authorization": f"Bearer {make_token(role='teacher')}"})
    assert r.status_code == 200 and r.json()["role"] == "teacher"
    # meme avec un cookie de navigateur present (ex. page de demo sur le meme hote) : le Bearer l'emporte
    c.cookies.set("sc_access", make_token(role="admin"))
    with main.get_agent().override(model=model()):
        r = c.post("/agent/chat", json={"message": "x"}, headers={"Authorization": f"Bearer {make_token()}"})
    assert r.status_code == 200 and r.json()["role"] == "student"


def test_invalid_or_expired_cookie_is_401(c):
    assert post(c, token="not-a-jwt", headers={"X-Auth-Mode": "cookie", "Origin": ORIGIN}).status_code == 401


def test_no_credentials_at_all_is_401(c):
    assert post(c, cookie=False).status_code == 401


def test_cors_preflight_allows_credentials_for_the_front_only(c):
    ok = c.options("/agent/chat", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST",
                                           "Access-Control-Request-Headers": "content-type,x-auth-mode"})
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == ORIGIN
    assert ok.headers["access-control-allow-credentials"] == "true"
    bad = c.options("/agent/chat", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_model_list_builds_a_fallback_chain(monkeypatch):
    from pydantic_ai.models.fallback import FallbackModel

    monkeypatch.setenv("GOOGLE_API_KEY", "x")
    assert resolve_model("google:gemini-a") == "google:gemini-a"
    chain = resolve_model("google:gemini-a, google:gemini-b")
    assert isinstance(chain, FallbackModel)
