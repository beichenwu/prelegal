"""Database models.

Only a bootstrap marker for now. Real domain tables (documents, and later users)
arrive with the features that need them.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppMeta(Base):
    """Key/value rows written at startup. Proves the database is writable and
    readable end to end via ``GET /api/health``."""

    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
