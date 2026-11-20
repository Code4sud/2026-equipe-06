"""The deck of cards in the database (collection "cards").

backend/data/cards.json is the versioned reference. At startup, sync_cards
copies it into the database when the collection is empty or holds another
version of the deck (the "version" field of cards.json): to change the cards in
production, edit cards.json, bump its version and redeploy. A card edited
directly in the database stays as is until the next version.

The game then reads the cards from the database only (see card_source and
ai.data.use_card_source).
"""

import json
import logging
from typing import Any, Callable

from ai.config import data_dir
from db.protocol import Database, Document

log = logging.getLogger(__name__)

CARDS = "cards"
# Well above the 50 cards + the mirror: find() returns 100 documents by default
_MAX_CARDS = 1000


def _read_json(name: str) -> dict[str, Any]:
    with open(data_dir() / name, encoding="utf-8") as f:
        return dict(json.load(f))


def deck_from_files() -> tuple[int, list[Document]]:
    """The version of cards.json and its cards as database documents, with
    their talents (card_talents.json) and the mirror card flagged.

    The card id is stored as card_id: the database uses "id" for its own ids.
    """
    deck = _read_json("cards.json")
    talents = _read_json("card_talents.json")["talents"]
    version = int(deck["version"])

    def to_doc(raw: dict[str, Any], mirror: bool) -> Document:
        doc = {key: value for key, value in raw.items() if key != "id"}
        return {
            **doc,
            "card_id": raw["id"],
            "talents": list(talents.get(raw["id"], [])),
            "mirror": mirror,
            "deck_version": version,
        }

    docs = [to_doc(raw, mirror=False) for raw in deck["cards"]]
    docs.append(to_doc(deck["mirror"], mirror=True))
    return version, docs


def sync_cards(db: Database) -> None:
    """Fills the collection from cards.json if it is empty or holds another
    version of the deck.
    """
    version, docs = deck_from_files()
    current = db.find(CARDS, limit=_MAX_CARDS)
    if current and all(d.get("deck_version") == version for d in current):
        return
    for doc in current:
        db.delete(CARDS, doc["id"])
    for doc in docs:
        db.insert(CARDS, doc)
    log.info("Cards: version %d copied into the database (%d cards)",
             version, len(docs))


def card_source(db: Database) -> Callable[[], list[dict[str, Any]]]:
    """For ai.data.use_card_source: reads the cards from the database, in the
    format of cards.json (id = card id).
    """

    def read() -> list[dict[str, Any]]:
        return [
            {**doc, "id": doc["card_id"]}
            for doc in db.find(CARDS, limit=_MAX_CARDS)
        ]

    return read
