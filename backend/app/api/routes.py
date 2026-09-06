"""API routes. Everything lives under the ``/api`` prefix so the frontend can own
every other path."""

import json
from collections.abc import AsyncIterator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.llm import (
    ChatMessage,
    ExtractionResult,
    LLMError,
    LLMUnavailable,
    extract_fields,
    stream_reply,
)
from app.models import AppMeta
from app.nda_schema import NdaFields, missing_required

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


# --- Mutual NDA AI chat --------------------------------------------------------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class NdaChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1, max_length=40)
    fields: NdaFields = NdaFields()


@router.get("/nda/chat")
def nda_chat_status() -> dict[str, bool]:
    """Whether the chat can run (i.e. an OpenRouter key is configured)."""
    return {"enabled": bool(settings.openrouter_api_key.strip())}


@router.post("/nda/chat")
async def nda_chat(body: NdaChatRequest) -> StreamingResponse:
    """Stream the assistant reply, then a single ``result`` event carrying the
    NDA fields extracted from the conversation so far."""
    conversation: list[ChatMessage] = [m.model_dump() for m in body.messages]
    return StreamingResponse(
        _chat_events(conversation, body.fields),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _chat_events(
    conversation: list[ChatMessage], current: NdaFields
) -> AsyncIterator[str]:
    reply_parts: list[str] = []
    try:
        async for delta in stream_reply(conversation):
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

    try:
        result = await extract_fields(turns, current)
    except LLMUnavailable:
        yield _sse("error", {"code": "unavailable", "message": _UNAVAILABLE_MSG})
        return
    except LLMError:
        # The reply is fine; only extraction failed. Keep the known fields.
        result = ExtractionResult(
            fields=current, missing_fields=missing_required(current), degraded=True
        )

    yield _sse(
        "result",
        {
            "reply": reply,
            "fields": result.fields.model_dump(),
            "missingFields": result.missing_fields,
            "readyToGenerate": result.ready_to_generate,
            "degraded": result.degraded,
        },
    )


_UNAVAILABLE_MSG = (
    "AI chat isn't configured on this server. Switch to the guided form to continue."
)
_PROVIDER_MSG = (
    "The AI service is unavailable right now. Try again in a moment, "
    "or switch to the guided form."
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
