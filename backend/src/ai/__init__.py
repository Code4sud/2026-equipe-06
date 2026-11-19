"""The AI side of the game: conversation, analysis, summary, card draw and voice (Mistral API).

Plain functions with no dependency on Flask or on the database: the caller loads the context,
calls the function, then saves the result. See each module for what it does.

    from ai import conversation, analysis, summary, drawing, voice, rules
"""

from . import analysis, conversation, drawing, guards, rules, summary, voice
from .config import AIConfigError
from .data import get_card, load_cards, load_report, mirror_card
from .llm import LLMError
from .models import (
    Card,
    CollectionItem,
    Message,
    Report,
    SessionContext,
    TurnAnalysis,
    TurnReply,
    TurnSummary,
)

__all__ = [
    "AIConfigError",
    "Card",
    "CollectionItem",
    "LLMError",
    "Message",
    "Report",
    "SessionContext",
    "TurnAnalysis",
    "TurnReply",
    "TurnSummary",
    "analysis",
    "conversation",
    "drawing",
    "get_card",
    "guards",
    "load_cards",
    "load_report",
    "mirror_card",
    "rules",
    "summary",
    "voice",
]
