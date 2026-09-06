"""Runtime configuration.

Every setting has a working default so the app runs with no environment set up.
Override any of them with a ``PRELEGAL_``-prefixed environment variable, e.g.
``PRELEGAL_FRONTEND_DIST=/app/frontend/out`` (as the Docker image does).
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .../backend
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PRELEGAL_", extra="ignore")

    # Throwaway SQLite file next to the backend; dropped and recreated on startup.
    database_url: str = f"sqlite:///{_BACKEND_DIR / 'prelegal.db'}"

    # Static export produced by `npm run build` in ../frontend.
    frontend_dist: Path = _BACKEND_DIR.parent / "frontend" / "out"


settings = Settings()
