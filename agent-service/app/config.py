from functools import lru_cache
from typing import Literal

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    agent_model: str = "anthropic:claude-sonnet-5-5"
    user_service_url: str = "http://localhost:4001"
    academic_service_url: str = "http://localhost:8081"
    resources_service_url: str = "http://localhost:8080"
    residences_service_url: str = "http://localhost:3001"
    library_service_url: str = "http://localhost:8082"
    jwt_issuer: str = "smartcampus-user-service"
    jwt_audience: str = "smartcampus"
    jwks_url: str | None = None
    jwt_secret: str | None = None  # HS256 : developpement seulement
    max_message_chars: int = 4000
    rate_limit_per_minute: int = 20  # par utilisateur : chaque appel coute des jetons Claude
    mongo_uri: str | None = None  # absent = memoire en RAM (dev) ; present = MongoDB
    tts_provider: Literal["none", "piper", "coqui"] = "none"
    piper_voice: str = "voices/fr_FR-siwis-medium.onnx"  # voix francaise gratuite (telechargee a part)
    tts_model: str = "tts_models/fr/css10/vits"  # verifier la licence du modele choisi
    cors_origins: str = "http://localhost:5173"

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret:
                raise ValueError("JWT_SECRET (HS256) est interdit en production : utiliser JWKS_URL (RS256)")
            if not self.jwks_url:
                raise ValueError("JWKS_URL est obligatoire en production")
        elif not self.jwks_url and not self.jwt_secret:
            raise ValueError("Definir JWKS_URL (RS256) ou, en developpement, JWT_SECRET (HS256)")
        return self


@lru_cache
def get_settings() -> Settings:
    # Les cles des fournisseurs (GOOGLE_API_KEY, ANTHROPIC_API_KEY...) sont lues par leurs SDK dans os.environ :
    # on y charge le .env sans ecraser les variables deja definies (override=False).
    load_dotenv(override=False)
    return Settings()
