"""End-of-turn analysis: a second, silent call that reads the whole turn and
extracts what to keep.

The talking AI never spots skills while talking: that would turn the
conversation into a form.
Everything the model returns goes through the safeguards of guards.py before
being kept.
"""

import logging
from typing import Any, cast

from . import guards, rules
from .config import get_config
from .context import format_items
from .data import load_rome, rome_prompt_list
from .llm import complete_json
from .models import (
    Card,
    Engagement,
    Message,
    NewEntry,
    SessionContext,
    TurnAnalysis,
)
from .prompts import render

log = logging.getLogger(__name__)

_ENGAGEMENTS = ("open", "neutral", "closed")


def _as_str_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(x).strip() for x in value if str(x).strip()][:limit]


def _transcript(card: Card, messages: list[Message]) -> str:
    lines = [f"Carte : {card.title}"]
    for m in messages:
        lines.append(("Jeune : " if m.role == "user" else "IA : ") + m.text)
    return "\n".join(lines)


def _one_per_skill(entries: list[NewEntry]) -> list[NewEntry]:
    """Within one turn, two entries with the same ROME skill are nearly always
    the same experience
    told in two answers (formatting a computer, then uninstalling software):
    keep the one with the
    most complete quote, in the original order."""
    best: dict[str, NewEntry] = {}
    for entry in entries:
        if entry.rome_code is None:
            continue
        current = best.get(entry.rome_code)
        if current is None or len(entry.quote) > len(current.quote):
            best[entry.rome_code] = entry
    return [
        e for e in entries if e.rome_code is None or best[e.rome_code] is e
    ]


def _keep_entries(
    raw: Any, ctx: SessionContext, said: list[str]
) -> list[NewEntry]:
    """Keeps only the entries that pass every safeguard, at most
    MAX_ENTRIES_PER_TURN.
    """
    if not isinstance(raw, list):
        return []
    rome = load_rome()
    already = {guards.normalize(item.quote) for item in ctx.collection}
    kept: list[NewEntry] = []

    for item in raw:
        if not isinstance(item, dict):
            continue
        quote = str(item.get("quote", "")).strip()
        fact = str(item.get("fact", "")).strip()

        if not guards.is_exact_quote(quote, said):
            log.info(
                "Entry dropped: the quote is not in what the young person "
                "said: %r",
                quote[:80],
            )
            continue
        if not fact or guards.is_sensitive(fact):
            log.info("Entry dropped: empty or sensitive fact: %r", fact)
            continue
        if guards.normalize(quote) in already:
            continue

        code = item.get("rome_code")
        skill = rome.get(str(code)) if code else None
        if code and skill is None:
            # An invented code: the entry is still worth keeping, but without a
            # ROME label
            log.info("Unknown ROME code %r, kept without it", code)
        kept.append(
            NewEntry(
                quote=quote,
                fact=fact,
                rome_code=skill.code if skill else None,
                rome_label=skill.label if skill else None,
            )
        )
        already.add(guards.normalize(quote))
    return _one_per_skill(kept)[: rules.MAX_ENTRIES_PER_TURN]


def analyze_turn(
    ctx: SessionContext, card: Card, history: list[Message]
) -> TurnAnalysis:
    """Reads a finished turn. `history` is the whole conversation of this card.

    Returns the entries to add to the collection (silently), the summary of the
    turn to remember,
    the engagement signal for the next draw, and what the young person declared
    he wants to avoid.
    """
    said = guards.user_texts(history)
    system = render(
        "analysis",
        card_title=card.title,
        collection=format_items(ctx.collection),
        max_entries=str(rules.MAX_ENTRIES_PER_TURN),
        rome_list=rome_prompt_list(),
    )
    data = complete_json(
        model=get_config().analysis_model,
        system=system,
        messages=[{"role": "user", "content": _transcript(card, history)}],
        temperature=0.2,
        max_tokens=1200,
        timeout_ms=60_000,
    )

    # The summary is the memory of later turns: sensitive information must not
    # stay in it
    summary = guards.strip_sensitive(str(data.get("summary", "")))

    engagement = str(data.get("engagement", "neutral"))
    if engagement not in _ENGAGEMENTS:
        engagement = "neutral"

    topics = [
        t
        for t in _as_str_list(data.get("topics_to_explore"), 3)
        if not guards.is_sensitive(t)
    ]
    # A constraint is kept only if the young person really said it, word for
    # word
    constraints = [
        c
        for c in _as_str_list(data.get("declared_constraints"), 3)
        if guards.is_exact_quote(c, said)
    ]

    return TurnAnalysis(
        entries=_keep_entries(data.get("entries"), ctx, said),
        summary=summary,
        engagement=cast(Engagement, engagement),
        topics_to_explore=topics,
        declared_constraints=constraints,
    )
