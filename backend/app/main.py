"""Application entrypoint.

Wiring order matters: the ``/api`` router is registered first, then the static
frontend is mounted at ``/`` as the catch-all. On startup the database is
recreated and stamped with an ``initialized_at`` marker.
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import AppMeta


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as session:
        session.add(AppMeta(key="initialized_at", value=datetime.now(UTC).isoformat()))
        session.commit()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal API", version="0.1.0", lifespan=lifespan)
    app.include_router(api_router)

    dist = settings.frontend_dist
    if dist.is_dir():
        # `html=True` serves index.html for directory paths and the exported
        # 404.html for anything else. Unmatched /api/* never reaches here — the
        # router's catch-all keeps those as JSON.
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")

    return app


app = create_app()
