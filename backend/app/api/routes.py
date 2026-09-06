"""API routes. Everything lives under the ``/api`` prefix so the frontend can own
every other path."""

import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat_schema import ChatRequest
from app.config import settings
from app.db import get_session
from app.llm import ChatMessage, LLMError, LLMUnavailable, extract_json, stream_reply
from app.models import AppMeta
from app.prompts import (
    fill_chat_prompt,
    fill_extract_prompt,
    triage_chat_prompt,
    triage_extract_prompt,
)

router = APIRouter(prefix="/api")

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/health")
def health(session: SessionDep) -> dict[str, str]:
    """Liveness + database round-trip check."""
    row = session.execute(
        select(AppMeta).where(AppMeta.key == "initialized_at")
    ).scalar_one_or_none()
    return {
        "status": "ok",
        "database": "ok" if row is not None else "empty",
        "initialized_at": row.value if row is not None else "",
    }


# --- Document AI chat --------------------------------------------------------


@router.get("/chat")
def chat_status() -> dict[str, bool]:
    """Whether the chat can run (i.e. an OpenRouter key is configured)."""
    return {"enabled": bool(settings.openrouter_api_key.strip())}


@router.post("/chat")
async def chat(body: ChatRequest) -> StreamingResponse:
    """Stream the assistant reply, then a single ``result`` event.

    Triage mode (no ``document``): the ``result`` carries the chosen slug.
    Fill mode (``document`` set): the ``result`` carries the extracted fields.
    """
    conversation: list[ChatMessage] = [m.model_dump() for m in body.messages]
    return StreamingResponse(
        _chat_events(body, conversation),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


_EMPTY_RESULT = {
    "reply": "",
    "fields": {},
    "missingFields": [],
    "readyToGenerate": False,
    "degraded": False,
    "document": None,
    "suggestion": None,
}


async def _chat_events(
    body: ChatRequest, conversation: list[ChatMessage]
) -> AsyncIterator[str]:
    if body.document is None:
        chat_prompt = triage_chat_prompt(body.catalog)
        extract_prompt = triage_extract_prompt(body.catalog)
    else:
        chat_prompt = fill_chat_prompt(body.document)
        extract_prompt = fill_extract_prompt(body.document)

    reply_parts: list[str] = []
    try:
        async for delta in stream_reply(chat_prompt, conversation):
            reply_parts.append(delta)
            yield _sse("token", {"text": delta})
    except LLMUnavailable:
        yield _sse("error", {"code": "unavailable", "message": _UNAVAILABLE_MSG})
        return
    except LLMError:
        yield _sse("error", {"code": "provider", "message": _PROVIDER_MSG})
        return

    reply = "".join(reply_parts)
    turns = [*conversation, {"role": "assistant", "content": reply}]

    result = {**_EMPTY_RESULT, "reply": reply}
    try:
        extracted = await extract_json(extract_prompt, turns)
    except LLMUnavailable:
        yield _sse("error", {"code": "unavailable", "message": _UNAVAILABLE_MSG})
        return
    except LLMError:
        result["degraded"] = True
        if body.document is not None:
            result["fields"] = dict(body.fields)
            result["missingFields"] = _missing(body, body.fields)
        yield _sse("result", result)
        return

    if body.document is None:
        doc = extracted.get("document")
        result["document"] = doc if isinstance(doc, str) else None
        sug = extracted.get("suggestion")
        result["suggestion"] = sug if isinstance(sug, str) else None
    else:
        merged = dict(body.fields)
        # Field values: either a "fields" object, or (leniently) the whole object.
        flat = extracted.get("fields")
        if not isinstance(flat, dict):
            flat = extracted
        for key, value in flat.items():
            if isinstance(value, str) and value.strip():
                merged[key] = value.strip()
        # Party details: a nested "parties" object -> "<key>.<attr>".
        parties = extracted.get("parties")
        if isinstance(parties, dict):
            for pkey, attrs in parties.items():
                if isinstance(attrs, dict):
                    for attr, value in attrs.items():
                        if isinstance(value, str) and value.strip():
                            merged[f"{pkey}.{attr}"] = value.strip()
        missing = _missing(body, merged)
        result["fields"] = merged
        result["missingFields"] = missing
        result["readyToGenerate"] = bool(extracted.get("ready")) and not missing

    yield _sse("result", result)


def _missing(body: ChatRequest, values: dict[str, str]) -> list[str]:
    if body.document is None:
        return []
    names = [f.name for f in body.document.fields]
    names += [
        f"{p.key}.{attr}"
        for p in body.document.parties
        for attr in ("signatory", "entity", "noticeAddress")
    ]
    return [n for n in names if not values.get(n, "").strip()]


_UNAVAILABLE_MSG = (
    "AI chat isn't configured on this server. Add an OpenRouter API key to use it."
)
_PROVIDER_MSG = (
    "The AI service is unavailable right now. Try again in a moment."
)


@router.api_route(
    "/{_rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def api_not_found(_rest: str) -> None:
    """Keep every unmatched ``/api/*`` path as a JSON 404 instead of letting it
    fall through to the static-file mount."""
    raise HTTPException(status_code=404, detail="Not Found")
