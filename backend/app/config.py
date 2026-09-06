"""Runtime configuration.

Every setting has a working default so the app runs with no environment set up.
Override any of them with a ``PRELEGAL_``-prefixed environment variable, e.g.
``PRELEGAL_FRONTEND_DIST=/app/frontend/out`` (as the Docker image does).

The repo-root ``.env`` is loaded when present, so local development picks up
``OPENROUTER_API_KEY`` without exporting it by hand.
"""

from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# .../backend
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PRELEGAL_",
        env_file=_BACKEND_DIR.parent / ".env",
        extra="ignore",
    )

    # Throwaway SQLite file next to the backend; dropped and recreated on startup.
    database_url: str = f"sqlite:///{_BACKEND_DIR / 'prelegal.db'}"

    # Static export produced by `npm run build` in ../frontend.
    frontend_dist: Path = _BACKEND_DIR.parent / "frontend" / "out"

    # Mutual NDA AI chat. Empty key => chat endpoint reports itself unavailable.
    openrouter_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "PRELEGAL_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"
        ),
    )
    # Any OpenRouter model slug (prefixed `openrouter/`). Override with
    # PRELEGAL_LLM_MODEL. The default is a currently-free instruction model that
    # supports JSON responses; swap it if OpenRouter's free tier changes.
    llm_model: str = "openrouter/nvidia/nemotron-3-super-120b-a12b:free"


settings = Settings()
