"""Data shapes exchanged between the AI module and the rest of the backend.

They carry no e-mail, name or any identifier of the person: only what is said in the game.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

Level = Literal["general", "specific", "personal"]
Role = Literal["assistant", "user"]
Safety = Literal["none", "heavy", "distress"]
Engagement = Literal["open", "neutral", "closed"]


@dataclass(frozen=True)
class Card:
    id: str
    family: str
    format: str
    title: str
    # level is None for the mirror card
    level: Level | None
    # Where the talents of this card hide. Stays on the server, for the AI only
    intention: str
    # Reference first sentence, which the AI adapts. Stays on the server too
    opener: str
    # Talents this card can bring out (docs/COMPETENCES.md): where to dig, never said to the young person
    talents: tuple[str, ...] = ()


@dataclass(frozen=True)
class Message:
    role: Role
    text: str


@dataclass(frozen=True)
class CollectionItem:
    """An entry the young person kept in his collection."""

    id: str
    card_title: str
    # Exact sentence of the young person
    quote: str
    # What he did, as a short action phrase ("Trouve d'où vient une panne")
    fact: str
    # Official ROME macro-skill matching the quote, when one fits
    rome_code: str | None = None
    rome_label: str | None = None


@dataclass(frozen=True)
class TurnSummary:
    """What a past turn was about: the memory that lets the AI link turns and resume a session."""

    card_id: str
    card_title: str
    summary: str
    engagement: Engagement


@dataclass(frozen=True)
class Report:
    """The "rapport des possibles" of the Centre des possibles, reduced to what the AI needs."""

    # RIASEC dimensions in French, from the most to the least marked
    interests: list[str]
    # Cognitive aptitudes, score from 0 to 8
    aptitudes: dict[str, int]
    # HEXACO dimensions in French, from the most to the least marked
    personality: list[str]
    # Suggested jobs, by zone (1 = quick to reach, 5 = longest studies)
    jobs_by_zone: dict[int, list[str]]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Report":
        return cls(
            interests=[str(x) for x in data.get("interests", [])],
            aptitudes={str(k): int(v) for k, v in data.get("aptitudes", {}).items()},
            personality=[str(x) for x in data.get("personality", [])],
            jobs_by_zone={int(k): [str(j) for j in v] for k, v in data.get("jobs_by_zone", {}).items()},
        )


@dataclass
class SessionContext:
    """Everything the AI knows about the person at a given moment. Rebuilt from the database."""

    report: Report | None = None
    turn_summaries: list[TurnSummary] = field(default_factory=list)
    collection: list[CollectionItem] = field(default_factory=list)
    # Things the young person said himself that he wants to avoid or prefer, word for word
    declared_constraints: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class TurnReply:
    reply: str
    safety: Safety
    turn_ended: bool


@dataclass(frozen=True)
class NewEntry:
    quote: str
    fact: str
    rome_code: str | None
    rome_label: str | None


@dataclass(frozen=True)
class TurnAnalysis:
    entries: list[NewEntry]
    summary: str
    engagement: Engagement
    topics_to_explore: list[str]
    declared_constraints: list[str]


@dataclass(frozen=True)
class Crossing:
    kind: Literal["match", "gap"]
    text: str


@dataclass(frozen=True)
class PersonalityCard:
    title: str
    description: str
    # Exact sentence of the young person that backs the card
    evidence: str


@dataclass(frozen=True)
class Summary:
    overview: str
    crossings: list[Crossing]
    personality_cards: list[PersonalityCard]
    suggestions: list[str]
