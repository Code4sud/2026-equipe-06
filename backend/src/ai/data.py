"""The deck of cards (read from the database through use_card_source) and the
static data of backend/data/: the ROME skills and the mock reports.
"""

import json
import logging
import random
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable, cast

from .config import data_dir
from .models import Card, Level, Report

log = logging.getLogger(__name__)

_LEVELS: tuple[str, ...] = ("general", "specific", "personal")


def _read_json(name: str) -> dict[str, Any]:
    with open(data_dir() / name, encoding="utf-8") as f:
        return cast("dict[str, Any]", json.load(f))


def _to_card(raw: dict[str, Any]) -> Card:
    level = raw.get("level")
    return Card(
        id=raw["id"],
        family=raw["family"],
        format=raw["format"],
        title=raw["title"],
        level=cast(Level, level) if level in _LEVELS else None,
        intention=raw.get("intention", ""),
        opener=raw.get("opener", ""),
        talents=tuple(raw.get("talents", [])),
    )


# The cards live in the database (game/cards.py). This module stays free of
# any database: the server gives it a function that returns the cards, in the
# format of cards.json plus "talents" and "mirror" (True for the mirror card).
CardSource = Callable[[], list[dict[str, Any]]]

# A card changed in the database is seen after at most this long
_CARDS_CACHE_SECONDS = 60.0

_card_source: CardSource | None = None
_deck_cache: tuple[float, dict[str, Card], Card] | None = None


def use_card_source(source: CardSource) -> None:
    """Called once at startup (server/__main__.py, ai/dev_server.py)."""
    global _card_source, _deck_cache
    _card_source = source
    _deck_cache = None


def _deck() -> tuple[dict[str, Card], Card]:
    global _deck_cache
    now = time.monotonic()
    if (
        _deck_cache is not None
        and now - _deck_cache[0] < _CARDS_CACHE_SECONDS
    ):
        return _deck_cache[1], _deck_cache[2]
    if _card_source is None:
        raise RuntimeError(
            "No card source: call ai.data.use_card_source() at startup."
        )
    try:
        raws = _card_source()
    except Exception:
        # Database unreachable for a moment: keep playing with the last deck
        if _deck_cache is None:
            raise
        log.exception("Cards: reading the database failed, last deck kept")
        _deck_cache = (now, _deck_cache[1], _deck_cache[2])
        return _deck_cache[1], _deck_cache[2]

    cards: dict[str, Card] = {}
    mirror: Card | None = None
    for raw in raws:
        if raw.get("mirror"):
            mirror = _to_card(raw)
        else:
            cards[raw["id"]] = _to_card(raw)
    if not cards or mirror is None:
        raise RuntimeError("The card collection is empty or has no mirror card.")
    _deck_cache = (now, cards, mirror)
    return cards, mirror


def load_cards() -> dict[str, Card]:
    """The 50 cards of the deck, by id. The mirror card is not in it (see
    mirror_card).
    """
    return _deck()[0]


def mirror_card() -> Card:
    return _deck()[1]


def get_card(card_id: str) -> Card:
    if card_id == mirror_card().id:
        return mirror_card()
    try:
        return load_cards()[card_id]
    except KeyError:
        raise KeyError(f"Unknown card: {card_id}") from None


@dataclass(frozen=True)
class RomeSkill:
    code: str
    label: str
    category: str
    domain: str
    issue: str
    objective: str
    riasec_major: str | None
    riasec_minor: str | None


@lru_cache(maxsize=1)
def load_rome() -> dict[str, RomeSkill]:
    """The 506 ROME macro-skills, by code (e.g. "3E205")."""
    skills: dict[str, RomeSkill] = {}
    for domain in _read_json("rome.json")["domains"]:
        for issue in domain["issues"]:
            for objective in issue["objectives"]:
                for m in objective["macro_skills"]:
                    skills[m["code"]] = RomeSkill(
                        code=m["code"],
                        label=m["label"],
                        category=m["category"],
                        domain=domain["name"],
                        issue=issue["name"],
                        objective=objective["name"],
                        riasec_major=m.get("riasec_major"),
                        riasec_minor=m.get("riasec_minor"),
                    )
    return skills


@lru_cache(maxsize=1)
def rome_prompt_list() -> str:
    """The ROME skills for the analysis prompt, grouped under their domain,
    issue and objective.

    The headings give each label its context: without them the model mixes up
    close labels
    (e.g. "Développer un logiciel" for someone who reinstalls Windows, instead
    of "Paramétrer").
    """
    lines: list[str] = []
    for domain in _read_json("rome.json")["domains"]:
        lines.append(f"## {domain['name']}")
        for issue in domain["issues"]:
            for objective in issue["objectives"]:
                lines.append(f"### {issue['name']} › {objective['name']}")
                lines.extend(
                    f"{m['code']} {m['label']}"
                    for m in objective["macro_skills"]
                )
    return "\n".join(lines)


# Mock reports only: real reports may not be stored in the repository
_REPORTS_DIR = "reports"


def report_ids() -> list[str]:
    """Ids of the mock reports in backend/data/reports/ (file name without
    .json).
    """
    return sorted(p.stem for p in (data_dir() / _REPORTS_DIR).glob("*.json"))


def random_report_id() -> str:
    return random.choice(report_ids())


def load_report(report_id: str) -> Report:
    """Loads a mock report from backend/data/reports/."""
    return Report.from_dict(_read_json(f"{_REPORTS_DIR}/{report_id}.json"))
