from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

# Core Threat schemas
class ThreatBase(BaseModel):
    timestamp: datetime
    source_ip: str
    destination_ip: str
    attack_type: str
    severity: str
    confidence: float
    status: str
    is_blocked: bool = False
    geo_country: Optional[str] = None
    geo_city: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lon: Optional[float] = None
    mitre_id: Optional[str] = None
    ai_explanation: Optional[str] = None
    features: Optional[Dict[str, Any]] = None

class ThreatCreate(ThreatBase):
    pass

class ThreatUpdate(BaseModel):
    status: Optional[str] = None
    is_blocked: Optional[bool] = None
    ai_explanation: Optional[str] = None

class ThreatResponse(ThreatBase):
    id: int

    class Config:
        from_attributes = True

class PaginatedThreatResponse(BaseModel):
    items: List[ThreatResponse]
    total: int
    page: int
    pages: int
    limit: int

# Summary schemas
class ThreatSummary(BaseModel):
    total: int
    critical: int
    high: int
    medium: int
    low: int
    blocked: int = 0

# Model metrics schema
class ModelMetricsResponse(BaseModel):
    model_family: str
    accuracy: float
    macro_f1: float
    precision: float
    recall: float
    last_trained: str
    total_samples: int
    benchmark_comparison: Optional[List[Dict[str, Any]]] = None
    class_metrics: List[Dict[str, Any]]
    confusion_matrix: Dict[str, Any]
    top_features: Optional[List[Dict[str, Any]]] = None


# Trend schemas
class ThreatTrendItem(BaseModel):
    time: str
    count: int
    critical: int
    high: int
    medium: int
    low: int

# Distribution schemas
class ThreatDistributionItem(BaseModel):
    attack_type: str
    count: int
