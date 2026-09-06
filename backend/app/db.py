"""Database engine, session factory, and startup bootstrap.

There are no migrations. ``init_db()`` creates any missing tables and leaves
existing data alone, so a mounted SQLite file (the Docker volume) persists
across restarts. ``reset_db()`` drops everything — for tests only.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _load_models() -> None:
    from app import models  # noqa: F401  — registers models on Base.metadata


def init_db() -> None:
    """Create any missing tables. Existing data is kept."""
    _load_models()
    Base.metadata.create_all(bind=engine)


def reset_db() -> None:
    """Drop and recreate every table. Tests only."""
    _load_models()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: a request-scoped session that always closes."""
    with SessionLocal() as session:
        yield session
