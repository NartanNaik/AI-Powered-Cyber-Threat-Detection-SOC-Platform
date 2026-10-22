import os
import sys
import uuid
import secrets
import platform
import subprocess
import hashlib
from pydantic import BaseModel
from fastapi import (
    FastAPI, 
    Depends, 
    HTTPException, 
    Query, 
    UploadFile, 
    File, 
    Response, 
    WebSocket, 
    WebSocketDisconnect, 
    Header
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

# Google OAuth Imports
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from .database import get_db, Base, engine
from .models import Threat
from .schemas import (
    ThreatResponse, 
    PaginatedThreatResponse,
    ThreatSummary, 
    ThreatTrendItem, 
    ThreatDistributionItem,
    ThreatUpdate,
    ModelMetricsResponse
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Cyber Threat Detection Platform API",
    description="Multi-tenant SOC-style backend for monitoring and analyzing simulated network threats.",
    version="1.1.0"
)

# Global Configuration for IPS Auto-Containment
class SystemConfig:
    ips_mode_active: bool = False

# WebSocket Connection Manager for Real-Time Threat Broadcasting
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_tenant_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    api_key: Optional[str] = Query(None)
) -> str:
    """Extracts tenant API key from request header or query parameter, defaulting to 'default'."""
    return x_api_key or api_key or "default"

@app.get("/")
@app.get("/health")
def read_root():
    return {
        "status": "online",
        "service": "AI Cyber Threat Detection Platform API",
        "docs_url": "/docs"
    }

# --- AUTHENTICATION ENDPOINTS ---

class GoogleAuthRequest(BaseModel):
    token: str

@app.post("/auth/google")
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verifies Google OAuth token and provisions a unique tenant workspace."""
    try:
        # If you have a specific Google Client ID, replace None with it. 
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", None) 
        
        idinfo = id_token.verify_oauth2_token(
            request.token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")
        
        # Generate a consistent, unique API key based on the user's email
        user_hash = hashlib.sha256(email.encode()).hexdigest()[:16]
        tenant_api_key = f"soc_live_{user_hash}"
        
        # Check if they have existing threat data (to know if they are a new user)
        existing_threats = db.query(Threat).filter(Threat.api_key == tenant_api_key).first()
        is_first_login = True if not existing_threats else False

        return {
            "api_key": tenant_api_key,
            "access_token": f"jwt_session_{secrets.token_hex(12)}",
            "email": email,
            "name": name,
            "is_first_login": is_first_login
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google authentication token: {str(e)}")

# Multi-Tenant Key Generation (Manual)
@app.post("/auth/generate-key")
def generate_api_key():
    """Generates a secure, unique API key for an agent or tenant deployment."""
    new_key = f"soc_live_{secrets.token_hex(16)}"
    return {
        "api_key": new_key,
        "created_at": datetime.utcnow().isoformat(),
        "instructions": "Pass this key in the 'X-API-Key' header from your agent to segregate network traffic."
    }

# IPS Configuration Endpoints
@app.get("/config/ips")
def get_ips_status():
    """Retrieve the current operational mode of the system (IDS vs IPS)."""
    return {
        "ips_mode_active": SystemConfig.ips_mode_active,
        "mode": "IPS (Automated Containment)" if SystemConfig.ips_mode_active else "IDS (Passive Monitoring)"
    }

@app.post("/config/ips")
def toggle_ips(active: bool = Query(..., description="Enable or disable automated IPS blocking")):
    """Toggle between passive IDS mode and active IPS mode."""
    SystemConfig.ips_mode_active = active
    status_message = (
        "IPS Auto-Containment Enabled. Threats will be neutralized automatically." 
        if active else 
        "IDS Monitoring Mode Active. Threat response requires manual authorization."
    )
    return {
        "ips_mode_active": SystemConfig.ips_mode_active,
        "message": status_message
    }

# 1. GET /threats - Paginated, filterable, searchable, isolated by tenant
@app.get("/threats", response_model=PaginatedThreatResponse)
def get_threats(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    attack_type: Optional[str] = Query(None, description="Filter by attack type"),
    status: Optional[str] = Query(None, description="Filter by status (open, investigating, resolved)"),
    search: Optional[str] = Query(None, description="Search by IP address or attack type"),
    exclude_normal: bool = Query(False, description="Exclude normal benign network events"),
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    """Retrieve threats list filtered by tenant isolation."""
    query = db.query(Threat).filter(Threat.api_key == tenant_key)
    
    filters = []
    if severity:
        filters.append(func.lower(Threat.severity) == severity.lower())
    if attack_type:
        filters.append(func.lower(Threat.attack_type) == attack_type.lower())
    if status:
        filters.append(func.lower(Threat.status) == status.lower())
    if exclude_normal:
        filters.append(func.lower(Threat.attack_type) != "normal")
    if search:
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                Threat.source_ip.ilike(search_term),
                Threat.destination_ip.ilike(search_term),
                Threat.attack_type.ilike(search_term)
            )
        )
        
    if filters:
        query = query.filter(and_(*filters))
        
    total = query.count()
    pages = (total + limit - 1) // limit if total > 0 else 1

    query = query.order_by(desc(Threat.timestamp))
    offset = (page - 1) * limit
    threats = query.offset(offset).limit(limit).all()
    
    return {
        "items": threats,
        "total": total,
        "page": page,
        "pages": pages,
        "limit": limit
    }

# 2. GET /threats/summary - Severity statistics for current tenant
@app.get("/threats/summary", response_model=ThreatSummary)
def get_threats_summary(
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    """Get threat summary counts grouped by severity for the current tenant."""
    results = db.query(
        Threat.severity, func.count(Threat.id)
    ).filter(Threat.api_key == tenant_key).group_by(Threat.severity).all()
    
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    total = 0
    
    for severity, count in results:
        severity_lower = severity.lower()
        if severity_lower in counts:
            counts[severity_lower] = count
            total += count
            
    blocked = db.query(Threat).filter(
        and_(Threat.api_key == tenant_key, Threat.is_blocked == True)
    ).count()
            
    return ThreatSummary(
        total=total,
        critical=counts["critical"],
        high=counts["high"],
        medium=counts["medium"],
        low=counts["low"],
        blocked=blocked
    )

# 3. GET /threats/distribution - Attack distribution counts for tenant
@app.get("/threats/distribution", response_model=List[ThreatDistributionItem])
def get_threats_distribution(
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    """Get threat distribution count grouped by attack_type for current tenant."""
    results = db.query(
        Threat.attack_type, 
        func.count(Threat.id).label("count")
    ).filter(Threat.api_key == tenant_key).group_by(Threat.attack_type).order_by(desc("count")).all()
    
    return [ThreatDistributionItem(attack_type=r[0], count=r[1]) for r in results]

# 4. GET /threats/trend - Time-bucketed counts for tenant
@app.get("/threats/trend", response_model=List[ThreatTrendItem])
def get_threats_trend(
    days: int = Query(90, ge=1, description="Number of historical days to fetch"),
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    """Returns time-bucketed counts of threats for current tenant."""
    min_max = db.query(
        func.min(Threat.timestamp), func.max(Threat.timestamp)
    ).filter(Threat.api_key == tenant_key).first()
    
    if not min_max or min_max[0] is None:
        return []
        
    db_min_time, db_max_time = min_max
    cutoff_date = db_max_time - timedelta(days=days)
    time_span = db_max_time - max(db_min_time, cutoff_date)
    
    if time_span < timedelta(days=2):
        if engine.name == "sqlite":
            time_group = func.strftime("%Y-%m-%dT%H:00:00Z", Threat.timestamp)
        else:
            time_group = func.to_char(Threat.timestamp, "YYYY-MM-DD\"T\"HH24:00:00\"Z\"")
    else:
        if engine.name == "sqlite":
            time_group = func.strftime("%Y-%m-%d", Threat.timestamp)
        else:
            time_group = func.to_char(Threat.timestamp, "YYYY-MM-DD")
            
    trend_query = db.query(
        time_group.label("time_bucket"),
        func.count(Threat.id).label("total_count"),
        func.sum(case((func.lower(Threat.severity) == "critical", 1), else_=0)).label("crit_cnt"),
        func.sum(case((func.lower(Threat.severity) == "high", 1), else_=0)).label("high_cnt"),
        func.sum(case((func.lower(Threat.severity) == "medium", 1), else_=0)).label("med_cnt"),
        func.sum(case((func.lower(Threat.severity) == "low", 1), else_=0)).label("low_cnt"),
    ).filter(
        and_(Threat.api_key == tenant_key, Threat.timestamp >= cutoff_date)
    ).group_by("time_bucket").order_by(asc("time_bucket")).all()
    
    trend_data = []
    for row in trend_query:
        trend_data.append(
            ThreatTrendItem(
                time=row[0],
                count=int(row[1] or 0),
                critical=int(row[2] or 0),
                high=int(row[3] or 0),
                medium=int(row[4] or 0),
                low=int(row[5] or 0)
            )
        )
        
    return trend_data

# 5. GET /threats/map - Geographic attack vectors for current tenant
@app.get("/threats/map")
def get_threats_map(
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    """Get active geographic attack origins for global threat map visualization."""
    results = db.query(
        Threat.geo_country,
        Threat.geo_city,
        Threat.geo_lat,
        Threat.geo_lon,
        Threat.attack_type,
        Threat.severity,
        func.count(Threat.id).label("count")
    ).filter(
        and_(
            Threat.api_key == tenant_key,
            Threat.geo_lat.isnot(None),
            Threat.geo_lon.isnot(None),
            func.lower(Threat.attack_type) != "benign"
        )
    ).group_by(
        Threat.geo_country,
        Threat.geo_city,
        Threat.geo_lat,
        Threat.geo_lon,
        Threat.attack_type,
        Threat.severity
    ).order_by(desc("count")).limit(50).all()

    return [
        {
            "country": r[0],
            "city": r[1],
            "lat": r[2],
            "lon": r[3],
            "attack_type": r[4],
            "severity": r[5],
            "count": r[6]
        }
        for r in results
    ]

# 6. GET /threats/{id} - Single threat details
@app.get("/threats/{id}", response_model=ThreatResponse)
def get_threat_detail(id: int, db: Session = Depends(get_db)):
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat with ID {id} not found.")
    return threat

# 7. PATCH /threats/{id} - Update threat status/AI explanation
@app.patch("/threats/{id}", response_model=ThreatResponse)
def update_threat(id: int, update_data: ThreatUpdate, db: Session = Depends(get_db)):
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat with ID {id} not found.")
        
    data = update_data.model_dump(exclude_unset=True)
    if "status" in data:
        status_val = data["status"].lower()
        if status_val not in ["open", "investigating", "resolved"]:
            raise HTTPException(status_code=400, detail="Invalid status. Must be 'open', 'investigating', or 'resolved'.")
        threat.status = status_val
        
    if "ai_explanation" in data:
        threat.ai_explanation = data["ai_explanation"]
        
    db.commit()
    db.refresh(threat)
    return threat

# 8. POST /threats/{id}/explain - Generate AI explanation on demand
@app.post("/threats/{id}/explain", response_model=ThreatResponse)
def explain_threat(id: int, db: Session = Depends(get_db)):
    from .ai_service import generate_threat_explanation
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat with ID {id} not found.")
        
    if threat.ai_explanation:
        return threat
        
    explanation = generate_threat_explanation(threat)
    threat.ai_explanation = explanation
    
    db.commit()
    db.refresh(threat)
    return threat

# 9. GET /model/metrics - Dynamic ML evaluation parameters
@app.get("/model/metrics", response_model=ModelMetricsResponse)
def get_model_metrics():
    metrics_path = os.path.join(PROJECT_ROOT, "ml", "metrics.json")
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Model metrics file not found. Please train model first.")
    with open(metrics_path, "r") as f:
        import json
        data = json.load(f)
    return data

# 10. POST /threats/{id}/block - Automated containment with optional OS firewall enforcement
@app.post("/threats/{id}/block", response_model=ThreatResponse)
def block_threat_source(
    id: int, 
    enforce_os: bool = Query(False, description="Attempt true host OS firewall rule execution"),
    db: Session = Depends(get_db)
):
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat with ID {id} not found.")
        
    threat.is_blocked = True
    threat.status = "resolved"

    if enforce_os and platform.system().lower() == "windows":
        try:
            cmd = ["netsh", "advfirewall", "firewall", "add", "rule", f"name=SOC_BLOCK_{threat.source_ip}", "dir=in", "action=block", f"remoteip={threat.source_ip}"]
            subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        except Exception as e:
            print(f"OS Firewall rule execution warning: {e}")

    db.commit()
    db.refresh(threat)
    return threat

# 11. GET /threats/{id}/report/pdf - Forensic Incident Report
@app.get("/threats/{id}/report/pdf")
def export_threat_pdf(id: int, db: Session = Depends(get_db)):
    from .report_service import generate_threat_pdf_report
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat #{id} not found.")

    pdf_buffer = generate_threat_pdf_report(threat)
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=soc_incident_report_{id}.pdf"
        }
    )

# 12. GET /threats/{id}/xai - SHAP Feature Attributions
@app.get("/threats/{id}/xai")
def get_threat_xai(id: int, db: Session = Depends(get_db)):
    from .xai_service import xai_service
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat #{id} not found.")

    features = threat.features or {}
    return xai_service.explain_threat_features(features, threat.attack_type)

# 13. GET /threats/{id}/rules - Rule generation
@app.get("/threats/{id}/rules")
def get_containment_rules(id: int, db: Session = Depends(get_db)):
    threat = db.query(Threat).filter(Threat.id == id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat #{id} not found.")

    ip = threat.source_ip
    return {
        "source_ip": ip,
        "attack_type": threat.attack_type,
        "mitre_id": threat.mitre_id,
        "windows_netsh": f'netsh advfirewall firewall add rule name="SOC_BLOCK_{ip}" dir=in action=block remoteip={ip}',
        "linux_iptables": f"iptables -A INPUT -s {ip} -j DROP",
        "suricata_rule": f'drop ip {ip} any -> any any (msg:"SOC Auto-Containment IP {ip}"; sid:100{id:04d}; rev:1;)',
        "snort_rule": f'drop ip {ip} any -> any any (msg:"SOC Auto-Containment IP {ip}"; sid:200{id:04d}; rev:1;)'
    }

# 14. POST /pcap/upload - PCAP ingestion with Tenant Binding & IPS Auto-Containment
@app.post("/pcap/upload")
async def upload_pcap(
    file: Optional[UploadFile] = File(None),
    demo: bool = Query(False, description="Analyze built-in demo PCAP sample"),
    tenant_key: str = Depends(get_tenant_key),
    db: Session = Depends(get_db)
):
    from src.pcap_analyzer import parse_pcap, inspect_and_classify_flows, create_sample_pcap
    
    if demo or not file:
        sample_path = os.path.join(PROJECT_ROOT, "data", "live_sample.pcap")
        create_sample_pcap(sample_path)
        with open(sample_path, "rb") as f:
            content = f.read()
        filename = "live_sample.pcap"
    else:
        content = await file.read()
        filename = file.filename

    if len(content) < 24:
        raise HTTPException(status_code=400, detail="Invalid PCAP file: Header is too short.")

    try:
        flows = parse_pcap(content)
        classified_threats = inspect_and_classify_flows(flows, commit_to_db=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PCAP file: {str(e)}")

    # Multi-tenant assignment & IPS auto-containment
    if classified_threats:
        threat_ids = [t["id"] for t in classified_threats if isinstance(t, dict) and "id" in t]
        if threat_ids:
            # Bind all newly created records to the current tenant key
            db.query(Threat).filter(Threat.id.in_(threat_ids)).update(
                {Threat.api_key: tenant_key}, 
                synchronize_session=False
            )
            
            # If IPS mode is active, automatically neutralize critical and high threats
            if SystemConfig.ips_mode_active:
                for threat_item in classified_threats:
                    sev = str(threat_item.get("severity", "")).lower()
                    atk = str(threat_item.get("attack_type", "")).lower()
                    if sev in ["critical", "high"] and atk not in ["benign", "normal"]:
                        threat_id = threat_item.get("id")
                        if threat_id:
                            record = db.query(Threat).filter(Threat.id == threat_id).first()
                            if record and not record.is_blocked:
                                record.is_blocked = True
                                record.status = "resolved"
                                threat_item["is_blocked"] = True
                                threat_item["status"] = "resolved"
            db.commit()

    # Broadcast with tenant isolation metadata to WebSocket clients
    if classified_threats:
        await manager.broadcast({
            "type": "pcap_analysis_completed",
            "api_key": tenant_key,
            "filename": filename,
            "flows_count": len(flows),
            "threats_count": len(classified_threats),
            "threats": classified_threats,
            "ips_mode": SystemConfig.ips_mode_active
        })

    return {
        "success": True,
        "api_key": tenant_key,
        "filename": filename,
        "flows_analyzed": len(flows),
        "threats_detected": len(classified_threats),
        "threats": classified_threats,
        "ips_active": SystemConfig.ips_mode_active
    }

# 15. WebSocket /ws/threats - Real-time Push Telemetry Stream
@app.websocket("/ws/threats")
async def websocket_threats_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)