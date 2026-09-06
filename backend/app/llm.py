"""LiteLLM wrapper for the document chat.

Two operations per user turn:

- ``stream_reply`` — the assistant's conversational message, streamed token by token.
- ``extract_json`` — a separate non-streamed, JSON-only call whose system prompt
  tells the model exactly what object to return.

Both read the model and OpenRouter key from ``settings``. Callers get
``LLMUnavailable`` when no key is configured and ``LLMError`` when the provider
fails or returns unusable output.
"""

import json
import logging
from collections.abc import AsyncIterator, Sequence
from typing import Any

import litellm

from app.config import settings

logger = logging.getLogger("prelegal.llm")

litellm.telemetry = False
litellm.drop_params = True  # ignore params a given free model doesn't support

ChatMessage = dict[str, str]


class LLMUnavailable(RuntimeError):
    """No API key configured — chat cannot run."""


class LLMError(RuntimeError):
    """The provider failed or returned unusable output."""


def _require_key() -> str:
    key = settings.openrouter_api_key.strip()
    if not key:
        raise LLMUnavailable("No OPENROUTER_API_KEY configured")
    return key


async def stream_reply(
    system_prompt: str, messages: Sequence[ChatMessage]
) -> AsyncIterator[str]:
    """Yield the assistant reply as text deltas."""
    key = _require_key()
    try:
        response = await litellm.acompletion(
            model=settings.llm_model,
            api_key=key,
            messages=[{"role": "system", "content": system_prompt}, *messages],
            stream=True,
            temperature=0.3,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except LLMUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 — litellm raises many provider types
        logger.warning("stream_reply failed on %s: %s", settings.llm_model, exc)
        raise LLMError(str(exc)) from exc


async def extract_json(
    system_prompt: str, messages: Sequence[ChatMessage]
) -> dict[str, Any]:
    """Return the JSON object the system prompt asks for.

    Retries once if the model returns something unparseable; raises ``LLMError``
    if it still fails so the caller can decide how to degrade.
    """
    key = _require_key()
    prompt_messages: list[ChatMessage] = [
        {"role": "system", "content": system_prompt},
        *messages,
        {"role": "user", "content": "Return the JSON object now."},
    ]

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = await litellm.acompletion(
                model=settings.llm_model,
                api_key=key,
                messages=prompt_messages,
                stream=False,
                temperature=0,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or ""
            return _loads_object(content)
        except LLMUnavailable:
            raise
        except (json.JSONDecodeError, TypeError) as exc:
            last_error = exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("extract_json failed on %s: %s", settings.llm_model, exc)
            raise LLMError(str(exc)) from exc

    logger.info("extract_json got unparseable output twice: %s", last_error)
    raise LLMError(f"unparseable extraction output: {last_error}")


def _loads_object(content: str) -> dict[str, Any]:
    """Parse a JSON object, tolerating stray text or code fences around it."""
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```", 2)[1].removeprefix("json").strip()
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise json.JSONDecodeError("no JSON object found", content, 0)
    parsed = json.loads(content[start : end + 1])
    if not isinstance(parsed, dict):
        raise TypeError("expected a JSON object")
    return parsed
