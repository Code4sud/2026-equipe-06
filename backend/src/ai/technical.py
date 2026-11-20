"""The technical sheet of the summary, for an adviser or a psychologist.
Computed without the AI.

Everything comes from what is stored: the entries the young person kept
(his exact sentences and the ROME skill chosen by the end-of-turn
analysis) and one line per card played. No score: only counts of facts,
which say how often something was told, never how good the person is.
"""

from dataclasses import dataclass
from typing import Literal

from . import guards
from .data import load_rome
from .models import Engagement, Message

# single: told once; repeated: in several stories of the same theme;
# transversal: across themes
Strength = Literal["single", "repeated", "transversal"]
# How the card ended: the conversation went to its end, the young person
# passed the card, he went to the summary from it, or it stopped on a
# distress message
EndedBy = Literal["completed", "skipped", "to_summary", "stopped"]

_STRENGTH_ORDER: dict[Strength, int] = {
    "transversal": 0,
    "repeated": 1,
    "single": 2,
}
_MAX_TOPICS = 8


@dataclass(frozen=True)
class Evidence:
    """One kept entry: his sentence, the fact drawn from it and where it
    was told.
    """

    quote: str
    fact: str
    card_id: str
    card_title: str
    family: str
    rome_code: str | None


@dataclass(frozen=True)
class SkillLine:
    code: str
    label: str
    # "Savoir-faire" or "Savoir-être", as in the ROME
    category: str
    domain: str
    issue: str
    objective: str
    evidence: list[Evidence]
    strength: Strength
    cards: int
    families: int


@dataclass(frozen=True)
class DomainLine:
    """How many skills and stories fall in one ROME domain: the shape of
    the skills told.
    """

    domain: str
    skills: int
    stories: int


@dataclass(frozen=True)
class TurnLine:
    card_title: str
    family: str
    answers: int
    words: int
    # None when the card was not analyzed (no answer, distress, analysis
    # failed)
    engagement: Engagement | None
    ended_by: EndedBy
    # Entries kept by the young person from this card
    kept: int


@dataclass(frozen=True)
class TechnicalSheet:
    skills: list[SkillLine]
    # Kept entries with no ROME skill that fits (the analysis prefers none
    # to a wrong one)
    unmapped: list[Evidence]
    domains: list[DomainLine]
    turns: list[TurnLine]
    topics: list[str]


def count_answers(history: list[Message]) -> tuple[int, int]:
    """Number of answers of the young person on a card, and their total
    number of words.
    """
    answers = [m.text for m in history if m.role == "user" and m.text.strip()]
    return len(answers), sum(len(text.split()) for text in answers)


def _strength(evidence: list[Evidence]) -> Strength:
    if len({e.family for e in evidence}) >= 2:
        return "transversal"
    if len(evidence) >= 2:
        return "repeated"
    return "single"


def _skill_lines(
    evidence: list[Evidence],
) -> tuple[list[SkillLine], list[Evidence]]:
    rome = load_rome()
    by_code: dict[str, list[Evidence]] = {}
    unmapped: list[Evidence] = []
    for item in evidence:
        if item.rome_code and item.rome_code in rome:
            by_code.setdefault(item.rome_code, []).append(item)
        else:
            unmapped.append(item)

    lines: list[SkillLine] = []
    for code, items in by_code.items():
        skill = rome[code]
        lines.append(
            SkillLine(
                code=code,
                label=skill.label,
                category=skill.category,
                domain=skill.domain,
                issue=skill.issue,
                objective=skill.objective,
                evidence=items,
                strength=_strength(items),
                cards=len({e.card_id for e in items}),
                families=len({e.family for e in items}),
            )
        )
    lines.sort(
        key=lambda s: (
            _STRENGTH_ORDER[s.strength], -len(s.evidence), s.code
        )
    )
    return lines, unmapped


def _domain_lines(skills: list[SkillLine]) -> list[DomainLine]:
    """The ROME domains with at least one skill, in the order of the ROME."""
    order = list(dict.fromkeys(s.domain for s in load_rome().values()))
    lines = []
    for domain in order:
        in_domain = [s for s in skills if s.domain == domain]
        if in_domain:
            lines.append(
                DomainLine(
                    domain,
                    len(in_domain),
                    sum(len(s.evidence) for s in in_domain),
                )
            )
    return lines


def _topics(raw: list[str]) -> list[str]:
    """Subjects that caught his interest, once each, without anything
    sensitive.
    """
    seen: set[str] = set()
    topics: list[str] = []
    for topic in raw:
        text = topic.strip()
        if text and text.lower() not in seen and not guards.is_sensitive(text):
            seen.add(text.lower())
            topics.append(text)
    return topics[:_MAX_TOPICS]


def build_sheet(
    evidence: list[Evidence], turns: list[TurnLine], topics: list[str]
) -> TechnicalSheet:
    skills, unmapped = _skill_lines(evidence)
    return TechnicalSheet(
        skills=skills,
        unmapped=unmapped,
        domains=_domain_lines(skills),
        turns=turns,
        topics=_topics(topics),
    )
