"""Database engine, session factory, and startup bootstrap.

There are no migrations. ``init_db()`` drops and recreates every table, so each
process — and each fresh Docker container — starts from a known-empty schema.
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


def init_db() -> None:
    """Drop and recreate all tables from scratch."""
    from app import models  # noqa: F401  — registers models on Base.metadata

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: a request-scoped session that always closes."""
    with SessionLocal() as session:
        yield session
