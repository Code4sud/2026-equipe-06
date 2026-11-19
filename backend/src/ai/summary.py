"""The final summary, written by the AI after the mirror.

Nothing is kept without proof: a personality card needs a sentence the young person really said.
"""

import logging
from typing import Any, Literal, cast

from . import guards
from .config import get_config
from .context import context_blocks, format_items
from .llm import complete_json
from .models import (
    CollectionItem,
    Crossing,
    Message,
    PersonalityCard,
    SessionContext,
    Summary,
)
from .prompts import render

log = logging.getLogger(__name__)

# Fewer than this many cards would look empty, more than this would be flattery
_MAX_CARDS = 4
_MAX_CROSSINGS = 4
_MAX_SUGGESTIONS = 5


def _clean_text(value: Any) -> str:
    """Text about the young person, without the sentences that carry sensitive information."""
    return guards.strip_sensitive(str(value or ""))


def _keep_cards(raw: Any, evidence_pool: list[str]) -> list[PersonalityCard]:
    if not isinstance(raw, list):
        return []
    cards: list[PersonalityCard] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title"))
        description = _clean_text(item.get("description"))
        evidence = str(item.get("evidence", "")).strip()
        if not title or not description:
            continue
        if not guards.is_exact_quote(evidence, evidence_pool):
            log.info("Personality card dropped: no real proof for %r", title)
            continue
        cards.append(PersonalityCard(title=title, description=description, evidence=evidence))
        if len(cards) >= _MAX_CARDS:
            break
    return cards


def _keep_crossings(raw: Any) -> list[Crossing]:
    if not isinstance(raw, list):
        return []
    crossings: list[Crossing] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind", ""))
        text = _clean_text(item.get("text"))
        if kind in ("match", "gap") and text:
            crossings.append(Crossing(kind=cast(Literal["match", "gap"], kind), text=text))
        if len(crossings) >= _MAX_CROSSINGS:
            break
    return crossings


def summarize(
    ctx: SessionContext,
    kept: list[CollectionItem],
    selected: list[CollectionItem],
    mirror_messages: list[Message],
) -> Summary:
    """The final summary.

    - `kept`: the entries the young person kept (he validates them at the summary, so only those count);
    - `selected`: the cards he picked at the start of the mirror;
    - `mirror_messages`: the whole mirror conversation.
    """
    blocks = context_blocks(ctx)
    # What the young person said himself: the only place proofs can come from
    mirror_said = guards.user_texts(mirror_messages)
    evidence_pool = [item.quote for item in kept] + mirror_said

    system = render(
        "summary",
        kept_items=format_items(kept),
        mirror_selection=format_items(selected),
        mirror_answers="\n".join(f"- {t}" for t in mirror_said) or "Rien.",
        turn_summaries=blocks["turn_summaries"],
        constraints=blocks["constraints"],
        report=blocks["report"],
    )
    data = complete_json(
        model=get_config().summary_model,
        system=system,
        messages=[{"role": "user", "content": "Écris le bilan."}],
        temperature=0.5,
        max_tokens=1500,
        timeout_ms=60_000,
    )

    suggestions = data.get("suggestions")
    return Summary(
        overview=_clean_text(data.get("overview")),
        crossings=_keep_crossings(data.get("crossings")),
        personality_cards=_keep_cards(data.get("personality_cards"), evidence_pool),
        # A job title says nothing about the young person: no sensitive-word filter here
        suggestions=[
            s for s in (str(x).strip() for x in (suggestions if isinstance(suggestions, list) else [])) if s
        ][:_MAX_SUGGESTIONS],
    )
