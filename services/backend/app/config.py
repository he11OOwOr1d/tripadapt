from typing import Literal

from pydantic import SecretStr
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
    google_maps_api_key: SecretStr = SecretStr("")
    routes_api_key: SecretStr = SecretStr("")
    geoapify_api_key: SecretStr = SecretStr("")
    activity_places_provider: Literal["auto", "overpass", "geoapify"] = "auto"
    activity_search_enabled: bool = False
    place_search_enabled: bool = False
    supabase_url: str = ""
    auth_audience: str = "authenticated"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


settings = Settings()
