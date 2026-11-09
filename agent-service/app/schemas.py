"""Contrat d'entree/sortie de l'agent : tout est type, rien n'est du texte libre a parser."""
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Role = Literal["student", "teacher", "admin"]
ConversationId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{8,64}$")]
ImageType = Literal["image/jpeg", "image/png", "image/webp"]


class AgentRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: ConversationId | None = None  # absent = nouvelle conversation
    image_b64: str | None = None  # vision : image encodee en base64 (5 Mo max, verifiee cote serveur)
    image_media_type: ImageType | None = None
    want_audio: bool = False  # voix : reponse lue (WAV en base64)
    output_format: Literal["json", "markdown", "pdf"] = "json"

    @model_validator(mode="after")
    def _image_needs_type(self) -> "AgentRequest":
        if (self.image_b64 is None) != (self.image_media_type is None):
            raise ValueError("image_b64 et image_media_type vont ensemble")
        return self


class Action(BaseModel):
    """Trace d'un outil appele par l'agent (auditable)."""

    tool: str
    args: dict[str, str | int | bool | None] = {}
    status: Literal["done", "denied", "error", "needs_confirmation"]
    confirmation_id: str | None = None  # present si status == needs_confirmation
    summary: str | None = None  # phrase lisible a afficher dans la fenetre de confirmation


class AgentAnswer(BaseModel):
    """Ce que le MODELE doit produire (valide par Pydantic AI, avec nouvel essai automatique si invalide)."""

    answer: str = Field(description="Reponse claire pour l'utilisateur, en francais.")
    confidence: Literal["low", "medium", "high"] = Field(
        description="high seulement si la reponse repose sur des donnees renvoyees par un outil."
    )


class AgentResponse(AgentAnswer):
    """Ce que l'API renvoie : la reponse du modele + ce que le SERVEUR a reellement fait."""

    role: Role
    conversation_id: str
    actions: list[Action] = []
    sources: list[str] = []
    markdown: str | None = None  # si output_format == markdown
    pdf_b64: str | None = None  # si output_format == pdf
    audio_b64: str | None = None  # si want_audio (WAV)


class ConfirmResult(BaseModel):
    action: Action
