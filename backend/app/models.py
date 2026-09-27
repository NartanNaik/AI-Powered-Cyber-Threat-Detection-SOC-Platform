from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean
from .database import Base

class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    source_ip = Column(String(50), nullable=False)
    destination_ip = Column(String(50), nullable=False)
    attack_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="open", index=True)  # open, investigating, resolved
    is_blocked = Column(Boolean, nullable=False, default=False)
    
    # GeoIP attributes for Global Threat Map (Specification module 3)
    geo_country = Column(String(50), nullable=True)
    geo_city = Column(String(50), nullable=True)
    geo_lat = Column(Float, nullable=True)
    geo_lon = Column(Float, nullable=True)
    
    # MITRE ATT&CK mapping (Specification module 11)
    mitre_id = Column(String(20), nullable=True)

    ai_explanation = Column(Text, nullable=True)
    
    # Store CIC-IDS network flow features as JSON object
    features = Column(JSON, nullable=True)

