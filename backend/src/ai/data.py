"""Loads the static data: the deck of cards and the ROME skills (both in backend/data/)."""

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, cast

from .config import data_dir
from .models import Card, Level, Report

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
        talents=tuple(_card_talents().get(raw["id"], [])),
    )


@lru_cache(maxsize=1)
def _card_talents() -> dict[str, list[str]]:
    """Card id -> talents it can bring out, generated from docs/COMPETENCES.md."""
    return dict(_read_json("card_talents.json")["talents"])


@lru_cache(maxsize=1)
def load_cards() -> dict[str, Card]:
    """The 50 cards of the deck, by id. The mirror card is not in it (see mirror_card)."""
    return {c["id"]: _to_card(c) for c in _read_json("cards.json")["cards"]}


@lru_cache(maxsize=1)
def mirror_card() -> Card:
    return _to_card(_read_json("cards.json")["mirror"])


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
                        riasec_major=m.get("riasec_major"),
                        riasec_minor=m.get("riasec_minor"),
                    )
    return skills


@lru_cache(maxsize=1)
def rome_prompt_list() -> str:
    """The ROME skills for the analysis prompt, grouped under their domain, issue and objective.

    The headings give each label its context: without them the model mixes up close labels
    (e.g. "Développer un logiciel" for someone who reinstalls Windows, instead of "Paramétrer").
    """
    lines: list[str] = []
    for domain in _read_json("rome.json")["domains"]:
        lines.append(f"## {domain['name']}")
        for issue in domain["issues"]:
            for objective in issue["objectives"]:
                lines.append(f"### {issue['name']} › {objective['name']}")
                lines.extend(f"{m['code']} {m['label']}" for m in objective["macro_skills"])
    return "\n".join(lines)


def load_report(name: str = "sample_report.json") -> Report:
    """Loads a report from backend/data/. Real reports will be ingested later."""
    return Report.from_dict(_read_json(name))
