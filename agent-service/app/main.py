import base64
import logging
import secrets
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic_ai.exceptions import ModelRateLimitError, ModelUnavailableError, UnexpectedModelBehavior
from pydantic_ai.messages import BinaryContent, ModelMessage, ModelRequest, UserPromptPart

from app.agent import AgentDeps, build_agent
from app.auth import Principal, current_principal
from app.config import Settings, get_settings
from app.media import InvalidImageError, decode_image
from app.memory import ConversationStore, InMemoryStore, MongoStore
from app.pending import PendingStore, get_pending
from app.render import to_markdown, to_pdf
from app.schemas import Action, AgentRequest, AgentResponse, ConfirmResult
from app.tools.campus import CampusClient
from app.tools.users import ToolError, UserServiceClient
from app.tts import TTSUnavailableError, get_tts

log = logging.getLogger("agent")
_agent = None
_store: ConversationStore | None = None
_hits: dict[str, deque[float]] = defaultdict(deque)


def get_agent():
    global _agent  # noqa: PLW0603
    if _agent is None:
        _agent = build_agent(get_settings().agent_model)
    return _agent


def get_store() -> ConversationStore:
    global _store  # noqa: PLW0603
    if _store is None:
        uri = get_settings().mongo_uri
        _store = MongoStore(uri) if uri else InMemoryStore()
    return _store


def rate_limit(principal: Annotated[Principal, Depends(current_principal)],
               settings: Annotated[Settings, Depends(get_settings)]) -> Principal:
    """Fenetre glissante d'une minute PAR UTILISATEUR (chaque appel coute des jetons Claude). RAM : une instance."""
    now = time.time()
    window = _hits[principal.sub]
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= settings.rate_limit_per_minute:
        raise HTTPException(429, "Trop de requetes, reessayez dans une minute", headers={"Retry-After": "60"})
    window.append(now)
    return principal


def strip_media(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Les images ne sont pas gardees en memoire (poids, donnees personnelles) : remplacees par un marqueur."""
    out: list[ModelMessage] = []
    for m in messages:
        if isinstance(m, ModelRequest):
            parts = []
            for p in m.parts:
                if isinstance(p, UserPromptPart) and not isinstance(p.content, str):
                    p = replace(p, content=["[image jointe]" if isinstance(c, BinaryContent) else c for c in p.content])
                parts.append(p)
            m = replace(m, parts=parts)
        out.append(m)
    return out


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings()  # echoue des le demarrage si la configuration est invalide
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SmartCampus Agent Service", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,  # cookies de session du front (sc_access)
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "X-Auth-Mode"],
    )

    if settings.environment != "production":  # page de demonstration : jamais exposee en production

        @app.get("/ui", include_in_schema=False)
        async def demo_ui() -> FileResponse:
            return FileResponse(Path(__file__).resolve().parent.parent / "ui" / "index.html")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/agent/chat", response_model=AgentResponse)
    async def chat(
        body: AgentRequest,
        principal: Annotated[Principal, Depends(rate_limit)],
        settings: Annotated[Settings, Depends(get_settings)],
    ) -> AgentResponse:
        if len(body.message) > settings.max_message_chars:
            raise HTTPException(413, f"Message trop long ({settings.max_message_chars} caracteres maximum)")
        prompt: str | list = body.message
        if body.image_b64 and body.image_media_type:
            try:
                data, media_type = decode_image(body.image_b64, body.image_media_type)
            except InvalidImageError as exc:
                raise HTTPException(422, str(exc)) from None
            prompt = [body.message, BinaryContent(data=data, media_type=media_type)]
        tts = None
        if body.want_audio:  # echouer AVANT de payer un appel Claude
            try:
                tts = get_tts(settings)
            except TTSUnavailableError as exc:
                raise HTTPException(501, str(exc)) from None

        # L'id de conversation est limite a l'utilisateur du JWT : impossible de lire celle d'un autre.
        cid = body.conversation_id or secrets.token_urlsafe(12)
        store = get_store()
        history = await store.load(principal.sub, cid)
        users = UserServiceClient(settings.user_service_url, principal.token)
        campus = CampusClient(
            academic_url=settings.academic_service_url, resources_url=settings.resources_service_url,
            residences_url=settings.residences_service_url, library_url=settings.library_service_url,
            token=principal.token,
        )
        deps = AgentDeps(principal=principal, users=users, campus=campus)
        try:
            result = await get_agent().run(prompt, deps=deps, message_history=history)
        except ModelRateLimitError:  # quota du fournisseur (offre gratuite : ~15 requetes/minute/modele)
            raise HTTPException(
                429, "L'assistant est tres sollicite, reessayez dans une minute", headers={"Retry-After": "60"}
            ) from None
        except ModelUnavailableError:  # fournisseur surcharge (503)
            raise HTTPException(
                503, "L'assistant est surcharge, reessayez dans un instant", headers={"Retry-After": "30"}
            ) from None
        except UnexpectedModelBehavior:
            raise HTTPException(502, "L'assistant n'a pas pu produire une reponse valide") from None
        except Exception:
            log.exception("agent_error")  # detail dans les logs, jamais dans la reponse
            raise HTTPException(502, "L'assistant est momentanement indisponible") from None
        finally:
            await users.aclose()
            await campus.aclose()
        await store.append(principal.sub, cid, strip_media(result.new_messages()))
        log.info("agent_chat sub=%s role=%s tools=%s", principal.sub, principal.role, [a.tool for a in deps.actions])

        response = AgentResponse(
            **result.output.model_dump(), role=principal.role, conversation_id=cid,
            actions=deps.actions, sources=deps.sources,
        )
        if body.output_format == "markdown":
            response.markdown = to_markdown(response)
        elif body.output_format == "pdf":
            response.pdf_b64 = base64.b64encode(to_pdf(response)).decode()
        if tts is not None:
            try:
                response.audio_b64 = base64.b64encode(await tts.synthesize(response.answer)).decode()
            except Exception:
                log.exception("tts_error")  # la voix est un bonus : la reponse texte reste valide
        return response

    @app.post("/agent/actions/{action_id}/confirm", response_model=ConfirmResult)
    async def confirm(
        action_id: str,
        principal: Annotated[Principal, Depends(rate_limit)],
        settings: Annotated[Settings, Depends(get_settings)],
        pending: Annotated[PendingStore, Depends(get_pending)],
    ) -> ConfirmResult:
        """Execute une action proposee par l'agent, APRES clic de l'utilisateur. Usage unique."""
        action = pending.take(principal.sub, action_id)
        if action is None:  # inconnue, expiree, deja utilisee ou d'un autre : meme reponse
            raise HTTPException(404, "Action introuvable ou expiree")
        users = UserServiceClient(settings.user_service_url, principal.token)
        try:
            if action.tool == "update_my_phone":
                await users.update_phone(principal.sub, action.args["phone"])
            else:  # ne devrait pas arriver : on n'execute que ce qu'on connait
                raise HTTPException(400, "Action non supportee")
            status = "done"
        except ToolError as exc:
            status = "denied" if "refus" in str(exc).lower() else "error"
        finally:
            await users.aclose()
        log.info("agent_confirm sub=%s tool=%s status=%s", principal.sub, action.tool, status)
        done = Action(tool=action.tool, args=dict(action.args), status=status, summary=action.summary)
        return ConfirmResult(action=done)

    @app.post("/agent/actions/{action_id}/cancel", status_code=204)
    async def cancel(
        action_id: str,
        principal: Annotated[Principal, Depends(rate_limit)],
        pending: Annotated[PendingStore, Depends(get_pending)],
    ) -> None:
        pending.take(principal.sub, action_id)

    return app


app = create_app()
