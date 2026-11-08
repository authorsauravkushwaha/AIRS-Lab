"""Application configuration loaded from environment variables.

Secrets (e.g. provider API keys) are referenced by environment-variable NAME
only; raw values are never stored in the database or returned by the API.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]

EVALUATOR_VERSION = "2.0.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AEGIS_", env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str = "sqlite:///./aegis.db"
    openai_api_key: str | None = None          # server-side only
    anthropic_api_key: str | None = None       # server-side only
    ollama_base_url: str = "http://localhost:11434"
    secret_redaction_enabled: bool = True
    default_concurrency: int = 4


settings = Settings()
