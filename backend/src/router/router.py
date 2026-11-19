import hashlib
import hmac
import inspect
import logging
import os
import secrets
from datetime import timedelta
from typing import Any, Callable, Dict, Iterator, Literal, Tuple

from flask import current_app, jsonify, request
from pydantic import BaseModel, ValidationError

from ai import AIConfigError, LLMError
from controllers.mailer import send_auth_code
from game import service
from game.store import GameError
from models.models import AuthCode, CodeRequest, utcnow


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}

log = logging.getLogger(__name__)

USERS = "users"
AUTH_CODES = "auth_codes"

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5
CODE_LENGTH = 8


# Routes can take URL parameters (<session_id>…), hence Callable[..., Any]
def route(path: str, type: METHOD_NAME = "GET") -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def wrapper(func: Callable[..., Any]) -> Callable[..., Any]:
        routes[func.__name__] = (path, type)
        return func
    return wrapper


class RouterException(Exception):
    pass


def _db() -> Any:
    return current_app.extensions["db"]


def _body() -> Dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _respond(action: Callable[[], Any]) -> Any:
    """Runs a game action and turns its result, or its error, into a JSON answer."""
    try:
        return jsonify(action())
    except GameError as e:
        return jsonify(error=e.message), e.status
    except LLMError as e:
        log.error("AI error: %s", e)
        return jsonify(error=str(e)), 502
    except AIConfigError as e:
        log.error("AI configuration error: %s", e)
        return jsonify(error=str(e)), 500


def _hash_code(email: str, code: str) -> str:
    secret = os.environ["AUTH_CODE_SECRET"].encode()
    return hmac.new(secret, f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _parse[M: BaseModel](model: type[M]) -> M | tuple[Any, int]:
    try:
        return model.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify(error=e.errors(include_url=False, include_context=False, include_input=False)), 400



class Router:

    @staticmethod
    @route("auth/code", "POST")
    def auth_code() -> Any:
        payload = _parse(CodeRequest)
        if isinstance(payload, tuple):
            return payload

        db = current_app.extensions["db"]
        now = utcnow()

        previous = [AuthCode.from_document(d) for d in db.find(AUTH_CODES, {"email": payload.email})]
        if any(now - c.created_at < RESEND_COOLDOWN for c in previous):
            return jsonify(error="Please wait before requesting a new code."), 429
        for old in previous:
            db.delete(AUTH_CODES, old.id)

        code = f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"
        db.insert(AUTH_CODES, AuthCode(
            email=payload.email,
            code_hash=_hash_code(payload.email, code),
            expires_at=now + CODE_TTL,
        ).to_document())

        send_auth_code(payload.email, code, int(CODE_TTL.total_seconds() // 60))
        return "", 204


    @staticmethod
    @route("sessions", "POST")
    def create_session() -> Any:
        return _respond(lambda: service.create_session(_db(), str(_body().get("email", ""))))


    @staticmethod
    @route("sessions/<session_id>", "GET")
    def get_session(session_id: str) -> Any:
        return _respond(lambda: service.get_session(_db(), session_id))


    @staticmethod
    @route("sessions/<session_id>/draws", "POST")
    def draw_cards(session_id: str) -> Any:
        return _respond(lambda: service.draw_cards(_db(), session_id))


    @staticmethod
    @route("sessions/<session_id>/turns", "POST")
    def start_turn(session_id: str) -> Any:
        return _respond(lambda: service.start_turn(_db(), session_id, str(_body().get("cardId", ""))))


    @staticmethod
    @route("sessions/<session_id>/turns/<turn_id>/messages", "POST")
    def send_message(session_id: str, turn_id: str) -> Any:
        body = _body()
        ids = body.get("selectedEntryIds")
        return _respond(
            lambda: service.send_message(
                _db(), session_id, turn_id, str(body.get("text", "")), ids if isinstance(ids, list) else None
            )
        )


    @staticmethod
    @route("sessions/<session_id>/turns/<turn_id>/skip", "POST")
    def skip_turn(session_id: str, turn_id: str) -> Any:
        return _respond(lambda: service.skip_turn(_db(), session_id, turn_id))


    @staticmethod
    @route("sessions/<session_id>/finish", "POST")
    def finish_game(session_id: str) -> Any:
        turn_id = _body().get("turnId")
        return _respond(lambda: service.finish_game(_db(), session_id, str(turn_id) if turn_id else None))


    @staticmethod
    @route("sessions/<session_id>/collection", "GET")
    def get_collection(session_id: str) -> Any:
        return _respond(lambda: service.get_collection(_db(), session_id))


    @staticmethod
    @route("sessions/<session_id>/collection/<entry_id>", "PATCH")
    def update_entry(session_id: str, entry_id: str) -> Any:
        return _respond(lambda: service.update_entry(_db(), session_id, entry_id, str(_body().get("status", ""))))


    @staticmethod
    @route("sessions/<session_id>/summary", "GET")
    def get_summary(session_id: str) -> Any:
        return _respond(lambda: service.get_summary(_db(), session_id))


    @staticmethod
    @route("sessions/<session_id>/summary/suggestions", "POST")
    def suggest_with_mentions(session_id: str) -> Any:
        mentions = _body().get("mentions")
        return _respond(
            lambda: service.suggestions_with_mentions(_db(), session_id, mentions if isinstance(mentions, list) else [])
        )


    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, Any, str]]:
        for name, member in inspect.getmembers(cls):
            if not isinstance(inspect.getattr_static(cls, name), staticmethod) or name.startswith("__"):
                continue
            path, method_type = routes.get(name, (None, "GET"))
            if path is None:
                raise RouterException(f"Route for method '{name}' is not defined.")
            yield path, member, method_type
