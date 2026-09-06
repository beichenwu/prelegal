"""Application entrypoint.

Wiring order matters: the API routers are registered first, then the static
frontend is mounted at ``/`` as the catch-all. On startup the database is
created (existing data kept) and stamped with a ``last_started_at`` marker.
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.routes import router as api_router
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import AppMeta


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as session:
        session.merge(AppMeta(key="last_started_at", value=datetime.now(UTC).isoformat()))
        session.merge(AppMeta(key="initialized_at", value=datetime.now(UTC).isoformat()))
        session.commit()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal API", version="0.1.0", lifespan=lifespan)

    # In production the frontend is same-origin; in `next dev` it runs on :3000
    # and calls the API cross-origin. These extra origins are inert in prod.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(api_router)  # health, chat, and the /api/* catch-all (last)

    dist = settings.frontend_dist
    if dist.is_dir():
        # `html=True` serves index.html for directory paths and the exported
        # 404.html for anything else. Unmatched /api/* never reaches here — the
        # router's catch-all keeps those as JSON.
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")

    return app


app = create_app()
