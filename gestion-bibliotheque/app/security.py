from typing import Optional
from fastapi import Header, HTTPException
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

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> UserContext:
    """
    Extrait l'identité de l'utilisateur :
    1. Soit via le token JWT (Bearer <token>)
    2. Soit via headers X-User-* transmis par la Gateway / mode démo
    3. Ou fallback utilisateur par défaut pour faciliter le test
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            # Vérifie le JWT avec le secret configuré
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"verify_aud": False, "verify_iss": False}
            )
            sub = payload.get("sub")
            name = payload.get("name") or payload.get("email") or "Utilisateur"
            role = payload.get("role", "student")
            if sub:
                return UserContext(id=str(sub), name=str(name), role=str(role))
        except JWTError:
            pass  # Fallback si token malformé ou headers alternatifs présents

    if x_user_id:
        return UserContext(
            id=x_user_id,
            name=x_user_name or "Utilisateur Test",
            role=x_user_role or "student"
        )

    # Identité par défaut (étudiante de démo comme dans le frontend)
    return UserContext(
        id="ETU-2024-0187",
        name="Yasmine Ben Salah",
        role="student"
    )

def require_admin(user: UserContext) -> UserContext:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return user
