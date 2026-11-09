import io
import wave
from pathlib import Path

import pytest

from app.config import Settings
from app.tts import PiperTTS, TTSUnavailableError, get_tts

VOICE = Path(__file__).resolve().parent.parent / "voices" / "fr_FR-siwis-medium.onnx"


def test_voice_disabled_by_default():
    with pytest.raises(TTSUnavailableError):
        get_tts(Settings(jwt_secret="x" * 32))


def test_missing_voice_file_gives_clear_error():
    with pytest.raises(TTSUnavailableError, match="introuvable"):
        PiperTTS("voices/n-existe-pas.onnx")


@pytest.mark.skipif(not VOICE.exists(), reason="voix Piper non telechargee")
async def test_piper_really_synthesizes_french_speech():
    wav = await PiperTTS(str(VOICE)).synthesize("Bonjour, ceci est un test.")
    with wave.open(io.BytesIO(wav)) as r:
        assert r.getnchannels() == 1 and r.getframerate() >= 16000
        assert r.getnframes() / r.getframerate() > 1.0  # plus d'une seconde de parole


def test_demo_ui_served_in_dev_but_not_in_production(monkeypatch):
    from fastapi.testclient import TestClient

    from app import config, main

    assert TestClient(main.app).get("/ui").status_code == 200
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWKS_URL", "http://x.test/jwks")
    monkeypatch.setenv("JWT_SECRET", "")  # vide = non configure (sinon le .env local serait lu)
    config.get_settings.cache_clear()
    try:
        assert TestClient(main.create_app()).get("/ui").status_code == 404
    finally:
        config.get_settings.cache_clear()
