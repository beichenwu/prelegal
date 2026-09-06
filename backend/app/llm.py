"""LiteLLM wrapper for the Mutual NDA chat.

Two operations per user turn:

- ``stream_reply`` — the assistant's conversational message, streamed token by token.
- ``extract_fields`` — a separate non-streamed, JSON-only call that reads the whole
  conversation and returns the NDA fields known so far.

Both read the model and OpenRouter key from ``settings``. Callers get
``LLMUnavailable`` when no key is configured and ``LLMError`` when the provider
fails or returns unusable output.
"""

import json
import logging
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from typing import Any

import litellm
from pydantic import ValidationError

from app.config import settings
from app.nda_schema import NdaFields, missing_required

logger = logging.getLogger("prelegal.llm")

litellm.telemetry = False
litellm.drop_params = True  # ignore params a given free model doesn't support

ChatMessage = dict[str, str]


class LLMUnavailable(RuntimeError):
    """No API key configured — chat cannot run."""


class LLMError(RuntimeError):
    """The provider failed or returned unusable output."""


@dataclass
class ExtractionResult:
    fields: NdaFields
    missing_fields: list[str] = field(default_factory=list)
    ready_to_generate: bool = False
    degraded: bool = False
    detail: str | None = None


CHAT_SYSTEM_PROMPT = """\
You are Prelegal's intake assistant. You help a user fill in a Common Paper \
Mutual Non-Disclosure Agreement (MNDA) through conversation.

Scope: only this one document. If asked for anything else, explain that this tool \
currently only produces the Common Paper Mutual NDA.

You need these details:
- purpose: why the parties are exchanging confidential information
- effectiveDate: when the NDA starts (a calendar date)
- MNDA term: either a number of years, or "until terminated"
- term of confidentiality: a number of years, or perpetual
- governingLaw: the US state whose law applies
- jurisdiction: the city/county and state whose courts apply
- modifications: any changes to the standard terms (usually none)
- for each of the two parties: printed name of the signatory, their title \
(optional), the company/entity name, and a notice address (email or postal)

Ask for what is still missing, a couple of items at a time, in plain language. \
Confirm values you have inferred. Do not give legal advice; you gather \
information only. When every required detail is present, do not assume you are \
finished — tell the user you have everything and ask whether they would like you \
to generate the draft now.
"""

EXTRACTION_SYSTEM_PROMPT = """\
You maintain a structured record of a Mutual NDA as the conversation unfolds.

Return ONLY a JSON object (no prose, no code fences) with exactly these keys:
purpose (string|null), effectiveDate (string|null, ISO yyyy-mm-dd),
mndaTermKind ("years"|"until_terminated"|null), mndaTermYears (integer|null),
confidentialityTermKind ("years"|"perpetuity"|null),
confidentialityTermYears (integer|null), governingLaw (string|null),
jurisdiction (string|null), modifications (string|null),
party1 (object|null), party2 (object|null).

Each party object has: name (string|null), title (string|null),
company (string|null), noticeAddress (string|null).

Rules:
- Capture every detail the user has stated, including in passing. "an NDA between
  Acme Inc and Globex LLC" sets party1.company = "Acme Inc" and
  party2.company = "Globex LLC". "to evaluate a partnership" is the purpose.
- The first company mentioned is party1, the second is party2. Keep that
  assignment stable once established.
- Carry forward every value from earlier turns; only change one if the user
  corrects it.
- Leave a value null only when the user genuinely has not given it. Do not guess.
- "no modifications", "none", or similar sets modifications = "None."
"""


def _require_key() -> str:
    key = settings.openrouter_api_key.strip()
    if not key:
        raise LLMUnavailable("No OPENROUTER_API_KEY configured")
    return key


async def stream_reply(messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
    """Yield the assistant reply as text deltas."""
    key = _require_key()
    try:
        response = await litellm.acompletion(
            model=settings.llm_model,
            api_key=key,
            messages=[{"role": "system", "content": CHAT_SYSTEM_PROMPT}, *messages],
            stream=True,
            temperature=0.3,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except LLMUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 — litellm raises many provider-specific types
        logger.warning("stream_reply failed on %s: %s", settings.llm_model, exc)
        raise LLMError(str(exc)) from exc


async def extract_fields(
    messages: Sequence[ChatMessage], current: NdaFields
) -> ExtractionResult:
    """Re-read the conversation and return the NDA fields known so far.

    Retries once if the model returns something that will not parse/validate;
    on a second failure, keeps ``current`` rather than losing progress.
    """
    key = _require_key()
    prompt_messages: list[ChatMessage] = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        *messages,
        {
            "role": "user",
            "content": (
                "Fields established so far (JSON):\n"
                f"{current.model_dump_json(exclude_none=True)}\n\n"
                "Return the complete updated JSON object now."
            ),
        },
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
            fields = NdaFields.model_validate(_loads_object(content))
            missing = missing_required(fields)
            return ExtractionResult(
                fields=fields,
                missing_fields=missing,
                ready_to_generate=not missing,
            )
        except LLMUnavailable:
            raise
        except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as exc:
            last_error = exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("extract_fields failed on %s: %s", settings.llm_model, exc)
            raise LLMError(str(exc)) from exc

    if last_error is not None:
        logger.info("extract_fields fell back after unparseable output: %s", last_error)

    # Both attempts produced unusable output — don't lose what we already had.
    return ExtractionResult(
        fields=current,
        missing_fields=missing_required(current),
        degraded=True,
        detail=str(last_error) if last_error else None,
    )


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
