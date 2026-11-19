"""Test server: plays the whole game of the front with the real AI, without the team's database.

It follows the contract of frontend/src/api/http.ts and puts the `ai` module behind it. Everything is
kept in memory and lost on restart, and there is one game per e-mail: this is NOT the real backend
(Flask and MongoDB), only a way to try the AI in the real interface before it is plugged in there.

Run from backend/:

    PYTHONPATH=src uv run python -m ai.dev_server

then put VITE_USE_MOCK=false in frontend/.env.local and start the front.

Handy variables: DEV_MIRROR_AFTER=1 brings the mirror after one card (instead of
rules.MIRROR_MIN_TURNS), AI_DEV_PORT changes the port (5000 by default, the one the front proxies to).
"""

import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, NoReturn

# mypy cannot see the types of this package from here (same as for the Mistral SDK)
from flask import Flask, Response, abort, jsonify, request  # type: ignore[import-not-found]

from . import analysis, conversation, drawing, rules
from . import summary as summary_module
from .config import AIConfigError
from .data import get_card, load_report, mirror_card
from .llm import LLMError
from .models import Card, CollectionItem, Message, SessionContext, TurnSummary

log = logging.getLogger("ai.dev_server")
app = Flask(__name__)

MIRROR_AFTER_TURNS = int(os.environ.get("DEV_MIRROR_AFTER", rules.MIRROR_MIN_TURNS))


# ---- State kept in memory -----------------------------------------------------------------------


@dataclass
class Entry:
    id: str
    card: Card
    quote: str
    fact: str
    rome_code: str | None
    rome_label: str | None
    status: str = "proposed"  # proposed, kept or rejected


@dataclass
class Turn:
    card: Card
    history: list[Message] = field(default_factory=list)


@dataclass
class Game:
    id: str
    email: str
    started_at: float
    ctx: SessionContext
    entries: dict[str, Entry] = field(default_factory=dict)
    turns: dict[str, Turn] = field(default_factory=dict)
    draw: drawing.DrawState = field(default_factory=drawing.DrawState)
    state: str = "drawing"
    mirror: Turn | None = None
    mirror_selected: list[CollectionItem] = field(default_factory=list)


GAMES: dict[str, Game] = {}
GAMES_BY_EMAIL: dict[str, Game] = {}


def fail(status: int, message: str) -> NoReturn:
    """Stops the request with an HTTP error."""
    abort(status, description=message)
    raise AssertionError("unreachable: abort() always raises")


def game_or_404(session_id: str) -> Game:
    game = GAMES.get(session_id)
    if game is None:
        fail(404, "Unknown session")
    return game


def turn_or_404(game: Game, turn_id: str) -> Turn:
    turn = game.turns.get(turn_id)
    if turn is None:
        fail(404, "Unknown turn")
    return turn


# ---- Shapes the front expects (frontend/src/types.ts) -------------------------------------------


def card_json(card: Card) -> dict[str, Any]:
    # level, intention and opener stay on the server
    return {"id": card.id, "family": card.family, "format": card.format, "title": card.title}


def message_json(text: str) -> dict[str, str]:
    return {"author": "assistant", "text": text}


def entry_json(entry: Entry) -> dict[str, Any]:
    return {
        "id": entry.id,
        "card": card_json(entry.card),
        "quote": entry.quote,
        # The front shows one label: the fact ("Trouve d'où vient une panne").
        # The ROME skill is sent along for when the front shows it too.
        "skill": entry.fact,
        "fact": entry.fact,
        "romeCode": entry.rome_code,
        "romeLabel": entry.rome_label,
        "status": entry.status,
    }


def sync_context(game: Game) -> None:
    """The AI only remembers what the young person did not reject."""
    game.ctx.collection = [
        CollectionItem(e.id, e.card.title, e.quote, e.fact, e.rome_code, e.rome_label)
        for e in game.entries.values()
        if e.status != "rejected"
    ]


def body() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


# ---- Routes -------------------------------------------------------------------------------------


@app.post("/api/auth/code")
def auth_code() -> Response:
    # Test server: no e-mail is sent and any code is accepted
    return Response(status=204)


@app.post("/api/sessions")
def create_session() -> Response:
    email = str(body().get("email", "")).strip().lower()
    if not email:
        fail(400, "email is required")
    game = GAMES_BY_EMAIL.get(email)
    is_new = game is None
    if game is None:
        game = Game(
            id=uuid.uuid4().hex,
            email=email,
            started_at=time.time(),
            ctx=SessionContext(report=load_report()),  # the sample report for everyone
        )
        GAMES[game.id] = game
        GAMES_BY_EMAIL[email] = game
    return jsonify(sessionId=game.id, isNew=is_new, state=game.state)


@app.get("/api/sessions/<session_id>")
def get_session(session_id: str) -> Response:
    game = game_or_404(session_id)
    return jsonify(
        state=game.state,
        collection=[entry_json(e) for e in game.entries.values()],
        turnsCount=game.draw.turns_played,
    )


@app.post("/api/sessions/<session_id>/draws")
def draws(session_id: str) -> Response:
    game = game_or_404(session_id)
    if game.state == "summary":
        return jsonify([])
    minutes = (time.time() - game.started_at) / 60
    if game.draw.turns_played >= MIRROR_AFTER_TURNS or minutes >= rules.MIRROR_MAX_MINUTES:
        return jsonify([card_json(mirror_card())])  # the mirror card comes alone
    return jsonify([card_json(c) for c in drawing.draw_cards(game.draw)])


@app.post("/api/sessions/<session_id>/turns")
def start_turn(session_id: str) -> Response:
    game = game_or_404(session_id)
    try:
        card = get_card(str(body().get("cardId", "")))
    except KeyError:
        fail(404, "Unknown card")

    text = conversation.open_turn(game.ctx, card)
    turn = Turn(card=card, history=[Message("assistant", text)])
    turn_id = uuid.uuid4().hex
    game.turns[turn_id] = turn

    result: dict[str, Any] = {"turnId": turn_id, "message": message_json(text)}
    if card.format == "mirror":
        game.mirror, game.state = turn, "mirror"
        result["pickFromCollection"] = True
    else:
        game.state = "in_turn"
    return jsonify(result)


def finish_turn(game: Game, turn: Turn, *, distress: bool) -> list[Entry]:
    """End of a card: remember it for the next draw and run the silent analysis. Returns the new entries."""
    game.draw.played_ids.add(turn.card.id)
    game.draw.turns_played += 1
    game.draw.last_family = turn.card.family
    if distress:
        return []

    try:
        result = analysis.analyze_turn(game.ctx, turn.card, turn.history)
    except LLMError:
        log.exception("The analysis of the turn failed: nothing is kept from this card")
        game.draw.last_engagement = "neutral"
        return []

    game.draw.last_engagement = result.engagement
    game.draw.topics_to_explore = result.topics_to_explore
    if result.summary:
        game.ctx.turn_summaries.append(
            TurnSummary(turn.card.id, turn.card.title, result.summary, result.engagement)
        )
    for constraint in result.declared_constraints:
        if constraint not in game.ctx.declared_constraints:
            game.ctx.declared_constraints.append(constraint)

    created = []
    for e in result.entries:
        entry = Entry(uuid.uuid4().hex, turn.card, e.quote, e.fact, e.rome_code, e.rome_label)
        game.entries[entry.id] = entry
        created.append(entry)
    sync_context(game)
    log.info("Turn done on %r: %d entries kept, engagement %s", turn.card.title, len(created), result.engagement)
    return created


@app.post("/api/sessions/<session_id>/turns/<turn_id>/messages")
def send_message(session_id: str, turn_id: str) -> Response:
    game = game_or_404(session_id)
    turn = turn_or_404(game, turn_id)
    data = body()
    text = str(data.get("text", "")).strip()
    ids = data.get("selectedEntryIds")
    is_mirror = turn.card.format == "mirror"

    selected: list[CollectionItem] | None = None
    if is_mirror and isinstance(ids, list):
        wanted = {str(i) for i in ids}
        selected = [item for item in game.ctx.collection if item.id in wanted]
        game.mirror_selected = selected

    reply = conversation.reply(game.ctx, turn.card, turn.history, text, selected=selected)
    user_text = text or (conversation.pick_message(selected) if selected is not None else "")
    turn.history += [Message("user", user_text), Message("assistant", reply.reply)]

    result: dict[str, Any] = {"message": message_json(reply.reply), "turnEnded": reply.turn_ended}
    if reply.safety != "none":
        result["safety"] = reply.safety
    if reply.turn_ended:
        if is_mirror:
            game.state = "summary"
        else:
            entries = finish_turn(game, turn, distress=reply.safety == "distress")
            game.state = "drawing"
            if entries:
                result["newEntries"] = [entry_json(e) for e in entries]
    return jsonify(result)


@app.get("/api/sessions/<session_id>/collection")
def get_collection(session_id: str) -> Response:
    game = game_or_404(session_id)
    return jsonify([entry_json(e) for e in game.entries.values()])


@app.patch("/api/sessions/<session_id>/collection/<entry_id>")
def update_entry(session_id: str, entry_id: str) -> Response:
    game = game_or_404(session_id)
    entry = game.entries.get(entry_id)
    status = str(body().get("status", ""))
    if entry is None:
        fail(404, "Unknown entry")
    if status not in ("proposed", "kept", "rejected"):
        fail(400, "status must be proposed, kept or rejected")
    entry.status = status
    sync_context(game)
    return jsonify(entry_json(entry))


@app.get("/api/sessions/<session_id>/summary")
def get_summary(session_id: str) -> Response:
    game = game_or_404(session_id)
    # Until the validation screen exists, everything not rejected counts as kept
    kept = [e for e in game.entries.values() if e.status != "rejected"]
    items = [CollectionItem(e.id, e.card.title, e.quote, e.fact, e.rome_code, e.rome_label) for e in kept]
    mirror_messages = game.mirror.history if game.mirror else []
    result = summary_module.summarize(game.ctx, items, game.mirror_selected, mirror_messages)
    return jsonify(
        overview=result.overview,
        collection=[entry_json(e) for e in kept],
        personalityCards=[
            {"id": f"p{i}", "title": c.title, "description": c.description, "evidence": c.evidence}
            for i, c in enumerate(result.personality_cards)
        ],
        suggestions=result.suggestions,
        crossings=[{"kind": c.kind, "text": c.text} for c in result.crossings],
    )


# ---- Errors -------------------------------------------------------------------------------------


@app.errorhandler(LLMError)
def on_llm_error(exc: LLMError) -> tuple[Response, int]:
    log.error("AI error: %s", exc)
    return jsonify(error=str(exc)), 502


@app.errorhandler(AIConfigError)
def on_config_error(exc: AIConfigError) -> tuple[Response, int]:
    log.error("Configuration error: %s", exc)
    return jsonify(error=str(exc)), 500


def main() -> NoReturn:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    port = int(os.environ.get("AI_DEV_PORT", "5000"))
    log.info("Test server on http://127.0.0.1:%d (mirror after %d cards)", port, MIRROR_AFTER_TURNS)
    app.run(host="127.0.0.1", port=port, debug=False)
    raise SystemExit(0)


if __name__ == "__main__":
    main()
