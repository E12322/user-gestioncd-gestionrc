"""Client du user-service. Chaque appel porte le JWT DE L'UTILISATEUR : l'agent n'a jamais de droits propres,
le user-service applique donc ses propres regles (selfOrAdmin, requireAdmin) meme si l'agent se trompait."""
from typing import Any

import httpx


class ToolError(Exception):
    """Erreur lisible par le modele (jamais de trace technique ni de secret)."""


class UserServiceClient:
    def __init__(self, base_url: str, token: str, transport: httpx.AsyncBaseTransport | None = None):
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {token}"},
            timeout=httpx.Timeout(8.0),
            transport=transport,
        )

    async def _request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json: Any = None) -> Any:
        try:
            r = await self._http.request(
                method, path, json=json, params={k: v for k, v in (params or {}).items() if v is not None}
            )
        except httpx.HTTPError as exc:
            raise ToolError("Le service utilisateurs est injoignable.") from exc
        if r.status_code in (401, 403):
            raise ToolError("Acces refuse par le service utilisateurs.")
        if r.status_code == 404:
            raise ToolError("Ressource introuvable.")
        if r.status_code in (400, 422):
            raise ToolError("Donnees refusees par le service utilisateurs.")
        if r.status_code >= 400:
            raise ToolError(f"Le service utilisateurs a repondu {r.status_code}.")
        return r.json()

    async def get_profile(self, user_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/users/{user_id}")

    async def get_login_history(self, user_id: str, limit: int = 10) -> Any:
        return await self._request("GET", f"/users/{user_id}/login-history", params={"limit": limit})

    async def update_phone(self, user_id: str, phone: str) -> dict[str, Any]:
        """ECRITURE, appelee uniquement apres confirmation humaine. Nom et prenom sont repris tels quels."""
        current = await self.get_profile(user_id)
        body = {"firstName": current["firstName"], "lastName": current["lastName"], "phone": phone}
        return await self._request("PUT", f"/users/{user_id}", json=body)

    async def aclose(self) -> None:
        await self._http.aclose()
