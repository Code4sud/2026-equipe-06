"""Chooses the four cards of a draw (the front adds the joker as the fifth).

The deck is fixed; what changes is which cards are allowed (docs/RULES.md and
docs/TON.md):
- the first card is always light;
- medium (specific) cards only after a turn where the young person got involved
  (an open turn);
- after a neutral or closed turn, only light cards, to get back on solid
  ground;
- personal cards only come after an open turn, and never alone: always next to
  lighter ones;
- after an open turn, some cards "dig" the same subject, the others change the
  air.
"""

import random
import re
from dataclasses import dataclass, field

from .data import load_cards
from .models import Card, Engagement

DRAW_SIZE = 4

# A personal card is offered only after this many turns, and at most once per
# draw
_PERSONAL_AFTER_TURNS = 2
_MAX_PERSONAL = 1
# After an open turn, how many cards dig what just came up
_DIG_COUNT = 2

_WORD_RE = re.compile(r"\w{4,}", re.UNICODE)


@dataclass
class DrawState:
    """What the draw needs to know about the game so far."""

    played_ids: set[str] = field(default_factory=set)
    turns_played: int = 0
    last_engagement: Engagement | None = None
    last_family: str | None = None
    # Short subjects the last turn made come up, in the young person's words
    topics_to_explore: list[str] = field(default_factory=list)


def _words(text: str) -> set[str]:
    return {w.lower() for w in _WORD_RE.findall(text)}


def _relevance(card: Card, topic_words: set[str]) -> int:
    """How many topic words appear in the card: a rough way to find the cards
    that dig a subject.
    """
    return len(topic_words & _words(f"{card.title} {card.intention}"))


def _allowed(card: Card, state: DrawState) -> bool:
    if card.id in state.played_ids or card.level is None:
        return False
    if state.turns_played == 0 or state.last_engagement != "open":
        return card.level == "general"
    if card.level == "personal":
        return (
            state.last_engagement == "open"
            and state.turns_played >= _PERSONAL_AFTER_TURNS
        )
    return True


def draw_cards(
    state: DrawState,
    *,
    rng: random.Random | None = None,
    count: int = DRAW_SIZE,
) -> list[Card]:
    """Four cards to offer. Never the same card twice in a game, as long as the
    deck lasts.
    """
    rng = rng or random.Random()
    pool = [c for c in load_cards().values() if _allowed(c, state)]
    if len(pool) < count:
        # Deck running low: let the already played light cards come back rather
        # than showing fewer cards
        pool = [c for c in load_cards().values() if c.level == "general"]
    rng.shuffle(pool)

    chosen: list[Card] = []

    def take(card: Card) -> None:
        """Adds a card if there is room, it is not already there, and the
        personal limit holds.

        With at most one personal card among four, a personal card is never
        alone.
        """
        if card in chosen or len(chosen) >= count:
            return
        if (
            card.level == "personal"
            and sum(c.level == "personal" for c in chosen) >= _MAX_PERSONAL
        ):
            return
        chosen.append(card)

    # 1. Dig what just came up, only after an open turn
    if state.last_engagement == "open" and state.turns_played > 0:
        topic_words = _words(" ".join(state.topics_to_explore))
        ranked = sorted(
            pool,
            key=lambda c: (
                -_relevance(c, topic_words),
                c.family != state.last_family,
            ),
        )
        for card in ranked:
            if len(chosen) >= _DIG_COUNT:
                break
            if (
                _relevance(card, topic_words) > 0
                or card.family == state.last_family
            ):
                take(card)

    # 2. Change the air: one card per family not shown yet
    for card in pool:
        if not any(card.family == c.family for c in chosen):
            take(card)

    # 3. Fill the rest whatever the family
    for card in pool:
        take(card)

    rng.shuffle(chosen)
    return chosen
