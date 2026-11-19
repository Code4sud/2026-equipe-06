"""Local test server: the real routes of the backend, with an in-memory database instead of MongoDB.

Same routes and same code as the real server (router/router.py and game/), so what works here works
there. Everything is lost on restart. Useful to try the game without a MongoDB.

Run from backend/:

    PYTHONPATH=src uv run python -m ai.dev_server

then put VITE_USE_MOCK=false in frontend/.env.local and start the front (it proxies /api to port 5000).
AI_MIRROR_AFTER_TURNS=1 brings the mirror after one card, AI_DEV_PORT changes the port.
"""

import copy
import logging
import os
import uuid
from typing import NoReturn

# mypy cannot see the types of this package from here (same as for the Mistral SDK)
from flask import Flask  # type: ignore[import-not-found]

from db.protocol import Document
from router.router import Router

log = logging.getLogger("ai.dev_server")


class MemoryDatabase:
    """Same methods as db.mongo.MongoDatabase (db.protocol.Database), kept in a dict."""

    def __init__(self) -> None:
        self._collections: dict[str, dict[str, Document]] = {}

    def connect(self) -> None:
        pass

    def close(self) -> None:
        pass

    def _table(self, collection: str) -> dict[str, Document]:
        return self._collections.setdefault(collection, {})

    def get(self, collection: str, id: str) -> Document | None:
        doc = self._table(collection).get(id)
        return {**copy.deepcopy(doc), "id": id} if doc is not None else None

    def find(self, collection: str, filters: Document | None = None, limit: int = 100, skip: int = 0) -> list[Document]:
        found = [
            {**copy.deepcopy(doc), "id": doc_id}
            for doc_id, doc in self._table(collection).items()
            if all(doc.get(key) == value for key, value in (filters or {}).items())
        ]
        return found[skip : skip + limit]

    def insert(self, collection: str, data: Document) -> str:
        doc_id = uuid.uuid4().hex
        self._table(collection)[doc_id] = copy.deepcopy(data)
        return doc_id

    def update(self, collection: str, id: str, data: Document) -> bool:
        doc = self._table(collection).get(id)
        if doc is None:
            return False
        doc.update(copy.deepcopy(data))
        return True

    def delete(self, collection: str, id: str) -> bool:
        return self._table(collection).pop(id, None) is not None


def create_app() -> Flask:
    # Local only: logging in needs no e-mail code (the front skips that step in development too)
    os.environ.setdefault("AUTH_SKIP_CODE", "1")
    app = Flask(__name__)
    app.extensions["db"] = MemoryDatabase()
    for path, view, method in Router():
        app.add_url_rule(f"/api/{path}", view_func=view, methods=[method])
    return app


def main() -> NoReturn:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    port = int(os.environ.get("AI_DEV_PORT", "5000"))
    log.info("Test server on http://127.0.0.1:%d (in-memory database)", port)
    create_app().run(host="127.0.0.1", port=port, debug=False)
    raise SystemExit(0)


if __name__ == "__main__":
    main()
