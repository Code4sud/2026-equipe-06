"""What each API route does. Returns plain dicts in the shapes of frontend/src/types.ts.

Every function receives the database explicitly, so the same code runs on MongoDB (the server)
and on an in-memory database (ai/dev_server.py, for local tests).
"""

import logging
import os
import time
from typing import Any

from ai import analysis, conversation, drawing, rules
from ai.data import get_card, mirror_card
from ai.llm import LLMError
from ai.models import Card, Message
from ai import guards
from ai.summary import find_sensitive_mentions, suggest_with_mentions, summarize
from db.protocol import Database, Document

from .store import (
    ENTRIES,
    SESSIONS,
    TURNS,
    GameError,
    context_of,
    draw_state_of,
    draw_state_to_doc,
    find_session_by_email,
    history_of,
    history_to_doc,
    item_of,
    kept_items,
    load_entries,
    load_entry,
    load_session,
    load_turn,
    new_session,
)

log = logging.getLogger(__name__)

# After how many cards the mirror comes. Can be lowered for a demo with AI_MIRROR_AFTER_TURNS=1
MIRROR_AFTER_TURNS = int(os.environ.get("AI_MIRROR_AFTER_TURNS", rules.MIRROR_MIN_TURNS))

_STATUSES = ("proposed", "kept", "rejected")


# ---- Shapes of the front ------------------------------------------------------------------------


def card_json(card: Card) -> dict[str, Any]:
    # level, intention and opener stay on the server
    return {"id": card.id, "family": card.family, "format": card.format, "title": card.title}


def message_json(text: str) -> dict[str, str]:
    return {"author": "assistant", "text": text}


def entry_json(entry: Document) -> dict[str, Any]:
    return {
        "id": entry["id"],
        "card": card_json(get_card(entry["card_id"])),
        "quote": entry["quote"],
        # The front shows one label: the fact. The ROME skill is sent along for when it shows it too
        "skill": entry["fact"],
        "fact": entry["fact"],
        "romeCode": entry.get("rome_code"),
        "romeLabel": entry.get("rome_label"),
        "status": entry.get("status", "proposed"),
    }


# ---- Sessions -----------------------------------------------------------------------------------


def create_session(db: Database, email: str) -> dict[str, Any]:
    """Creates the game of this e-mail, or finds it again (any code is accepted for now)."""
    email = email.strip().lower()
    if not email:
        raise GameError(400, "email is required")
    existing = find_session_by_email(db, email)
    if existing:
        return {"sessionId": existing["id"], "isNew": False, "state": existing.get("state", "drawing")}
    session_id = db.insert(SESSIONS, new_session(email))
    return {"sessionId": session_id, "isNew": True, "state": "drawing"}


def get_session(db: Database, session_id: str) -> dict[str, Any]:
    session = load_session(db, session_id)
    return {
        "state": session.get("state", "drawing"),
        "collection": [entry_json(e) for e in load_entries(db, session_id)],
        "turnsCount": draw_state_of(session).turns_played,
    }


# ---- Draws and turns ----------------------------------------------------------------------------


def draw_cards(db: Database, session_id: str) -> list[dict[str, Any]]:
    """Four cards (the front adds the joker), or the mirror card alone when the game is over."""
    session = load_session(db, session_id)
    if session.get("state") == "summary":
        return []
    state = draw_state_of(session)
    minutes = (time.time() - float(session.get("created_at", time.time()))) / 60
    if state.turns_played >= MIRROR_AFTER_TURNS or minutes >= rules.MIRROR_MAX_MINUTES:
        return [card_json(mirror_card())]
    return [card_json(card) for card in drawing.draw_cards(state)]


def start_turn(db: Database, session_id: str, card_id: str) -> dict[str, Any]:
    session = load_session(db, session_id)
    try:
        card = get_card(card_id)
    except KeyError:
        raise GameError(404, "Unknown card") from None

    ctx = context_of(session, load_entries(db, session_id))
    text = conversation.open_turn(ctx, card)
    turn_id = db.insert(
        TURNS,
        {
            "session_id": session_id,
            "card_id": card.id,
            "history": history_to_doc([Message("assistant", text)]),
            "created_at": time.time(),
        },
    )

    is_mirror = card.format == "mirror"
    db.update(SESSIONS, session_id, {"state": "mirror", "mirror_turn_id": turn_id} if is_mirror else {"state": "in_turn"})
    result: dict[str, Any] = {"turnId": turn_id, "message": message_json(text)}
    if is_mirror:
        result["pickFromCollection"] = True
    return result


def _finish_turn(
    db: Database, session: Document, card: Card, history: list[Message], *, distress: bool
) -> list[Document]:
    """End of a card: remember it for the next draw and run the silent analysis. Returns the new entries."""
    session_id = session["id"]
    state = draw_state_of(session)
    state.played_ids.add(card.id)
    state.turns_played += 1
    state.last_family = card.family
    summaries = list(session.get("turn_summaries", []))
    constraints = list(session.get("declared_constraints", []))
    created: list[Document] = []

    # Nothing to analyze after a distress message, or when the card was skipped before any answer
    if not distress and any(m.role == "user" for m in history):
        ctx = context_of(session, load_entries(db, session_id))
        try:
            result = analysis.analyze_turn(ctx, card, history)
        except LLMError:
            log.exception("The analysis of the turn failed: nothing is kept from this card")
            state.last_engagement = "neutral"
        else:
            state.last_engagement = result.engagement
            state.topics_to_explore = result.topics_to_explore
            if result.summary:
                summaries.append(
                    {"card_id": card.id, "card_title": card.title, "summary": result.summary, "engagement": result.engagement}
                )
            constraints += [c for c in result.declared_constraints if c not in constraints]
            for e in result.entries:
                doc = {
                    "session_id": session_id,
                    "card_id": card.id,
                    "quote": e.quote,
                    "fact": e.fact,
                    "rome_code": e.rome_code,
                    "rome_label": e.rome_label,
                    "status": "proposed",
                    "created_at": time.time(),
                }
                # insert gets a copy: pymongo adds a non-JSON "_id" to the dict it receives
                created.append({**doc, "id": db.insert(ENTRIES, dict(doc))})
            log.info("Turn done on %r: %d entries kept, engagement %s", card.title, len(created), result.engagement)

    db.update(
        SESSIONS,
        session_id,
        {
            "state": "drawing",
            "draw": draw_state_to_doc(state),
            "turn_summaries": summaries,
            "declared_constraints": constraints,
        },
    )
    return created


def send_message(
    db: Database, session_id: str, turn_id: str, text: str, selected_ids: list[Any] | None
) -> dict[str, Any]:
    session = load_session(db, session_id)
    turn = load_turn(db, session_id, turn_id)
    card = get_card(turn["card_id"])
    ctx = context_of(session, load_entries(db, session_id))
    history = history_of(turn)
    is_mirror = card.format == "mirror"
    text = text.strip()

    selected = None
    if is_mirror and selected_ids is not None:
        wanted = {str(i) for i in selected_ids}
        selected = [item for item in ctx.collection if item.id in wanted]
        db.update(SESSIONS, session_id, {"mirror_selected_ids": [item.id for item in selected]})

    if turn.get("ended"):
        raise GameError(409, "This card is over")
    reply = conversation.reply(ctx, card, history, text, selected=selected)
    user_text = text or (conversation.pick_message(selected) if selected is not None else "")
    history += [Message("user", user_text), Message("assistant", reply.reply)]
    db.update(TURNS, turn_id, {"history": history_to_doc(history)})

    result: dict[str, Any] = {"message": message_json(reply.reply), "turnEnded": reply.turn_ended}
    if reply.safety != "none":
        result["safety"] = reply.safety
    if reply.turn_ended:
        db.update(TURNS, turn_id, {"ended": True})
        if is_mirror:
            db.update(SESSIONS, session_id, {"state": "summary"})
        else:
            created = _finish_turn(db, session, card, history, distress=reply.safety == "distress")
            if created:
                result["newEntries"] = [entry_json(e) for e in created]
    return result


# ---- Leaving a card, going to the summary --------------------------------------------------------


def skip_turn(db: Database, session_id: str, turn_id: str) -> dict[str, Any]:
    """Passer: the conversation on this card stops. What was said is still analyzed.

    For the mirror (only when the young person quits during it), the game goes back to the draw:
    the mirror card comes back next time.
    """
    session = load_session(db, session_id)
    turn = load_turn(db, session_id, turn_id)
    if turn.get("ended"):
        return {}
    db.update(TURNS, turn_id, {"ended": True})
    card = get_card(turn["card_id"])
    if card.format == "mirror":
        db.update(SESSIONS, session_id, {"state": "drawing"})
        return {}
    created = _finish_turn(db, session, card, history_of(turn), distress=False)
    return {"newEntries": [entry_json(e) for e in created]} if created else {}


def finish_game(db: Database, session_id: str, turn_id: str | None) -> dict[str, Any]:
    """Passer au bilan: ends the card in progress if there is one, then straight to the summary (no mirror)."""
    result: dict[str, Any] = {}
    if turn_id:
        turn = load_turn(db, session_id, turn_id)
        # The mirror is a conversation about the game, not a card: nothing to analyze
        if get_card(turn["card_id"]).format != "mirror":
            result = skip_turn(db, session_id, turn_id)
        else:
            db.update(TURNS, turn_id, {"ended": True})
    else:
        load_session(db, session_id)
    db.update(SESSIONS, session_id, {"state": "summary"})
    return result


# ---- Collection and summary ---------------------------------------------------------------------


def get_collection(db: Database, session_id: str) -> list[dict[str, Any]]:
    load_session(db, session_id)
    return [entry_json(e) for e in load_entries(db, session_id)]


def update_entry(db: Database, session_id: str, entry_id: str, status: str) -> dict[str, Any]:
    entry = load_entry(db, session_id, entry_id)
    if status not in _STATUSES:
        raise GameError(400, "status must be proposed, kept or rejected")
    db.update(ENTRIES, entry_id, {"status": status})
    return entry_json({**entry, "status": status})


def _summary_material(db: Database, session_id: str) -> tuple[Document, list[Document], list[Message]]:
    """The session, the entries not rejected and the mirror conversation."""
    session = load_session(db, session_id)
    entries = [e for e in load_entries(db, session_id) if e.get("status") != "rejected"]
    mirror_turn = db.get(TURNS, session["mirror_turn_id"]) if session.get("mirror_turn_id") else None
    mirror_messages = history_of(mirror_turn) if mirror_turn else []
    return session, entries, mirror_messages


def _everything_said(db: Database, session_id: str) -> list[str]:
    """Every message of the young person in this game, mirror included."""
    turns = db.find(TURNS, {"session_id": session_id}, limit=500)
    return [text for turn in turns for text in guards.user_texts(history_of(turn))]


def get_summary(db: Database, session_id: str) -> dict[str, Any]:
    # Called once the young person has kept or rejected his entries: only the kept ones count
    session, entries, mirror_messages = _summary_material(db, session_id)
    selected_ids = set(session.get("mirror_selected_ids", []))
    selected = [item_of(e) for e in entries if e["id"] in selected_ids]

    result = summarize(context_of(session, entries), kept_items(entries), selected, mirror_messages)
    try:
        mentions = find_sensitive_mentions(_everything_said(db, session_id))
    except LLMError:
        log.exception("Looking for sensitive mentions failed: the question is not asked")
        mentions = []
    return {
        "overview": result.overview,
        "collection": [entry_json(e) for e in entries],
        "personalityCards": [
            {"id": f"p{i}", "title": c.title, "description": c.description, "evidence": c.evidence}
            for i, c in enumerate(result.personality_cards)
        ],
        "suggestions": result.suggestions,
        "crossings": [{"kind": c.kind, "text": c.text} for c in result.crossings],
        # Asked at the summary: "do you want us to take this into account?" Nothing is stored
        "sensitiveMentions": mentions,
    }


def suggestions_with_mentions(db: Database, session_id: str, mentions: list[Any]) -> dict[str, Any]:
    """The suggestions again, with what the young person agreed to share. Nothing is stored."""
    said = _everything_said(db, session_id)
    # Only his own words: anything that is not in what he said is ignored
    wanted = [m for m in (str(x).strip() for x in mentions) if m and guards.is_exact_quote(m, said)]
    if not wanted:
        raise GameError(400, "mentions must be sentences the young person said")
    session, entries, mirror_messages = _summary_material(db, session_id)
    suggestions = suggest_with_mentions(context_of(session, entries), kept_items(entries), mirror_messages, wanted)
    return {"suggestions": suggestions}
