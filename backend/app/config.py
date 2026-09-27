import os
from dotenv import load_dotenv

# Load .env file
# We check both the current directory and the parent directory of backend/
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

class Settings:
    # Database URL configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./threats.db")
    
    # Standardize connection string for SQLAlchemy
    # Supabase/Neon sometimes provides postgres:// which SQLAlchemy 1.4+ does not support natively
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

settings = Settings()
