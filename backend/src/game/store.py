"""A game in the database, and its conversion to the models of the AI module.

Three collections:
- sessions: one per e-mail, with the report, the memory of past turns and the state of the draw;
- turns: one per card played, with its messages;
- entries: the collection of the young person (one document per entry).

The AI functions keep no memory: the context is rebuilt from these documents on every request.
"""

import time
from dataclasses import asdict
from typing import Any, cast

from ai import drawing
from ai.data import get_card, load_report
from ai.models import CollectionItem, Engagement, Message, Report, SessionContext, TurnSummary
from db.protocol import Database, Document

SESSIONS = "sessions"
TURNS = "turns"
ENTRIES = "entries"


class GameError(Exception):
    """An error the route turns into an HTTP answer (404 unknown session, 400 bad request…)."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


# ---- Sessions -----------------------------------------------------------------------------------


def _report_to_doc(report: Report) -> Document:
    data = asdict(report)
    # MongoDB keys must be strings: zones 1 to 5 are stored as "1" to "5"
    data["jobs_by_zone"] = {str(zone): jobs for zone, jobs in report.jobs_by_zone.items()}
    return data


def new_session(email: str) -> Document:
    return {
        "email": email,
        "created_at": time.time(),
        "state": "drawing",
        # Real reports will be ingested later: everyone gets the sample one for now
        "report": _report_to_doc(load_report()),
        "turn_summaries": [],
        "declared_constraints": [],
        "draw": draw_state_to_doc(drawing.DrawState()),
        "mirror_turn_id": None,
        "mirror_selected_ids": [],
    }


def load_session(db: Database, session_id: str) -> Document:
    session = db.get(SESSIONS, session_id)
    if session is None:
        raise GameError(404, "Unknown session")
    return session


def find_session_by_email(db: Database, email: str) -> Document | None:
    found = db.find(SESSIONS, {"email": email}, limit=1)
    return found[0] if found else None


# ---- Turns --------------------------------------------------------------------------------------


def load_turn(db: Database, session_id: str, turn_id: str) -> Document:
    turn = db.get(TURNS, turn_id)
    if turn is None or turn.get("session_id") != session_id:
        raise GameError(404, "Unknown turn")
    return turn


def history_of(turn: Document) -> list[Message]:
    return [Message(role=m["role"], text=m["text"]) for m in turn.get("history", [])]


def history_to_doc(history: list[Message]) -> list[Document]:
    return [{"role": m.role, "text": m.text} for m in history]


# ---- Entries ------------------------------------------------------------------------------------


def load_entries(db: Database, session_id: str) -> list[Document]:
    return db.find(ENTRIES, {"session_id": session_id}, limit=500)


def load_entry(db: Database, session_id: str, entry_id: str) -> Document:
    entry = db.get(ENTRIES, entry_id)
    if entry is None or entry.get("session_id") != session_id:
        raise GameError(404, "Unknown entry")
    return entry


def item_of(entry: Document) -> CollectionItem:
    return CollectionItem(
        id=entry["id"],
        card_title=get_card(entry["card_id"]).title,
        quote=entry["quote"],
        fact=entry["fact"],
        rome_code=entry.get("rome_code"),
        rome_label=entry.get("rome_label"),
    )


def kept_items(entries: list[Document]) -> list[CollectionItem]:
    """What the AI may use: everything the young person did not reject."""
    return [item_of(e) for e in entries if e.get("status") != "rejected"]


# ---- Context for the AI -------------------------------------------------------------------------


def context_of(session: Document, entries: list[Document]) -> SessionContext:
    report = session.get("report")
    return SessionContext(
        report=Report.from_dict(report) if report else None,
        turn_summaries=[
            TurnSummary(
                card_id=s["card_id"],
                card_title=s["card_title"],
                summary=s["summary"],
                engagement=cast(Engagement, s["engagement"]),
            )
            for s in session.get("turn_summaries", [])
        ],
        collection=kept_items(entries),
        declared_constraints=list(session.get("declared_constraints", [])),
    )


def draw_state_of(session: Document) -> drawing.DrawState:
    draw: dict[str, Any] = session.get("draw") or {}
    return drawing.DrawState(
        played_ids=set(draw.get("played_ids", [])),
        turns_played=int(draw.get("turns_played", 0)),
        last_engagement=cast("Engagement | None", draw.get("last_engagement")),
        last_family=draw.get("last_family"),
        topics_to_explore=list(draw.get("topics_to_explore", [])),
    )


def draw_state_to_doc(state: drawing.DrawState) -> Document:
    return {
        "played_ids": sorted(state.played_ids),
        "turns_played": state.turns_played,
        "last_engagement": state.last_engagement,
        "last_family": state.last_family,
        "topics_to_explore": state.topics_to_explore,
    }
