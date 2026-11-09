import os

# Doit etre defini AVANT l'import de app.main (la configuration est lue a l'import).
os.environ.update({
    "ENVIRONMENT": "development",
    "JWT_SECRET": "test-secret-0123456789-0123456789-abcd",
    "JWT_ISSUER": "smartcampus-user-service",
    "JWT_AUDIENCE": "smartcampus",
    "USER_SERVICE_URL": "http://user-service.test",
    "ANTHROPIC_API_KEY": "sk-test-not-used",
    "AGENT_MODEL": "test",
})
# Les tests ne dependent JAMAIS du .env local : valeurs vides = "non configure" (une variable d'environnement
# l'emporte sur le fichier .env, alors qu'un simple pop la laisserait lire le .env).
os.environ.update({"JWKS_URL": "", "MONGO_URI": "", "TTS_PROVIDER": "none", "RATE_LIMIT_PER_MINUTE": "20"})

import time  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402

SECRET = os.environ["JWT_SECRET"]


def make_token(role="student", sub="ETU-2026-0001", name="Amel Test", **override) -> str:
    now = int(time.time())
    claims = {"sub": sub, "name": name, "role": role, "iss": "smartcampus-user-service",
              "aud": "smartcampus", "iat": now, "exp": now + 600}
    claims.update(override)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, SECRET, algorithm="HS256")


@pytest.fixture
def token():
    return make_token


@pytest.fixture(autouse=True)
def _reset_state():
    """Etat en RAM remis a zero entre les tests (limiteur, actions en attente)."""
    import app.main as main
    from app.pending import get_pending

    main._hits.clear()
    get_pending()._items.clear()
    yield
