import os
import time
import json
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timezone
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(PROJECT_ROOT, 'data', 'threats_cleaned.csv')
MODEL_DIR = os.path.join(PROJECT_ROOT, 'ml')
MODEL_PATH = os.path.join(MODEL_DIR, 'model.pkl')
METRICS_PATH = os.path.join(MODEL_DIR, 'metrics.json')

os.makedirs(MODEL_DIR, exist_ok=True)

# 22 Core CICFlowMeter features for training
FEATURE_COLUMNS = [
    'flow_duration', 'tot_fwd_pkts', 'tot_bwd_pkts', 'totlen_fwd_pkts', 'totlen_bwd_pkts',
    'fwd_pkt_len_mean', 'bwd_pkt_len_mean', 'flow_byts_s', 'flow_pkts_s',
    'flow_iat_mean', 'flow_iat_std', 'fwd_iat_mean', 'bwd_iat_mean',
    'syn_flag_cnt', 'rst_flag_cnt', 'psh_flag_cnt', 'ack_flag_cnt', 'urg_flag_cnt',
    'fwd_header_len', 'bwd_header_len', 'down_up_ratio', 'pkt_len_variance', 'subflow_fwd_pkts'
]

TARGET_COLUMN = 'attack_type'

def main():
    print("--- Phase 2: CIC-IDS2017 Multi-Model Comparative Training & Benchmark ---")

    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Cleaned dataset not found at {DATA_PATH}. Run src/data_pipeline.py first.")

    print(f"Loading CIC-IDS2017 telemetry from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Dataset shape: {df.shape}")

    # Prepare features and target
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    # Stratified Train-Test Split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training split: {X_train.shape[0]} samples, Testing split: {X_test.shape[0]} samples\n")

    # Define candidate models for comparative study
    candidate_models = [
        {
            "name": "Random Forest",
            "type": "Tree Ensemble",
            "model": RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, class_weight='balanced')
        },
        {
            "name": "Hist Gradient Boosting",
            "type": "Gradient Boosting",
            "model": HistGradientBoostingClassifier(max_iter=100, random_state=42)
        },
        {
            "name": "Multi-Layer Perceptron (MLP)",
            "type": "Deep Neural Network",
            "model": MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=200, random_state=42)
        },
        {
            "name": "Logistic Regression",
            "type": "Linear Baseline",
            "model": LogisticRegression(max_iter=500, random_state=42)
        }
    ]

    benchmark_results = []
    trained_pipelines = {}

    print(f"{'Model Name':<28} | {'Accuracy':<10} | {'Macro F1':<10} | {'Latency (us)':<14} | {'Train (s)':<10}")
    print("-" * 80)

    for item in candidate_models:
        name = item["name"]
        clf = item["model"]
        
        # Pipeline with StandardScaler
        pipe = Pipeline(steps=[
            ('scaler', StandardScaler()),
            ('classifier', clf)
        ])

        # Benchmark training time
        t_start = time.time()
        pipe.fit(X_train, y_train)
        t_train = time.time() - t_start

        # Benchmark test inference
        t_inf_start = time.perf_counter()
        y_pred = pipe.predict(X_test)
        t_inf_total = time.perf_counter() - t_inf_start
        latency_us = round((t_inf_total / len(X_test)) * 1e6, 2)

        # Performance evaluation
        acc = accuracy_score(y_test, y_pred)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='macro', zero_division=0)

        trained_pipelines[name] = (pipe, y_pred, acc, f1, prec, rec)

        benchmark_results.append({
            "name": name,
            "type": item["type"],
            "accuracy": round(float(acc * 100), 2),
            "macro_f1": round(float(f1 * 100), 2),
            "precision": round(float(prec * 100), 2),
            "recall": round(float(rec * 100), 2),
            "latency_us": latency_us,
            "train_time_s": round(float(t_train), 2),
            "selected": (name == "Random Forest")
        })

        print(f"{name:<28} | {acc*100:6.2f}%    | {f1*100:6.2f}%    | {latency_us:8.1f} us    | {t_train:6.2f}s")

    print("-" * 80)

    # Primary production model: Random Forest
    rf_pipe, rf_preds, rf_acc, rf_f1, rf_prec, rf_rec = trained_pipelines["Random Forest"]
    
    # Class-wise metrics
    unique_labels = sorted(list(set(y)))
    p_class, r_class, f1_class, s_class = precision_recall_fscore_support(
        y_test, rf_preds, labels=unique_labels, zero_division=0
    )
    
    class_metrics = []
    for idx, label in enumerate(unique_labels):
        class_metrics.append({
            "class": label,
            "precision": f"{p_class[idx] * 100:.2f}%",
            "recall": f"{r_class[idx] * 100:.2f}%",
            "f1": f"{f1_class[idx] * 100:.2f}%",
            "support": str(int(s_class[idx]))
        })

    # Confusion Matrix
    cm = confusion_matrix(y_test, rf_preds, labels=unique_labels)
    cm_records = []
    for idx, row in enumerate(cm):
        cm_records.append({
            "label": unique_labels[idx],
            "values": [int(v) for v in row]
        })

    # Top Feature Importances from Random Forest
    rf_classifier = rf_pipe.named_steps['classifier']
    importances = rf_classifier.feature_importances_
    sorted_features = sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: x[1], reverse=True)
    top_features = [{"feature": f, "importance": round(float(imp), 4)} for f, imp in sorted_features[:8]]

    # Comprehensive metrics payload for dynamic serving
    metrics_payload = {
        "model_family": "Random Forest Classifier (CIC-IDS2017)",
        "accuracy": round(float(rf_acc * 100), 2),
        "macro_f1": round(float(rf_f1 * 100), 2),
        "precision": round(float(rf_prec * 100), 2),
        "recall": round(float(rf_rec * 100), 2),
        "last_trained": datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M:%S UTC"),
        "total_samples": len(df),
        "benchmark_comparison": benchmark_results,
        "class_metrics": class_metrics,
        "confusion_matrix": {
            "headers": unique_labels,
            "rows": cm_records
        },
        "top_features": top_features
    }

    # Save fitted Random Forest pipeline to disk
    print(f"\nSerializing fitted Random Forest pipeline to {MODEL_PATH}...")
    joblib.dump(rf_pipe, MODEL_PATH)

    # Save dynamic metrics JSON
    print(f"Exporting multi-model comparative metrics to {METRICS_PATH}...")
    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics_payload, f, indent=2)

    print("\n--- Model Training & Benchmark Successfully Completed ---")

if __name__ == "__main__":
    main()
