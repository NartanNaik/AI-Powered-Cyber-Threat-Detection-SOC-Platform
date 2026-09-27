import os
import pandas as pd
import numpy as np
import joblib

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(PROJECT_ROOT, 'ml', 'model.pkl')

_MODEL = None

MITRE_MAP = {
    'DDoS': 'T1498',
    'PortScan': 'T1046',
    'Brute Force': 'T1110',
    'Web Attack': 'T1190',
    'Botnet': 'T1071',
    'Benign': 'None'
}

def get_model():
    """Load and cache the trained ML model pipeline."""
    global _MODEL
    if _MODEL is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Run src/train_model.py first.")
        _MODEL = joblib.load(MODEL_PATH)
    return _MODEL

def predict(row_dict):
    """
    Predict attack type, confidence, and severity for a network flow vector (CIC-IDS2017).
    """
    model_pipeline = get_model()
    trained_features = list(model_pipeline.feature_names_in_)

    input_data = {}
    for feature in trained_features:
        input_data[feature] = float(row_dict.get(feature, 0.0))

    df_row = pd.DataFrame([input_data])[trained_features]

    probabilities = model_pipeline.predict_proba(df_row)[0]
    predicted_class = model_pipeline.predict(df_row)[0]

    class_labels = list(model_pipeline.classes_)
    class_idx = class_labels.index(predicted_class)
    confidence = float(probabilities[class_idx])

    # Dynamic risk severity evaluation based on attack impact and confidence
    if predicted_class == 'DDoS':
        severity = 'critical'
    elif predicted_class == 'Web Attack':
        severity = 'critical' if confidence >= 0.75 else 'high'
    elif predicted_class == 'Botnet':
        severity = 'critical' if confidence >= 0.8 else 'high'
    elif predicted_class == 'Brute Force':
        severity = 'high'
    elif predicted_class == 'PortScan':
        severity = 'medium'
    else:
        severity = 'low'

    return {
        'attack_type': str(predicted_class),
        'confidence': round(confidence, 4),
        'severity': severity,
        'mitre_id': MITRE_MAP.get(predicted_class, 'None')
    }

if __name__ == "__main__":
    DATA_PATH = os.path.join(PROJECT_ROOT, 'data', 'threats_cleaned.csv')
    print("--- Testing predict.py with CIC-IDS2017 flow vectors ---")
    if os.path.exists(DATA_PATH):
        df = pd.read_csv(DATA_PATH, nrows=5)
        for idx, row in df.iterrows():
            res = predict(row.to_dict())
            print(f"Row {idx+1}: [{row['attack_type']}] -> Predicted: {res['attack_type']} ({res['confidence']*100:.1f}%) | Sev: {res['severity']} | MITRE: {res['mitre_id']}")
