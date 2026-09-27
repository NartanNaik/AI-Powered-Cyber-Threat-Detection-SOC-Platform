import os
import sys
import random
import pandas as pd
import joblib
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to python path to resolve imports
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)

from backend.app.config import settings
from backend.app.models import Threat

CSV_PATH = os.path.join(PROJECT_ROOT, 'data', 'threats_cleaned.csv')
MODEL_PATH = os.path.join(PROJECT_ROOT, 'ml', 'model.pkl')

def main():
    print("--- Traffic Simulation Started ---")
    
    # 1. Load configuration and connect to database
    db_url = settings.DATABASE_URL
    print(f"Connecting to database (SQLite/PostgreSQL)...")
    
    is_sqlite = db_url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    
    engine = create_engine(db_url, connect_args=connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 2. Check files
        if not os.path.exists(CSV_PATH):
            raise FileNotFoundError(f"Cleaned dataset not found at {CSV_PATH}.")
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}.")
            
        # 3. Load dataset and model
        df = pd.read_csv(CSV_PATH)
        model_pipeline = joblib.load(MODEL_PATH)
        trained_features = list(model_pipeline.feature_names_in_)
        
        # 4. Sample 3-5 random threat rows to simulate "live" feed activity
        num_rows = random.randint(3, 5)
        print(f"Sampling {num_rows} random telemetry flows from CIC-IDS2017 dataset...")
        sampled_df = df.sample(n=num_rows).reset_index(drop=True)
        
        # 5. Align features for ML model batch inference
        X = pd.DataFrame()
        for col in trained_features:
            if col in sampled_df.columns:
                X[col] = sampled_df[col]
            else:
                X[col] = 0.0
        X = X[trained_features]
        
        # Run predictions
        all_preds = model_pipeline.predict(X)
        all_probs = model_pipeline.predict_proba(X)
        class_labels = list(model_pipeline.classes_)
        
        # 6. Prepare records
        feature_keys = [
            'protocol', 'port', 'packet_size', 'duration',
            'flow_duration', 'tot_fwd_pkts', 'tot_bwd_pkts', 'totlen_fwd_pkts', 'totlen_bwd_pkts',
            'fwd_pkt_len_mean', 'bwd_pkt_len_mean', 'flow_byts_s', 'flow_pkts_s',
            'syn_flag_cnt', 'rst_flag_cnt', 'ack_flag_cnt'
        ]
        
        new_threats = []
        for idx in range(num_rows):
            row_dict = sampled_df.iloc[idx].to_dict()
            
            # Extract prediction metrics
            pred_class = all_preds[idx]
            probs = all_probs[idx]
            class_idx = class_labels.index(pred_class)
            confidence = float(probs[class_idx])
            
            # Severity mapping aligned with CIC-IDS2017 classes
            severity = 'low'
            if pred_class == 'DDoS':
                severity = 'critical'
            elif pred_class == 'Botnet':
                severity = 'critical' if confidence >= 0.8 else 'high'
            elif pred_class == 'Web Attack':
                severity = 'high'
            elif pred_class == 'Brute Force':
                severity = 'high'
            elif pred_class in ['PortScan', 'Port Scan']:
                severity = 'medium'
            elif pred_class == 'Benign':
                severity = 'low'
                
            row_features = {feat: row_dict[feat] for feat in feature_keys if feat in row_dict}
            
            # GeoIP & MITRE attributes
            geo_lat = float(row_dict['geo_lat']) if 'geo_lat' in row_dict and pd.notna(row_dict['geo_lat']) else None
            geo_lon = float(row_dict['geo_lon']) if 'geo_lon' in row_dict and pd.notna(row_dict['geo_lon']) else None
            geo_country = str(row_dict['geo_country']) if pd.notna(row_dict.get('geo_country')) else 'Unknown'
            geo_city = str(row_dict['geo_city']) if pd.notna(row_dict.get('geo_city')) else 'Unknown'

            raw_mitre = row_dict.get('mitre_id')
            mitre_id = str(raw_mitre) if pd.notna(raw_mitre) and str(raw_mitre) not in ['nan', 'None', ''] else None
            if not mitre_id and pred_class != 'Benign':
                mitre_id = 'T1498'

            # Construct model object (assign current UTC timestamp to simulate "live" trigger)
            threat_obj = Threat(
                timestamp=datetime.now(timezone.utc),
                source_ip=str(row_dict['source_ip']),
                destination_ip=str(row_dict['destination_ip']),
                attack_type=str(pred_class),
                severity=severity,
                confidence=round(confidence, 4),
                status='open',
                is_blocked=False,
                geo_country=geo_country,
                geo_city=geo_city,
                geo_lat=geo_lat,
                geo_lon=geo_lon,
                mitre_id=mitre_id,
                ai_explanation=None,
                features=row_features
            )
            new_threats.append(threat_obj)
            mitre_str = f" [MITRE {threat_obj.mitre_id}]" if threat_obj.mitre_id else ""
            print(f"  Simulated Alert: [{pred_class}{mitre_str}] {threat_obj.source_ip} ({threat_obj.geo_city}, {threat_obj.geo_country}) -> {threat_obj.destination_ip} (Sev: {severity}, Conf: {confidence:.2%})")
            
        # 7. Write to DB
        db.add_all(new_threats)
        db.commit()
        print(f"Successfully inserted {len(new_threats)} new live alerts into database!")
        
    except Exception as e:
        print(f"Traffic simulation failed: {e}")
        db.rollback()
        raise e
    finally:
        db.close()
        
    print("--- Traffic Simulation Completed ---")

if __name__ == "__main__":
    main()
