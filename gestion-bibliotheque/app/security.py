import os
from typing import Optional

from fastapi import Header, HTTPException, Request
from jose import jwt, JWTError

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_ISSUER, JWT_AUDIENCE
from app.schemas import UserContext

# Rôles SmartCampus : student, teacher, admin
LOAN_RULES = {
    "student": {"days": 14, "limit": 3},
    "teacher": {"days": 30, "limit": 5},
    "admin": {"days": 30, "limit": 5},
}
MAX_RENEWALS = 2

# Cookie `httpOnly` posé par le service Utilisateurs (session du navigateur).
ACCESS_COOKIE = "sc_access"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def allow_insecure_identity() -> bool:
    """
    Identité « démo » : en-têtes X-User-* acceptés et utilisateur par défaut. DANGEREUX (n'importe qui peut se déclarer admin) :
    désactivé par défaut, à n'activer (AUTH_ALLOW_INSECURE_IDENTITY=true) que pour les tests ou une démo isolée.
    Lu à chaque appel pour pouvoir être modifié sans redémarrer les tests.
    """
    return os.getenv("AUTH_ALLOW_INSECURE_IDENTITY", "false").lower() in ("true", "1", "yes")


def cors_origins() -> list[str]:
    return [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]


def _unauthorized(detail: str = "Authentification requise") -> HTTPException:
    return HTTPException(status_code=401, detail=detail)


def _decode(token: str) -> UserContext:
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except JWTError:
        raise _unauthorized("Jeton invalide ou expiré")
    sub = payload.get("sub")
    role = payload.get("role")
    if not sub or not role:
        raise _unauthorized("Jeton incomplet")
    name = payload.get("name") or payload.get("email") or "Utilisateur"
    return UserContext(id=str(sub), name=str(name), role=str(role))


def _check_same_app(request: Request) -> None:
    """Protection CSRF d'une écriture authentifiée par COOKIE : en-tête X-Auth-Mode + origine autorisée."""
    origin = request.headers.get("origin")
    if request.headers.get("x-auth-mode") != "cookie" or not origin or origin not in cors_origins():
        raise HTTPException(status_code=403, detail="Requête refusée (origine non autorisée)")


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> UserContext:
    """
    Identité de l'utilisateur :
    1. JWT dans `Authorization: Bearer` (services, scripts), sinon dans le cookie `sc_access` (navigateur) ;
    2. sans jeton : 401. Les en-têtes X-User-* et l'utilisateur par défaut ne sont acceptés que si
       AUTH_ALLOW_INSECURE_IDENTITY=true (tests, démo isolée).
    """
    if authorization and authorization.startswith("Bearer "):
        return _decode(authorization.split(" ", 1)[1].strip())

    cookie_token = request.cookies.get(ACCESS_COOKIE)
    if cookie_token:
        if request.method not in SAFE_METHODS:
            _check_same_app(request)
        return _decode(cookie_token)

    if allow_insecure_identity():
        if x_user_id:
            return UserContext(id=x_user_id, name=x_user_name or "Utilisateur Test", role=x_user_role or "student")
        return UserContext(id="ETU-2024-0187", name="Yasmine Ben Salah", role="student")

    raise _unauthorized()


def require_admin(user: UserContext) -> UserContext:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return user
