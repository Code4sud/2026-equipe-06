from typing import Literal, Tuple, Iterator, Dict, Callable, Any
from datetime import timedelta
import hashlib
import hmac
import inspect
import os
import secrets

from flask import current_app, jsonify, request
from pydantic import BaseModel, ValidationError

from controllers.mailer import MailError, send_auth_code
from models.models import AuthCode, CodeRequest, PublicUser, User, VerifyRequest, utcnow


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}

USERS = "users"
AUTH_CODES = "auth_codes"

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5
CODE_LENGTH = 6


def route(path: str, type: METHOD_NAME = "GET") -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def wrapper(func: Callable[..., Any]) -> Callable[..., Any]:
        routes[func.__name__] = (path, type)
        return func
    return wrapper


class RouterException(Exception):
    pass


def _hash_code(email: str, code: str) -> str:
    secret = os.environ["AUTH_CODE_SECRET"].encode()
    return hmac.new(secret, f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _parse[M: BaseModel](model: type[M]) -> M | tuple[Any, int]:
    """Validate the JSON body. Returns the model, or a (response, status) on error."""
    try:
        return model.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify(error=e.errors(include_url=False, include_context=False, include_input=False)), 400


class Router:

    @staticmethod
    @route("/auth/code", "POST")
    def auth_code() -> Any:
        """Step 1: send a random 8-digit code by email.

        Body: {"email": "..."}
        - 204: code sent
        - 400: invalid payload
        - 429: a code was sent less than 60s ago
        - 502: the email provider failed
        """
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
        code_id = db.insert(AUTH_CODES, AuthCode(
            email=payload.email,
            code_hash=_hash_code(payload.email, code),
            expires_at=now + CODE_TTL,
        ).to_document())

        try:
            send_auth_code(payload.email, code, int(CODE_TTL.total_seconds() // 60))
        except MailError:
            db.delete(AUTH_CODES, code_id)
            return jsonify(error="Could not send the email, please try again later."), 502
        return "", 204


    @staticmethod
    @route("/auth/verify", "POST")
    def auth_verify() -> Any:
        """Step 2: check the code, then log in or create the user.

        Body: {"email": "...", "code": "12345678"}
        - 201: user created, 200: user logged in
        - 400: invalid payload / no valid code
        - 401: wrong code
        - 429: too many attempts (the code is invalidated)
        """
        payload = _parse(VerifyRequest)
        if isinstance(payload, tuple):
            return payload

        db = current_app.extensions["db"]
        docs = db.find(AUTH_CODES, {"email": payload.email}, limit=1)
        if not docs:
            return jsonify(error="No code requested for this email."), 400

        auth_code = AuthCode.from_document(docs[0])

        if auth_code.expires_at < utcnow():
            db.delete(AUTH_CODES, auth_code.id)
            return jsonify(error="Code expired."), 400

        if auth_code.attempts >= MAX_ATTEMPTS:
            db.delete(AUTH_CODES, auth_code.id)
            return jsonify(error="Too many attempts, request a new code."), 429

        if not hmac.compare_digest(auth_code.code_hash, _hash_code(payload.email, payload.code)):
            db.update(AUTH_CODES, auth_code.id, {"attempts": auth_code.attempts + 1})
            return jsonify(error="Invalid code."), 401

        db.delete(AUTH_CODES, auth_code.id)

        found = db.find(USERS, {"email": payload.email}, limit=1)
        if found:
            user = User.from_document(found[0])
            status = 200
        else:
            user = User(email=payload.email)
            user.id = db.insert(USERS, user.to_document())
            status = 201

        return jsonify(user=PublicUser(id=user.id, email=user.email).model_dump()), status


    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, Any, str]]:
        for name, member in inspect.getmembers(cls):
            if not isinstance(inspect.getattr_static(cls, name), staticmethod) or name.startswith("__"):
                continue
            path, method_type = routes.get(name, (None, "GET"))
            if path is None:
                raise RouterException(f"Route for method '{name}' is not defined.")
            yield path, member, method_type
