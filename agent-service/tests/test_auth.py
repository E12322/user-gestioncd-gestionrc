import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import SECRET, make_token

client = TestClient(app)
BODY = {"message": "bonjour"}


def post(token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/agent/chat", json=BODY, headers=headers)


def test_health_is_public():
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("header", [None, "", "Bearer", "Basic abc", "Bearer not-a-jwt"])
def test_missing_or_malformed_header_is_401(header):
    headers = {"Authorization": header} if header is not None else {}
    assert client.post("/agent/chat", json=BODY, headers=headers).status_code == 401


def test_expired_token_is_401():
    assert post(make_token(exp=int(time.time()) - 10)).status_code == 401


def test_wrong_audience_and_issuer_are_401():
    assert post(make_token(aud="autre-app")).status_code == 401
    assert post(make_token(iss="pirate")).status_code == 401


def test_wrong_signature_is_401():
    now = int(time.time())
    forged = jwt.encode({"sub": "x", "role": "admin", "iss": "smartcampus-user-service",
                         "aud": "smartcampus", "iat": now, "exp": now + 60}, "autre-secret-0123456789-0123456789", "HS256")
    assert post(forged).status_code == 401


def test_alg_none_is_401():
    now = int(time.time())
    none_token = jwt.encode({"sub": "x", "role": "admin", "iss": "smartcampus-user-service",
                             "aud": "smartcampus", "iat": now, "exp": now + 60}, None, algorithm="none")
    assert post(none_token).status_code == 401


def test_unknown_role_and_missing_claims_are_401():
    assert post(make_token(role="superuser")).status_code == 401
    assert post(make_token(sub=None)).status_code == 401
    assert post(make_token(exp=None)).status_code == 401


def test_secret_is_what_signs_valid_tokens():
    assert SECRET and post(make_token()).status_code != 401
