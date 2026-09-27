import os
import sys
import pandas as pd
import joblib
from datetime import datetime
from sqlalchemy.orm import Session

# Add project root and src directory to python path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(PROJECT_ROOT)

from backend.app.database import engine, SessionLocal, Base
from backend.app.models import Threat

CSV_PATH = os.path.join(PROJECT_ROOT, 'data', 'threats_cleaned.csv')
MODEL_PATH = os.path.join(PROJECT_ROOT, 'ml', 'model.pkl')

MITRE_MAP = {
    'DDoS': 'T1498',
    'PortScan': 'T1046',
    'Brute Force': 'T1110',
    'Web Attack': 'T1190',
    'Botnet': 'T1071',
    'Benign': 'None'
}

def main():
    print("--- Database Seeding Script Started (CIC-IDS2017) ---")
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: threats_cleaned.csv not found at {CSV_PATH}.")
        print("Please run 'python src/data_pipeline.py' first.")
        sys.exit(1)
        
    if not os.path.exists(MODEL_PATH):
        print(f"Error: model.pkl not found at {MODEL_PATH}.")
        print("Please run 'python src/train_model.py' first.")
        sys.exit(1)
        
    print(f"Loading threat logs from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    total_rows = len(df)
    print(f"Loaded {total_rows} rows from CSV.")
    
    # Load ML model pipeline once (for batch prediction)
    print("Loading ML model for batch inference...")
    model_pipeline = joblib.load(MODEL_PATH)
    trained_features = list(model_pipeline.feature_names_in_)
    
    # Reset Database (Recreate threats table)
    print("Resetting database tables...")
    Threat.__table__.drop(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    print("Tables recreated successfully.")
    
    # Batch Inference
    print("Running batch ML inference on dataset features...")
    start_time = datetime.now()
    
    X = pd.DataFrame()
    for col in trained_features:
        if col in df.columns:
            X[col] = df[col]
        else:
            X[col] = 0.0
            
    X = X[trained_features]
    
    all_preds = model_pipeline.predict(X)
    all_probs = model_pipeline.predict_proba(X)
    class_labels = list(model_pipeline.classes_)
    
    print(f"Batch inference completed in {datetime.now() - start_time}.")
    
    # Construct database records
    print("Constructing database records...")
    db_records = []
    metadata_cols = ['timestamp', 'source_ip', 'destination_ip', 'is_attack', 'attack_type',
                     'geo_country', 'geo_city', 'geo_lat', 'geo_lon', 'mitre_id']
    feature_cols = [col for col in df.columns if col not in metadata_cols]
    
    for idx in range(total_rows):
        row_series = df.iloc[idx]
        row_dict = row_series.to_dict()
        
        pred_class = str(all_preds[idx])
        probs = all_probs[idx]
        class_idx = class_labels.index(pred_class)
        confidence = float(probs[class_idx])
        
        # Severity Mapping
        if pred_class == 'DDoS':
            severity = 'critical'
        elif pred_class == 'Web Attack':
            severity = 'critical' if confidence >= 0.75 else 'high'
        elif pred_class == 'Botnet':
            severity = 'critical' if confidence >= 0.8 else 'high'
        elif pred_class == 'Brute Force':
            severity = 'high'
        elif pred_class == 'PortScan':
            severity = 'medium'
        else:
            severity = 'low'
            
        ts_str = str(row_dict['timestamp'])
        if ts_str.endswith('Z'):
            ts_str = ts_str[:-1]
        ts_dt = datetime.fromisoformat(ts_str)
        
        row_features = {feat: row_dict[feat] for feat in feature_cols if feat in row_dict}
        
        # Simulate ~10% of critical threats already blocked by automated firewall rule
        is_blocked = True if (severity == 'critical' and idx % 7 == 0) else False

        db_records.append({
            'timestamp': ts_dt,
            'source_ip': str(row_dict['source_ip']),
            'destination_ip': str(row_dict['destination_ip']),
            'attack_type': pred_class,
            'severity': severity,
            'confidence': round(confidence, 4),
            'status': 'resolved' if is_blocked else 'open',
            'is_blocked': is_blocked,
            'geo_country': row_dict.get('geo_country'),
            'geo_city': row_dict.get('geo_city'),
            'geo_lat': float(row_dict['geo_lat']) if pd.notnull(row_dict.get('geo_lat')) else None,
            'geo_lon': float(row_dict['geo_lon']) if pd.notnull(row_dict.get('geo_lon')) else None,
            'mitre_id': MITRE_MAP.get(pred_class, 'None'),
            'ai_explanation': None,
            'features': row_features
        })
        
    print(f"Bulk inserting {len(db_records)} records into the database...")
    db = SessionLocal()
    try:
        start_time = datetime.now()
        db.bulk_insert_mappings(Threat, db_records)
        db.commit()
        print(f"Seeding completed successfully in {datetime.now() - start_time}!")
        
        count = db.query(Threat).count()
        blocked_count = db.query(Threat).filter(Threat.is_blocked == True).count()
        print(f"Database validation: threats table contains {count} records ({blocked_count} blocked).")
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
        raise e
    finally:
        db.close()
        
    print("--- Database Seeding Script Completed ---")

if __name__ == "__main__":
    main()
