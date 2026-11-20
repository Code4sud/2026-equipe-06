import inspect
import logging
import os
import secrets
import hashlib
import hmac

from datetime import timedelta
from typing import Any, Callable, Dict, Iterator, Literal, Tuple, cast

from flask import Response, current_app, jsonify, request
from pydantic import BaseModel, ValidationError

from ai import AIConfigError, LLMError
from controllers.mailer import MailError, send_auth_code
from game import service
from game.store import GameError
from models.models import AuthCode, CodeRequest, User, VerifyRequest, utcnow


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}

log = logging.getLogger(__name__)

USERS = "users"
AUTH_CODES = "auth_codes"

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5

CODE_LENGTH = 6


def _skip_code() -> bool:
    """Local development only: no code to ask for (AUTH_SKIP_CODE=1, set by
    ai/dev_server.py).
    """
    return os.environ.get("AUTH_SKIP_CODE", "").lower() in ("1", "true", "yes")


def _hash_code(email: str, code: str) -> str:
    """Hash the code with the email, so that it is not stored in cleartext in the database."""
    secret = os.environ["AUTH_CODE_SECRET"].encode()
    return hmac.new(secret, f"{email}:{code}".encode(), hashlib.sha256).hexdigest()



# Routes can take URL parameters (<session_id>…), hence Callable[..., Any]
def route(
    path: str, type: METHOD_NAME = "GET"
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
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
    """Runs a game action and turns its result, or its error, into an answer:
    JSON, or mp3 for the voice.
    """
    try:
        result = action()
        if isinstance(result, bytes):
            return Response(
                result,
                mimetype="audio/mpeg",
                headers={"Cache-Control": "private, max-age=86400"},
            )
        return jsonify(result)
    except GameError as e:
        return jsonify(error=e.message), e.status
    except LLMError as e:
        log.error("AI error: %s", e)
        return jsonify(error=str(e)), 502
    except AIConfigError as e:
        log.error("AI configuration error: %s", e)
        return jsonify(error=str(e)), 500


def _parse[M: BaseModel](model: type[M]) -> M | tuple[Any, int]:
    """Validate the JSON body. Returns the model, or a (response, status) on
    error.
    """
    try:
        return model.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify(
            error=e.errors(
                include_url=False, include_context=False, include_input=False
            )
        ), 400


def _check_code(email: str, code: str) -> Any | None:
    """None when the code is right (and it is then used up), otherwise the
    error answer.
    """
    db = _db()
    docs = db.find(AUTH_CODES, {"email": email}, limit=1)
    if not docs:
        return jsonify(error="No code requested for this email."), 400

    auth_code = AuthCode.from_document(docs[0])

    if auth_code.expires_at < utcnow():
        db.delete(AUTH_CODES, auth_code.id)
        return jsonify(error="Code expired."), 400

    if auth_code.attempts >= MAX_ATTEMPTS:
        db.delete(AUTH_CODES, auth_code.id)
        return jsonify(error="Too many attempts, request a new code."), 429

    if not hmac.compare_digest(auth_code.code_hash, _hash_code(email, code)):
        db.update(AUTH_CODES, auth_code.id, {"attempts": auth_code.attempts + 1})
        return jsonify(error="Invalid code."), 401

    db.delete(AUTH_CODES, auth_code.id)
    return None


def _erase_player(db: Any, session_id: str) -> None:
    """The game, its turns and collection, then the account and the login
    codes of its e-mail.
    """
    email = service.erase_game(db, session_id)
    for collection in (USERS, AUTH_CODES):
        for doc in db.find(collection, {"email": email}, limit=100):
            db.delete(collection, doc["id"])


def _purge_old_data(db: Any) -> None:
    """Retention (GDPR): erases the players inactive for 6 months and the
    expired login codes.

    Run on every login: no scheduled job needed, and it never blocks the login.
    """
    try:
        for session_id in service.inactive_session_ids(db):
            _erase_player(db, session_id)
        now = utcnow()
        for doc in db.find(AUTH_CODES, {}, limit=500):
            if AuthCode.from_document(doc).expires_at < now:
                db.delete(AUTH_CODES, doc["id"])
    except Exception as e:  # noqa: BLE001 - the purge must never block a login
        log.error("Purge of old data failed: %s", e)


class Router:
    @staticmethod
    @route("auth/code", "POST")
    def auth_code() -> Any:
        """Step 1: send a random 6-digit code by email.

        Body: {"email": "..."}
        - 204: code sent
        - 400: invalid payload
        - 429: a code was sent less than 60s ago
        - 502: the email provider failed
        """
        payload = _parse(CodeRequest)
        if isinstance(payload, tuple):
            return payload

        db = _db()
        now = utcnow()

        previous = [
            AuthCode.from_document(d)
            for d in db.find(AUTH_CODES, {"email": payload.email})
        ]
        if any(now - c.created_at < RESEND_COOLDOWN for c in previous):
            return jsonify(
                error="Please wait before requesting a new code."
            ), 429
        for old in previous:
            db.delete(AUTH_CODES, old.id)

        code = f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"
        code = _hash_code(payload.email, code)
        code_id = db.insert(
            AUTH_CODES,
            AuthCode(
                email=payload.email,
                code_hash=code,
                expires_at=now + CODE_TTL,
            ).to_document(),
        )

        try:
            send_auth_code(
                payload.email, code, int(CODE_TTL.total_seconds() // 60)
            )
        except MailError:
            db.delete(AUTH_CODES, code_id)
            return jsonify(
                error="Could not send the email, please try again later."
            ), 502
        return "", 204

    @staticmethod
    @route("sessions", "POST")
    def create_session() -> Any:
        """Step 2: check the code, then log in or create the user, and find or
        start their game.

        Body: {"email": "...", "code": "123456"} (no code in local development,
        see _skip_code)
        - 200: {"sessionId", "isNew", "state"}, the game of this e-mail
        - 400: invalid payload / no valid code
        - 401: wrong code
        - 429: too many attempts (the code is invalidated)
        """
        payload = _parse(CodeRequest if _skip_code() else VerifyRequest)
        if isinstance(payload, tuple):
            return payload
        if isinstance(payload, VerifyRequest):
            error = _check_code(payload.email, payload.code)
            if error is not None:
                return error

        db = _db()
        # Before finding this player: back after 6 months = from nothing
        _purge_old_data(db)
        if not db.find(USERS, {"email": payload.email}, limit=1):
            db.insert(USERS, User(email=payload.email).to_document())

        return _respond(lambda: service.create_session(db, payload.email))

    @staticmethod
    @route("sessions/<session_id>", "GET")
    def get_session(session_id: str) -> Any:
        return _respond(lambda: service.get_session(_db(), session_id))

    @staticmethod
    @route("sessions/<session_id>", "DELETE")
    def erase_data(session_id: str) -> Any:
        """Effacer toutes mes données: the game, the conversation, the
        collection, the account and its codes.
        """
        db = _db()

        def erase() -> dict[str, Any]:
            _erase_player(db, session_id)
            return {}

        return _respond(erase)

    @staticmethod
    @route("sessions/<session_id>/draws", "POST")
    def draw_cards(session_id: str) -> Any:
        return _respond(lambda: service.draw_cards(_db(), session_id))

    @staticmethod
    @route("sessions/<session_id>/turns", "POST")
    def start_turn(session_id: str) -> Any:
        return _respond(
            lambda: service.start_turn(
                _db(), session_id, str(_body().get("cardId", ""))
            )
        )

    @staticmethod
    @route("sessions/<session_id>/turns/<turn_id>/messages", "POST")
    def send_message(session_id: str, turn_id: str) -> Any:
        body = _body()
        ids = body.get("selectedEntryIds")
        return _respond(
            lambda: service.send_message(
                _db(),
                session_id,
                turn_id,
                str(body.get("text", "")),
                ids if isinstance(ids, list) else None,
            )
        )

    @staticmethod
    @route("sessions/<session_id>/turns/<turn_id>/skip", "POST")
    def skip_turn(session_id: str, turn_id: str) -> Any:
        return _respond(lambda: service.skip_turn(_db(), session_id, turn_id))

    @staticmethod
    @route("sessions/<session_id>/speech", "POST")
    def speech(session_id: str) -> Any:
        """The AI's words read aloud (mp3). Errors come back as JSON, like the
        other routes.
        """
        body = _body()
        return _respond(
            lambda: service.speech(
                _db(),
                session_id,
                str(body.get("text", "")),
                str(body.get("tone", "")),
            )
        )

    @staticmethod
    @route("sessions/<session_id>/transcriptions", "POST")
    def transcribe(session_id: str) -> Any:
        """The young person's spoken answer (multipart field "audio") turned
        into text.
        """
        file = request.files.get("audio")
        if file is None:
            return jsonify(error="audio is required"), 400
        return _respond(
            lambda: service.transcribe(
                _db(), session_id, file.read(), file.filename or ""
            )
        )

    @staticmethod
    @route("sessions/<session_id>/finish", "POST")
    def finish_game(session_id: str) -> Any:
        turn_id = _body().get("turnId")
        return _respond(
            lambda: service.finish_game(
                _db(), session_id, str(turn_id) if turn_id else None
            )
        )

    @staticmethod
    @route("sessions/<session_id>/collection", "GET")
    def get_collection(session_id: str) -> Any:
        return _respond(lambda: service.get_collection(_db(), session_id))

    @staticmethod
    @route("sessions/<session_id>/collection/<entry_id>", "PATCH")
    def update_entry(session_id: str, entry_id: str) -> Any:
        return _respond(
            lambda: service.update_entry(
                _db(), session_id, entry_id, str(_body().get("status", ""))
            )
        )

    @staticmethod
    @route("sessions/<session_id>/collection/<entry_id>", "DELETE")
    def delete_entry(session_id: str, entry_id: str) -> Any:
        return _respond(
            lambda: service.delete_entry(_db(), session_id, entry_id)
        )

    @staticmethod
    @route("sessions/<session_id>/summary", "GET")
    def get_summary(session_id: str) -> Any:
        return _respond(lambda: service.get_summary(_db(), session_id))

    @staticmethod
    @route("sessions/<session_id>/summary/suggestions", "POST")
    def suggest_with_mentions(session_id: str) -> Any:
        mentions = _body().get("mentions")
        return _respond(
            lambda: service.suggestions_with_mentions(
                _db(),
                session_id,
                mentions if isinstance(mentions, list) else [],
            )
        )

    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, Any, METHOD_NAME]]:
        for name, member in inspect.getmembers(cls):
            if not isinstance(
                inspect.getattr_static(cls, name), staticmethod
            ) or name.startswith("__"):
                continue
            path, method_type = routes.get(name, (None, "GET"))
            if path is None:
                raise RouterException(
                    f"Route for method '{name}' is not defined."
                )
            yield path, member, cast(METHOD_NAME, method_type)
