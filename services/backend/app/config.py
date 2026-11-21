from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = (
        "postgresql+psycopg://tripadapt:tripadapt@127.0.0.1:5432/tripadapt"
    )
    planning_fixtures_enabled: bool = False
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "openai/gpt-oss-120b"
    planning_ai_enabled: bool = False
    planning_worker_embedded: bool = False
    geoapify_api_key: SecretStr = SecretStr("")
    activity_places_provider: Literal["auto", "overpass", "geoapify"] = "auto"
    activity_search_enabled: bool = False
    place_search_enabled: bool = False
    supabase_url: str = ""
    auth_audience: str = "authenticated"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # A deleted trip is hidden at once and permanently erased after this many days. At least one, so a typo can never mean "now".
    trip_retention_days: int = Field(default=30, ge=1, le=3650)
    trip_purge_enabled: bool = True
    trip_purge_interval_minutes: int = Field(default=360, ge=1)
    trip_purge_batch: int = Field(default=25, ge=1, le=500)


settings = Settings()
