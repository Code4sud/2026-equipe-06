"""Configuration of the AI side, read from environment variables.

Settings come from the environment. The server loads `.env` (see
server/__main__.py); this module also
loads `backend/.env.local` (where the API key goes), without overriding what is
already set.
Nothing is checked at import time, so the module can be imported (and tested)
without an API key.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# mypy does not find the types of this package (same as in server/__main__.py)
from dotenv import load_dotenv  # type: ignore[import-not-found]


class AIConfigError(Exception):
    pass


_ENV_LOCAL = Path(__file__).resolve().parents[2] / ".env.local"


def _load_env_local() -> None:
    """Loads backend/.env.local if it exists. Variables already set in the
    environment win.
    """
    load_dotenv(_ENV_LOCAL, override=False)


@dataclass(frozen=True)
class AIConfig:
    api_key: str
    # Talking to the young person, on every message. Medium rather than small:
    # small asked too many
    # closed questions and did not see where to dig (19/11 tests).
    # AI_CHAT_MODEL to change it
    chat_model: str
    # End-of-turn analysis and final summary: called rarely, quality matters
    # more.
    # Not mistral-large-latest: it is now a reasoning model that spends its
    # tokens thinking
    # (empty answer after 23 s in the first test). Medium answers in about 3 s
    # with good JSON.
    analysis_model: str
    summary_model: str
    # Voice. Names differ between Mistral's docs and examples: check them
    # against the current docs
    stt_model: str
    tts_model: str
    tts_voice: str | None
    # How expressive the voice is, per tone (TTS v3 only; at least 1.0). Chosen
    # by ear on 19/11. Enthusiastic lowered from 3.5 on 20/11: too many
    # hesitations and drawn-out vowels
    tts_expressiveness_neutral: float
    tts_expressiveness_enthusiastic: float
    # Where cards.json (copied into the database at startup), rome.json and the
    # mock reports live
    data_dir: Path


@lru_cache(maxsize=1)
def get_config() -> AIConfig:
    _load_env_local()
    api_key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not api_key:
        raise AIConfigError(
            "MISTRAL_API_KEY is empty: paste your key in backend/.env.local."
        )

    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    return AIConfig(
        api_key=api_key,
        chat_model=os.environ.get("AI_CHAT_MODEL", "mistral-medium-latest"),
        analysis_model=os.environ.get(
            "AI_ANALYSIS_MODEL", "mistral-medium-latest"
        ),
        summary_model=os.environ.get(
            "AI_SUMMARY_MODEL", "mistral-medium-latest"
        ),
        stt_model=os.environ.get("AI_STT_MODEL", "voxtral-mini-latest"),
        tts_model=os.environ.get("AI_TTS_MODEL", "voxtral-mini-tts-3-0"),
        tts_voice=os.environ.get("AI_TTS_VOICE") or None,
        tts_expressiveness_neutral=float(
            os.environ.get("AI_TTS_EXPRESSIVENESS_NEUTRAL", "1.0")
        ),
        tts_expressiveness_enthusiastic=float(
            os.environ.get("AI_TTS_EXPRESSIVENESS_ENTHUSIASTIC", "2.0")
        ),
        data_dir=Path(os.environ.get("AI_DATA_DIR", str(default_data_dir))),
    )


def data_dir() -> Path:
    """Data folder, available even without an API key (used to load cards and
    ROME).
    """
    _load_env_local()
    override = os.environ.get("AI_DATA_DIR")
    return (
        Path(override)
        if override
        else Path(__file__).resolve().parents[2] / "data"
    )
