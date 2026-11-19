"""Loads the Markdown prompts of the prompts/ folder and fills in their <<placeholders>>.

The prompts are plain French text, so anyone on the team can edit them without touching the code.
"""

import re
from functools import lru_cache
from pathlib import Path

from .models import Level

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

# The three shared blocks that start every conversation prompt
_SHARED = ("persona", "rules", "limits")

# How to speak on a card, according to its level (docs/TON.md)
LEVEL_NOTES: dict[str, str] = {
    "general": "Léger, rapide, un peu d'humour. On fait connaissance.",
    "specific": "Curieux, plus attentif aux détails. Tu reprends ses mots.",
    "personal": "Plus lent, plus doux, plus de silences. Tu le laisses venir, tu ne pousses jamais.",
}
MIRROR_LEVEL_NOTE = "Posé et doux. C'est lui qui parle de lui."

_PLACEHOLDER_RE = re.compile(r"<<(\w+)>>")


@lru_cache(maxsize=None)
def _read(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


def level_note(level: Level | None) -> str:
    return LEVEL_NOTES.get(level or "", MIRROR_LEVEL_NOTE)


def render(name: str, **values: str) -> str:
    """The text of prompts/<name>.md with each <<key>> replaced. Fails if one is left unfilled."""
    text = _read(name)
    for key, value in values.items():
        text = text.replace(f"<<{key}>>", value)
    missing = sorted(set(_PLACEHOLDER_RE.findall(text)))
    if missing:
        raise KeyError(f"Prompt '{name}' has unfilled placeholders: {missing}")
    return text


def system_prompt(task: str, **values: str) -> str:
    """Conversation prompt: persona, rules and limits, then the task of the call."""
    return "\n\n".join([*(_read(name) for name in _SHARED), render(task, **values)])
