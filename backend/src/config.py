import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Settings
    DEBUG: bool = True

    # Database Settings
    POSTGRES_USER: str = "floodshield_user"
    POSTGRES_PASSWORD: str = "floodshield_pass"
    POSTGRES_DB: str = "floodshield_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5434

    # AI Settings
    OPENAI_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = "gpt-3.5-turbo"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# Geospatial Configurations for Bhuragaon, Assam
BHURAGAON_BOUNDS = {
    "min_lat": 26.21,
    "max_lat": 26.31,
    "min_lon": 92.15,
    "max_lon": 92.30
}
EPSG_WGS84 = 4326
EPSG_UTM46N = 32646  # UTM Zone 46N for Assam
