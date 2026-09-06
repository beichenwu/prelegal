"""API routes. Everything lives under the ``/api`` prefix so the frontend can own
every other path."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import AppMeta

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


@router.api_route(
    "/{_rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def api_not_found(_rest: str) -> None:
    """Keep every unmatched ``/api/*`` path as a JSON 404 instead of letting it
    fall through to the static-file mount."""
    raise HTTPException(status_code=404, detail="Not Found")
