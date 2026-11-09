"""Synthese vocale GRATUITE. Fournisseur choisi par TTS_PROVIDER :
- `none` (defaut) ; le navigateur peut alors lire la reponse lui-meme (speechSynthesis), sans serveur ;
- `piper` : voix neuronale locale (licence MIT), CPU seulement, ~2 s pour 5 s de parole : pip install piper-tts ;
- `coqui` : plus lourd (torch), paquet optionnel `coqui-tts`.

Licences : verifier celle du MODELE choisi (XTTS-v2 = non commercial). Le modele se regle par TTS_MODEL.
"""
import asyncio
import io
import wave
from pathlib import Path
from typing import Protocol

from app.config import Settings

MAX_TTS_CHARS = 1000


class TextToSpeech(Protocol):
    async def synthesize(self, text: str) -> bytes: ...  # WAV


class TTSUnavailableError(RuntimeError):
    pass


class PiperTTS:
    def __init__(self, voice_path: str) -> None:
        try:
            from piper import PiperVoice
        except ImportError:
            raise TTSUnavailableError("Installer la voix : pip install piper-tts") from None
        if not Path(voice_path).exists():
            raise TTSUnavailableError(f"Voix introuvable : {voice_path} (voir README : telecharger la voix Piper)")
        self._voice = PiperVoice.load(voice_path)

    def _run(self, text: str) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            self._voice.synthesize_wav(text, w)
        return buf.getvalue()

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(self._run, text[:MAX_TTS_CHARS])


class CoquiTTS:
    def __init__(self, model_name: str) -> None:
        try:
            from TTS.api import TTS  # type: ignore[import-not-found]
        except ImportError:
            raise TTSUnavailableError("Installer la voix : pip install coqui-tts") from None
        self._tts = TTS(model_name)

    def _run(self, text: str) -> bytes:
        import numpy as np

        samples = np.asarray(self._tts.tts(text=text), dtype="float32")
        pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(int(getattr(self._tts.synthesizer, "output_sample_rate", 22050)))
            w.writeframes(pcm)
        return buf.getvalue()

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(self._run, text[:MAX_TTS_CHARS])  # le calcul ne bloque pas le serveur


_instance: TextToSpeech | None = None


def get_tts(settings: Settings) -> TextToSpeech:
    global _instance  # noqa: PLW0603
    if settings.tts_provider == "none":
        raise TTSUnavailableError("La voix n'est pas activee (TTS_PROVIDER)")
    if _instance is None:
        _instance = PiperTTS(settings.piper_voice) if settings.tts_provider == "piper" else CoquiTTS(settings.tts_model)
    return _instance
