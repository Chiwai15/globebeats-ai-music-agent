from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    lastfm_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_provider: str = "openai"  # Primary provider: "openai" or "anthropic"
    llm_model: str = "gpt-4-turbo-preview"  # Legacy single model config
    openai_model: str = "gpt-4-turbo-preview"
    anthropic_model: str = "claude-sonnet-4-5-20250929"
    llm_fallback_enabled: bool = True
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    update_interval: int = 300

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
