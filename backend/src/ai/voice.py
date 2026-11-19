"""Voice: the young person speaks (speech to text), the AI answers aloud (text to speech).

Both go through Mistral's Voxtral models. The audio of the person is sent to Mistral and is not kept here.
"""

import base64
import hashlib
import tempfile
from pathlib import Path

from .config import AIConfigError, get_config
from .llm import LLMError, client

# Fixed phrases come back all the time: their audio is kept on disk instead of being paid for again
_CACHE_DIR = Path(tempfile.gettempdir()) / "pioche-tts-cache"


def transcribe(audio: bytes, filename: str = "answer.webm", language: str = "fr") -> str:
    """The words in an audio recording of the young person.

    `filename` tells the format (the browser's recorder produces .webm); the extension must match.
    """
    try:
        result = client().audio.transcriptions.complete(
            model=get_config().stt_model,
            file={"file_name": filename, "content": audio},
            language=language,
        )
    except Exception as exc:
        raise LLMError(f"Transcription failed: {exc}") from exc
    return str(result.text).strip()


def _cache_path(text: str, model: str, voice: str) -> Path:
    key = hashlib.sha256(f"{model}|{voice}|{text}".encode()).hexdigest()
    return _CACHE_DIR / f"{key}.mp3"


def speak(text: str) -> bytes:
    """The audio (mp3) of a text, read by the chosen voice."""
    config = get_config()
    if not config.tts_voice:
        raise AIConfigError("AI_TTS_VOICE is not set: choose a voice (see list_voices) and put it in the .env file.")

    cached = _cache_path(text, config.tts_model, config.tts_voice)
    if cached.exists():
        return cached.read_bytes()

    try:
        result = client().audio.speech.complete(
            input=text,
            model=config.tts_model,
            voice_id=config.tts_voice,
            response_format="mp3",
        )
    except Exception as exc:
        raise LLMError(f"Speech synthesis failed: {exc}") from exc

    audio = base64.b64decode(result.audio_data)
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(audio)
    return audio


def list_voices() -> list[str]:
    """The voices available on the account, as "id : name" lines, to choose AI_TTS_VOICE."""
    try:
        result = client().audio.voices.list()
    except Exception as exc:
        raise LLMError(f"Could not list the voices: {exc}") from exc
    items = getattr(result, "items", None) or getattr(result, "data", None) or []
    return [f"{getattr(v, 'slug', None) or getattr(v, 'id', '?')} : {getattr(v, 'name', '')}" for v in items]
