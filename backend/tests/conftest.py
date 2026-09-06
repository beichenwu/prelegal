"""Test fixtures.

The environment is pointed at a throwaway SQLite file and a minimal fake static
export *before* any application module is imported, so importing ``app`` here is
safe and hermetic.
"""

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="prelegal-test-"))

os.environ.setdefault("PRELEGAL_DATABASE_URL", f"sqlite:///{_TMP / 'test.db'}")

_DIST = _TMP / "dist"
(_DIST / "tools" / "mutual-nda").mkdir(parents=True, exist_ok=True)
(_DIST / "index.html").write_text(
    "<!doctype html><title>Prelegal</title><h1>Prelegal</h1>", encoding="utf-8"
)
(_DIST / "404.html").write_text(
    "<!doctype html><title>Not found</title><p>404 — page not found</p>", encoding="utf-8"
)
(_DIST / "tools" / "mutual-nda" / "index.html").write_text(
    "<!doctype html><title>Mutual NDA</title>", encoding="utf-8"
)
os.environ.setdefault("PRELEGAL_FRONTEND_DIST", str(_DIST))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    # The context manager runs the lifespan: init_db() + the initialized_at stamp.
    with TestClient(app) as test_client:
        yield test_client
