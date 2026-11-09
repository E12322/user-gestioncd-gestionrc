import base64
import json
import time
import types

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic_ai import ModelResponse, ToolCallPart
from pydantic_ai.messages import BinaryContent, UserPromptPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

import app.main as main
from app.knowledge import KnowledgeBase
from app.memory import InMemoryStore
from app.tools.users import UserServiceClient
from tests.conftest import make_token

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
requests_seen: list[tuple[str, str, bytes]] = []
PROFILE = {"id": "ETU-2026-0001", "firstName": "Amel", "lastName": "Test", "phone": "+216 11 111 111"}


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    requests_seen.clear()
    monkeypatch.setattr(main, "_store", InMemoryStore())

    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append((request.method, request.url.path, request.content))
        return httpx.Response(200, json=PROFILE)

    monkeypatch.setattr(
        main, "UserServiceClient",
        lambda url, token: UserServiceClient(url, token, transport=httpx.MockTransport(handler)),
    )
    return TestClient(main.app)


def auth(role="student", sub="ETU-2026-0001"):
    return {"Authorization": f"Bearer {make_token(role=role, sub=sub)}"}


def scripted(tool=None, args=None, answer="Voila."):
    state = {"called": False}

    def fn(messages, info: AgentInfo) -> ModelResponse:
        if tool and not state["called"]:
            state["called"] = True
            return ModelResponse(parts=[ToolCallPart(tool, args or {})])
        out = {"answer": answer, "confidence": "medium"}
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, out)])

    return FunctionModel(fn)


def chat(c, model, role="student", sub="ETU-2026-0001", **body):
    with main.get_agent().override(model=model):
        return c.post("/agent/chat", json={"message": "x", **body}, headers=auth(role, sub))


# ------------------------------------------------------------ RAG filtre par role
def test_rag_student_never_sees_admin_documents():
    kb = KnowledgeBase.from_dir()
    q = "procedures reservees au personnel direction des etudes"
    for role in ("student", "teacher"):
        assert all("réservées au personnel" not in h["source"] for h in kb.search(q, role))
    assert any("réservées au personnel" in h["source"] for h in kb.search(q, "admin"))
    assert any("Bibliothèque" in h["source"] for h in kb.search("emprunter ouvrages bibliotheque", "student"))


def test_rag_teacher_sees_teacher_guide_student_does_not():
    kb = KnowledgeBase.from_dir()
    assert any("Guide enseignant" in h["source"] for h in kb.search("saisie des notes et reservation de salles", "teacher"))
    assert all("Guide enseignant" not in h["source"] for h in kb.search("saisie des notes et reservation de salles", "student"))


def test_rag_unknown_or_empty_query_returns_nothing():
    kb = KnowledgeBase.from_dir()
    assert kb.search("", "admin") == []
    assert kb.search("zzzqqq", "admin") == []


def test_chat_returns_sources(fresh):
    r = chat(fresh, scripted("search_knowledge", {"query": "delai pour justifier une absence"}))
    assert r.status_code == 200
    assert any("Règlement intérieur" in src for src in r.json()["sources"])


# ------------------------------------------------------------ ecriture avec confirmation
def propose(c, phone="+216 22 222 222", **kw):
    return chat(c, scripted("propose_phone_update", {"phone": phone}), **kw)


def test_write_is_only_proposed_never_executed_by_the_model(fresh):
    r = propose(fresh)
    act = r.json()["actions"][0]
    assert act["status"] == "needs_confirmation" and act["confirmation_id"] and "22 222 222" in act["summary"]
    assert [m for m, _, _ in requests_seen if m != "GET"] == []  # AUCUNE ecriture sans confirmation


def test_confirm_executes_once_with_user_identity(fresh):
    cid = propose(fresh).json()["actions"][0]["confirmation_id"]
    r = fresh.post(f"/agent/actions/{cid}/confirm", headers=auth())
    assert r.status_code == 200 and r.json()["action"]["status"] == "done"
    puts = [(p, json.loads(b)) for m, p, b in requests_seen if m == "PUT"]
    expected = {"firstName": "Amel", "lastName": "Test", "phone": "+216 22 222 222"}
    assert puts == [("/users/ETU-2026-0001", expected)]
    assert fresh.post(f"/agent/actions/{cid}/confirm", headers=auth()).status_code == 404  # usage unique


def test_other_user_cannot_confirm_my_action(fresh):
    cid = propose(fresh).json()["actions"][0]["confirmation_id"]
    r = fresh.post(f"/agent/actions/{cid}/confirm", headers=auth(sub="ETU-2026-0002"))
    assert r.status_code == 404
    assert [m for m, _, _ in requests_seen if m == "PUT"] == []
    assert fresh.post(f"/agent/actions/{cid}/confirm", headers=auth()).status_code == 200  # toujours valable pour moi


def test_cancel_prevents_execution(fresh):
    cid = propose(fresh).json()["actions"][0]["confirmation_id"]
    assert fresh.post(f"/agent/actions/{cid}/cancel", headers=auth()).status_code == 204
    assert fresh.post(f"/agent/actions/{cid}/confirm", headers=auth()).status_code == 404


def test_confirm_requires_valid_jwt(fresh):
    assert fresh.post("/agent/actions/abc/confirm").status_code == 401


def test_invalid_phone_is_rejected_without_proposal(fresh):
    act = propose(fresh, phone="12; DROP TABLE").json()["actions"][0]
    assert act["status"] == "error" and act["confirmation_id"] is None


def test_pending_cap_per_user(fresh):
    statuses = [propose(fresh).json()["actions"][0]["status"] for _ in range(7)]
    assert statuses.count("needs_confirmation") == 5 and statuses[-1] == "error"


def test_expired_action_is_gone(fresh, monkeypatch):
    cid = propose(fresh).json()["actions"][0]["confirmation_id"]
    real = time.time()
    monkeypatch.setattr("app.pending.time", types.SimpleNamespace(time=lambda: real + 301))
    assert fresh.post(f"/agent/actions/{cid}/confirm", headers=auth()).status_code == 404


# ------------------------------------------------------------ vision
def png_b64(data=PNG):
    return base64.b64encode(data).decode()


def test_image_is_passed_to_the_model_and_not_kept_in_history(fresh):
    seen = {}

    def fn(messages, info):
        for m in messages:
            for p in m.parts:
                if isinstance(p, UserPromptPart) and not isinstance(p.content, str):
                    seen["binary"] = any(isinstance(c, BinaryContent) for c in p.content)
        out = {"answer": "Je vois une image.", "confidence": "low"}
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, out)])

    r = chat(fresh, FunctionModel(fn), image_b64=png_b64(), image_media_type="image/png")
    assert r.status_code == 200 and seen["binary"] is True
    stored = next(iter(main._store._data.values()))[1][0]
    assert b"[image jointe]" in stored and png_b64().encode() not in stored


BIG = b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024)


@pytest.mark.parametrize("payload", [
    {"image_b64": "@@@", "image_media_type": "image/png"},  # pas du base64
    {"image_b64": base64.b64encode(b"MZ" + b"\x00" * 50).decode(), "image_media_type": "image/png"},  # exe en png
    {"image_b64": base64.b64encode(PNG).decode(), "image_media_type": "image/jpeg"},  # type annonce faux
    {"image_b64": base64.b64encode(BIG).decode(), "image_media_type": "image/png"},  # trop lourde
    {"image_b64": base64.b64encode(PNG).decode()},  # type manquant
    {"image_b64": base64.b64encode(PNG).decode(), "image_media_type": "image/svg+xml"},  # svg refuse
])
def test_invalid_images_are_rejected(fresh, payload):
    assert chat(fresh, scripted(), **payload).status_code == 422


# ------------------------------------------------------------ voix
def test_audio_unavailable_is_501(fresh):
    assert chat(fresh, scripted(), want_audio=True).status_code == 501  # TTS_PROVIDER=none par defaut


def test_audio_returned_when_tts_available(fresh, monkeypatch):
    class Fake:
        async def synthesize(self, text):
            return b"RIFFfakewav"

    monkeypatch.setattr(main, "get_tts", lambda settings: Fake())
    r = chat(fresh, scripted(answer="Bonjour"), want_audio=True)
    assert base64.b64decode(r.json()["audio_b64"]) == b"RIFFfakewav"


def test_tts_failure_does_not_break_text_answer(fresh, monkeypatch):
    class Broken:
        async def synthesize(self, text):
            raise RuntimeError("gpu")

    monkeypatch.setattr(main, "get_tts", lambda settings: Broken())
    r = chat(fresh, scripted(), want_audio=True)
    assert r.status_code == 200 and r.json()["audio_b64"] is None and r.json()["answer"]


# ------------------------------------------------------------ exports
def test_export_markdown(fresh):
    md = chat(fresh, scripted("get_my_profile"), output_format="markdown").json()["markdown"]
    assert md.startswith("# Reponse SmartCampus") and "## Actions" in md and "`get_my_profile`" in md


def test_export_pdf_is_a_real_pdf_even_with_non_latin_text(fresh):
    r = chat(fresh, scripted(answer="Résumé : naïve café — 日本語 ✓"), output_format="pdf")
    pdf = base64.b64decode(r.json()["pdf_b64"])
    assert pdf.startswith(b"%PDF-") and len(pdf) > 500


def test_json_is_default_and_has_no_extras(fresh):
    body = chat(fresh, scripted()).json()
    assert body["markdown"] is None and body["pdf_b64"] is None and body["audio_b64"] is None


# ------------------------------------------------------------ cout / abus
def test_rate_limit_is_per_user(fresh):
    codes = [chat(fresh, scripted()).status_code for _ in range(22)]
    assert codes[:20] == [200] * 20 and codes[20:] == [429, 429]
    assert chat(fresh, scripted(), sub="ETU-2026-0009").status_code == 200  # le quota est par utilisateur


# ------------------------------------------------------------ corpus d'exemple
def test_example_corpus_is_always_labeled_and_has_explicit_audience():
    from app.knowledge import KNOWLEDGE_DIR, _parse

    for path in KNOWLEDGE_DIR.glob("*-exemple.md"):
        assert "audience:" in path.read_text(encoding="utf-8"), f"{path.name}: audience manquante"
        for chunk in _parse(path):
            assert "[EXEMPLE]" in chunk.text, f"{path.name} > {chunk.source}: mention [EXEMPLE] manquante"


@pytest.mark.parametrize("question,role,expected", [
    ("Comment justifier une absence ?", "student", "Absences"),
    ("quand ont lieu les examens du semestre", "student", "Calendrier"),
    ("comment obtenir une attestation de scolarite", "student", "Procédures administratives"),
    ("comment adherer a un club", "student", "Clubs"),
    ("comment saisir les notes", "teacher", "Saisie des notes"),
    ("combien de temps pour emprunter un livre", "student", "Bibliothèque"),
])
def test_retrieval_finds_the_right_passage(question, role, expected):
    top = KnowledgeBase.from_dir().search(question, role, k=3)
    assert any(expected in h["source"] for h in top), [h["source"] for h in top]


def test_student_faq_is_not_visible_to_teacher():
    kb = KnowledgeBase.from_dir()
    assert all("FAQ" not in h["source"] for h in kb.search("comment reserver une salle de travail", "teacher"))


@pytest.mark.parametrize("question,role,must_contain", [
    ("delai pour justifier une absence", "student", "une semaine"),
    ("montant total des frais de scolarite", "student", "8 800 DT"),
    ("date limite deuxieme tranche des frais", "student", "15 janvier"),
    ("annuler mon inscription jusqu a quand", "student", "30 novembre"),
    ("note pour valider une UE", "student", "8/20"),
    ("combien coute une chambre double au foyer", "student", "3 350 DT"),
    ("qui contacter en cas de stress", "student", "cellule.decoute@esprit.tn"),
    ("duree minimale du PFE", "student", "26 semaines"),
])
def test_real_facts_are_retrievable(question, role, must_contain):
    hits = KnowledgeBase.from_dir().search(question, role, k=4)
    assert any(must_contain in h["text"] for h in hits), [h["source"] for h in hits]


def test_unpublished_topics_say_so_instead_of_inventing():
    kb = KnowledgeBase.from_dir()
    lib = " ".join(h["text"] for h in kb.search("duree du pret bibliotheque penalites", "student"))
    assert "ne sont pas publiés" in lib
