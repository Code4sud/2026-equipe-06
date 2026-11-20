"""Thin layer over the Mistral SDK: one place to call the model, parse JSON and
handle errors.
"""

import json
import logging
import re
from functools import lru_cache
from typing import Any

# mypy cannot see the package types (it has no top-level __init__.py), hence
# the ignore
from mistralai.client import Mistral  # type: ignore[import-not-found]

from .config import get_config

log = logging.getLogger(__name__)

Messages = list[dict[str, str]]


class LLMError(Exception):
    """The model could not be reached or did not answer in the expected shape.
    """


@lru_cache(maxsize=1)
def client() -> Mistral:
    return Mistral(api_key=get_config().api_key)


def _content_to_text(content: Any) -> str:
    # The answer is a plain string, or a list of chunks. Only text chunks
    # count:
    # reasoning models also send "thinking" chunks, which are not the answer.
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(getattr(chunk, "text", "") or "" for chunk in content)
    return ""


def complete(
    *,
    model: str,
    system: str,
    messages: Messages,
    temperature: float,
    max_tokens: int,
    json_mode: bool = False,
    timeout_ms: int = 30_000,
) -> str:
    """One call to the chat model. Returns the text of the answer."""
    # Plain dicts are what the API takes; the SDK's own message types are not
    # needed here
    chat: list[Any] = [{"role": "system", "content": system}, *messages]
    try:
        if json_mode:
            result = client().chat.complete(
                model=model,
                messages=chat,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout_ms=timeout_ms,
                response_format={"type": "json_object"},
            )
        else:
            result = client().chat.complete(
                model=model,
                messages=chat,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout_ms=timeout_ms,
            )
    # the SDK raises several kinds of errors (network, API, validation)
    except Exception as exc:
        raise LLMError(f"Mistral call failed: {exc}") from exc

    if not result.choices:
        raise LLMError("Mistral returned no answer.")
    choice = result.choices[0]
    text = _content_to_text(
        choice.message.content if choice.message else None
    ).strip()
    if not text:
        # Typically a reasoning model that used all its tokens thinking:
        # retrying would not help
        raise LLMError(
            f"Empty answer from {model} "
            f"(finish_reason={choice.finish_reason}). "
            "If it is a reasoning model, use a non-reasoning one."
        )
    return text


def _parse_json(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Sometimes the model adds text around the object: take the outermost
        # {...}
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("expected a JSON object")
    return data


def complete_json(
    *,
    model: str,
    system: str,
    messages: Messages,
    temperature: float,
    max_tokens: int,
    timeout_ms: int = 30_000,
) -> dict[str, Any]:
    """Like `complete`, but the answer is a JSON object. One retry if it cannot
    be parsed.
    """
    last_error: Exception | None = None
    for attempt in (1, 2):
        text = complete(
            model=model,
            system=system,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
            timeout_ms=timeout_ms,
        )
        try:
            return _parse_json(text)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            log.warning(
                "Invalid JSON from the model (attempt %s): %s",
                attempt,
                text[:200],
            )
    raise LLMError(f"The model did not return valid JSON: {last_error}")
