from datetime import timedelta
from typing import Literal, Tuple, Iterator, Dict, Callable, Any
from pydantic import BaseModel, ValidationError
from flask import current_app, jsonify, request
from controllers.mailer import send_auth_code
from models.models import AuthCode, CodeRequest, PublicUser, User, VerifyRequest, utcnow

import inspect
import hashlib
import hmac
import inspect
import os
import secrets


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}


USERS = "users"
AUTH_CODES = "auth_codes"

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5
CODE_LENGTH = 8


def route(path: str, type: METHOD_NAME = "GET") -> Callable[[Callable[[], str]], Callable[[], str]]:
    def wrapper(func: Callable[[], str]) -> Callable[[], str]:
        routes[func.__name__] = (path, type)
        return func
    return wrapper


class RouterException(Exception):
    pass


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


    @classmethod
    def __iter__(cls) -> Iterator[Tuple[str, Any, str]]:
        for name, member in inspect.getmembers(cls):
            if not isinstance(inspect.getattr_static(cls, name), staticmethod) or name.startswith("__"):
                continue
            path, method_type = routes.get(name, (None, "GET"))
            if path is None:
                raise RouterException(f"Route for method '{name}' is not defined.")
            yield path, member, method_type
