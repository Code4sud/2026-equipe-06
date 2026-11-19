"""Voice: the young person speaks (speech to text), the AI answers aloud (text to speech).

Both go through Mistral's Voxtral models. The audio of the person is sent to Mistral and is not kept here.
"""

import base64
import hashlib
import re
import tempfile
from pathlib import Path

from .config import AIConfigError, get_config
from .llm import LLMError, client
from .models import Tone

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


def _cache_path(text: str, model: str, voice: str, expressiveness: float) -> Path:
    key = hashlib.sha256(f"{model}|{voice}|{expressiveness}|{text}".encode()).hexdigest()
    return _CACHE_DIR / f"{key}.mp3"


# Interjections at the start of a sentence ("Ah, un PC…") come out as a long drawn "aaah", heard as "euuuh"
_INTERJECTION_RE = re.compile(r"(^|(?<=[.!?…]\s))(?:ah|oh|euh|hum|hmm|bon|ben|bah)\s*[,.!…]+\s*", re.IGNORECASE)


# Written laughs would be acted out by the voice
_LAUGH_RE = re.compile(r"\b(?:ha(?:ha)+|hi(?:hi)+|he(?:he)+|mdr|ptdr|lol)\b[\s,.!…]*", re.IGNORECASE)


def for_voice(text: str) -> str:
    """The text as it is read aloud: without the interjections that the voice drags out, nor written laughs."""
    spoken = _LAUGH_RE.sub("", text)
    spoken = _INTERJECTION_RE.sub(r"\1", spoken).strip()
    # A sentence that now starts in lowercase gets its capital back
    spoken = re.sub(r"(^|[.!?…]\s+)([a-zà-ÿ])", lambda m: m.group(1) + m.group(2).upper(), spoken)
    return spoken or text


def speak(text: str, tone: Tone = "neutral") -> bytes:
    """The audio (mp3) of a text, read by the chosen voice, more lively when the tone is enthusiastic."""
    config = get_config()
    if not config.tts_voice:
        raise AIConfigError("AI_TTS_VOICE is not set: choose a voice (see list_voices) and put it in the .env file.")

    text = for_voice(text)
    expressiveness = (
        config.tts_expressiveness_enthusiastic if tone == "enthusiastic" else config.tts_expressiveness_neutral
    )
    cached = _cache_path(text, config.tts_model, config.tts_voice, expressiveness)
    if cached.exists():
        return cached.read_bytes()

    try:
        result = client().audio.speech.complete(
            input=text,
            model=config.tts_model,
            voice_id=config.tts_voice,
            # Only the v3 models take it (voxtral-mini-tts-3-0); "latest" still points to the older one
            expressiveness=expressiveness,
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
        # The API pages the list: 100 is its maximum
        result = client().audio.voices.list(limit=100)
    except Exception as exc:
        raise LLMError(f"Could not list the voices: {exc}") from exc
    items = getattr(result, "items", None) or getattr(result, "data", None) or []
    return [f"{getattr(v, 'slug', None) or getattr(v, 'id', '?')} : {getattr(v, 'name', '')}" for v in items]
