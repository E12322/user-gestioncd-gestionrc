"""Jeton de DEVELOPPEMENT pour tester l'agent sans lancer le user-service.

    python -m app.devtoken student            (ou teacher / admin)

Signe avec JWT_SECRET (HS256) : refuse en production. Les outils qui appellent le user-service
(profil, historique) ne marcheront que si ce service tourne ; la recherche dans le reglement marche sans lui.
"""
import sys
import time

import jwt

from app.config import get_settings

IDENTITIES = {
    "student": ("ETU-2026-0001", "Amel Etudiante"),
    "teacher": ("ENS-2026-0001", "Karim Enseignant"),
    "admin": ("ADM-2026-0001", "Sana Admin"),
}


def main() -> None:
    settings = get_settings()
    role = sys.argv[1] if len(sys.argv) > 1 else "student"
    if settings.environment == "production" or not settings.jwt_secret:
        sys.exit("Refuse : jeton de developpement impossible en production ou sans JWT_SECRET.")
    if role not in IDENTITIES:
        sys.exit(f"Role inconnu : {role} (student, teacher, admin)")
    sub, name = IDENTITIES[role]
    now = int(time.time())
    claims = {"sub": sub, "name": name, "role": role, "iss": settings.jwt_issuer,
              "aud": settings.jwt_audience, "iat": now, "exp": now + 2 * 3600}
    print(jwt.encode(claims, settings.jwt_secret, algorithm="HS256"))


if __name__ == "__main__":
    main()
