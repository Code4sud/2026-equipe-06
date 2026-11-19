from typing import Literal, Tuple, Iterator, Dict, Callable, Any
import inspect
import logging

from flask import current_app, jsonify, request

from ai import AIConfigError, LLMError
from game import service
from game.store import GameError


type METHOD_NAME = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


routes: Dict[str, Tuple[str, METHOD_NAME]] = {}

log = logging.getLogger(__name__)


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


class Router:

    @staticmethod
    @route("auth/code", "POST")
    def auth_code() -> Any:
        # No e-mail is sent yet and any code is accepted: the front only needs a 204
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
