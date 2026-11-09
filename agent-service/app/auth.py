"""Verification du JWT emis par le user-service.

Meme regles que le user-service : l'algorithme est FIXE cote serveur (jamais lu dans le jeton), donc pas d'attaque
`alg: none` ni de confusion RS256 -> HS256. Emetteur, audience et expiration sont obligatoires.
"""
from dataclasses import dataclass
from typing import Annotated, get_args

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from jwt import PyJWKClient

from app.config import Settings, get_settings
from app.schemas import Role

ACCESS_COOKIE = "sc_access"  # meme cookie que le user-service (session httpOnly du front)
AUTH_MODE_HEADER = "x-auth-mode"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

_jwks_clients: dict[str, PyJWKClient] = {}


@dataclass(frozen=True)
class Principal:
    """Utilisateur authentifie. `token` est reutilise pour appeler les autres services EN SON NOM."""

    sub: str
    name: str
    role: Role
    token: str


def _jwks(url: str) -> PyJWKClient:
    # Cache des cles publiques (le user-service les publie 5 min et conserve l'ancienne cle pendant une rotation).
    if url not in _jwks_clients:
        _jwks_clients[url] = PyJWKClient(url, cache_keys=True, lifespan=300, timeout=5)
    return _jwks_clients[url]


def verify_token(token: str, settings: Settings) -> Principal:
    common = {
        "issuer": settings.jwt_issuer,
        "audience": settings.jwt_audience,
        "options": {"require": ["exp", "iat", "sub", "iss", "aud"]},
    }
    if settings.jwks_url:
        key = _jwks(settings.jwks_url).get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], **common)
    else:
        if not settings.jwt_secret:  # impossible (valide par Settings), mais jamais d'acces sans cle
            raise jwt.InvalidTokenError("aucune cle configuree")
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], **common)

    role = claims.get("role")
    if role not in get_args(Role):
        raise jwt.InvalidTokenError("role inconnu")
    return Principal(sub=str(claims["sub"]), name=str(claims.get("name", "")), role=role, token=token)


def _check_csrf(request: Request, settings: Settings) -> None:
    """Protection CSRF d'une requete authentifiee par COOKIE (joint par le navigateur, meme depuis un site tiers).
    Meme regle que le user-service : en-tete personnalise `X-Auth-Mode: cookie` + origine dans la liste blanche CORS.
    Une requete authentifiee par `Authorization: Bearer` n'est pas concernee (un site tiers ne peut pas l'ajouter)."""
    allowed = {o.strip() for o in settings.cors_origins.split(",") if o.strip()}
    origin = request.headers.get("origin")
    if request.headers.get(AUTH_MODE_HEADER) != "cookie" or (origin is not None and origin not in allowed):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requete refusee (protection CSRF)")


def current_principal(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Authentification requise", headers={"WWW-Authenticate": "Bearer"}
    )
    scheme, _, token = (authorization or "").partition(" ")
    from_cookie = False
    if scheme.lower() != "bearer" or not token:  # sans Bearer : session par cookie httpOnly du front
        token = request.cookies.get(ACCESS_COOKIE, "")
        from_cookie = bool(token)
    if not token:
        raise unauthorized
    if from_cookie and request.method not in SAFE_METHODS:
        _check_csrf(request, settings)
    try:
        return verify_token(token, settings)
    except (jwt.PyJWTError, jwt.PyJWKClientError):
        # Message volontairement generique : ne pas dire pourquoi le jeton est refuse.
        raise unauthorized from None
