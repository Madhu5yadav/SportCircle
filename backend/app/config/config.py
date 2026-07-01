import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SportCircle"
    PROJECT_VERSION: str = "1.0.0"
    
    # MySQL Database Settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:@localhost:3306/sportcircle"
    )
    
    # JWT Authentication Settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super_secret_sportcircle_jwt_key_2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Socket.IO configuration
    SOCKET_CORS_ALLOWED_ORIGINS: str = "*"

    class Config:
        env_file = ".env"

settings = Settings()
