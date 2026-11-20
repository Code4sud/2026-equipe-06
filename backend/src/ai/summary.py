"""The final summary, written by the AI after the mirror.

Nothing is kept without proof: a personality card needs a sentence the young
person really said.
"""

import logging
import re
from typing import Any, Literal, cast

from . import guards
from .config import get_config
from .context import context_blocks, format_items
from .llm import complete_json
from .models import (
    CollectionItem,
    Crossing,
    Lead,
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
_MAX_MENTIONS = 3
_MAX_MIRROR_WORDS = 2
_MAX_ADVISOR_QUESTIONS = 3
# The first "message" of the mirror is the pick of cards, written by the code:
# not his words
_PICK_PREFIXES = (
    "J'ai choisi ces cartes de ma collection",
    "Je n'ai pas choisi de carte",
)


def _clean_text(value: Any) -> str:
    """Text about the young person, without the sentences that carry sensitive
    information.
    """
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
        cards.append(
            PersonalityCard(
                title=title, description=description, evidence=evidence
            )
        )
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
            crossings.append(
                Crossing(kind=cast(Literal["match", "gap"], kind), text=text)
            )
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

    - `kept`: the entries the young person kept (he validates them at the
      summary, so only those count);
    - `selected`: the cards he picked at the start of the mirror;
    - `mirror_messages`: the whole mirror conversation.
    """
    blocks = context_blocks(ctx)
    # What the young person said himself: the only place proofs can come from
    mirror_said = [
        t
        for t in guards.user_texts(mirror_messages)
        if not t.startswith(_PICK_PREFIXES)
    ]
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
        max_tokens=2500,
        timeout_ms=60_000,
    )

    return Summary(
        overview=_clean_text(data.get("overview")),
        crossings=_keep_crossings(data.get("crossings")),
        personality_cards=_keep_cards(
            data.get("personality_cards"), evidence_pool
        ),
        suggestions=_keep_suggestions(data.get("suggestions")),
        mirror_words=_keep_mirror_words(data.get("mirror_words"), mirror_said),
        advisor_questions=[
            q
            for q in (
                _clean_text(x) for x in _as_list(data.get("advisor_questions"))
            )
            if q
        ][:_MAX_ADVISOR_QUESTIONS],
    )


def _as_list(raw: Any) -> list[Any]:
    return raw if isinstance(raw, list) else []


def _keep_suggestions(raw: Any) -> list[Lead]:
    leads: list[Lead] = []
    for item in _as_list(raw):
        if isinstance(item, str):
            # A bare title (older answer shape): still a path, without the why
            item = {"title": item}
        if not isinstance(item, dict):
            continue
        # A job title says nothing about the young person: no sensitive-word
        # filter on it
        title = str(item.get("title", "")).strip()
        if title:
            leads.append(
                Lead(
                    title=title,
                    why=_clean_text(item.get("why")),
                    first_step=_clean_text(item.get("first_step")),
                )
            )
    return leads[:_MAX_SUGGESTIONS]


def _keep_mirror_words(raw: Any, mirror_said: list[str]) -> list[str]:
    """His own sentences from the mirror, only if he really said them word for
    word.
    """
    words: list[str] = []
    for item in _as_list(raw):
        quote = str(item).strip().strip("«»\"' ")
        if (
            quote
            and guards.is_exact_quote(quote, mirror_said)
            and not guards.is_sensitive(quote)
            and quote not in words
        ):
            words.append(quote)
    return words[:_MAX_MIRROR_WORDS]


# ---- Sensitive things the young person said himself (docs/RULES_V2.md) ------


def find_sensitive_mentions(said: list[str]) -> list[str]:
    """What he said himself about his health, religion or origin that could
    matter for a job.

    Nothing of it is kept during the game. At the summary, he is asked whether
    he wants it taken
    into account for the suggestions. Each mention is an exact piece of what he
    said: his words.
    No model call when nothing he said touches these subjects (most games).
    """
    sentences = [
        s
        for text in said
        for s in re.split(r"(?<=[.!?…])\s+", text.strip())
        if s and guards.might_be_sensitive(s)
    ]
    if not sentences:
        return []
    data = complete_json(
        model=get_config().analysis_model,
        system=render(
            "sensitive", sentences="\n".join(f"- « {s} »" for s in sentences)
        ),
        messages=[{"role": "user", "content": "Qu'est-ce qui compte ?"}],
        temperature=0.0,
        max_tokens=300,
    )
    raw = data.get("mentions")
    mentions: list[str] = []
    for item in raw if isinstance(raw, list) else []:
        text = str(item).strip()
        # His words or nothing: a mention that is not in what he said is
        # dropped
        if guards.is_exact_quote(text, said) and text not in mentions:
            mentions.append(text)
    return mentions[:_MAX_MENTIONS]


def suggest_with_mentions(
    ctx: SessionContext,
    kept: list[CollectionItem],
    mirror_messages: list[Message],
    mentions: list[str],
) -> list[Lead]:
    """The suggestions again, taking into account what he agreed to share
    (explicit consent).
    """
    blocks = context_blocks(ctx)
    mirror_said = guards.user_texts(mirror_messages)
    data = complete_json(
        model=get_config().summary_model,
        system=render(
            "suggestions",
            mentions="\n".join(f"- « {m} »" for m in mentions),
            kept_items=format_items(kept),
            mirror_answers="\n".join(f"- {t}" for t in mirror_said) or "Rien.",
            turn_summaries=blocks["turn_summaries"],
            constraints=blocks["constraints"],
            report=blocks["report"],
        ),
        messages=[{"role": "user", "content": "Écris les pistes."}],
        temperature=0.5,
        max_tokens=1200,
    )
    return _keep_suggestions(data.get("suggestions"))
