from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Database configuration
db_url = settings.DATABASE_URL
is_sqlite = db_url.startswith("sqlite")

# SQLite requires different connection parameters for multithreading
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True  # Important to keep connections alive and handle drops on Neon/Supabase
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency injection to provide database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
