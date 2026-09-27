# Implementation Plan - Phase 1: Data Pipeline

This plan outlines the design and implementation for Phase 1 of the **AI Cyber Threat Detection Platform**. It covers downloading the NSL-KDD dataset, loading it with correct headers, cleaning/encoding the data, mapping raw attack labels to simplified security categories, synthesizing realistic network fields (IPs, ports, timestamps), sampling the dataset, and saving the output for downstream consumption.

## Proposed Changes

We will create a structured directory layout for our data pipeline:
```
data/
  raw/                # Raw NSL-KDD dataset files (KDDTrain+.txt, KDDTest+.txt)
  threats_cleaned.csv # Output cleaned dataset
src/
  data_pipeline.py    # Python script for downloading, cleaning, and preprocessing
README.md             # Documentation of the dataset, mapping logic, and setup
```

### Data Pipeline Module

#### [NEW] [data_pipeline.py](file:///c:/Users/justh/Desktop/Farhaan/Major%20Project/src/data_pipeline.py)
A Python script that will:
1. **Auto-download** the raw NSL-KDD training and testing datasets from the verified GitHub repository if not present locally.
2. **Load and Combine** both datasets with the 41 feature column names plus `attack_category` and `difficulty_level`.
3. **Clean the Data**:
   - Handle any missing values.
   - Encode categorical features (`protocol_type`, `service`, `flag`) using label encoding/one-hot prep while keeping human-readable columns for downstream components.
4. **Map Attack Labels**:
   - Map KDD labels to: `DDoS`, `Port Scan`, `Recon`, `Brute Force`, `Malware`, `Normal`.
5. **Synthesize Fields**:
   - `timestamp`: Plausible timestamps starting from a recent baseline and increasing by small increments.
   - `source_ip` & `destination_ip`: Realistic IP addresses, allocating malicious IPs to attacks and domestic IPs to normal traffic.
   - `port`: Map KDD's `service` column to realistic standard ports (e.g. `http` -> 80, `ssh` -> 22, `smtp` -> 25) and fill unknown ones with plausible random ports.
   - `packet_size`: Combine `src_bytes` and `dst_bytes` with fallback values.
   - `is_attack`: Boolean representing whether `attack_type != 'Normal'`.
6. **Sample the Dataset**: Clean and downsample to exactly ~15,000 rows (preserving class balances).
7. **Export**: Save to `data/threats_cleaned.csv`.

#### [NEW] [README.md](file:///c:/Users/justh/Desktop/Farhaan/Major%20Project/README.md)
Documenting:
1. Dataset source details and column mapping list.
2. Classification/label mapping rules.
3. Steps to run the pipeline.

## Verification Plan

### Automated Verification
Run the data pipeline script and verify:
- Output CSV is created in `data/threats_cleaned.csv`.
- CSV file is non-empty, contains the required columns, and has correct data types.
- Print class balance to check distribution of each mapped `attack_type`.

### Manual Verification
- Review the generated `data/threats_cleaned.csv` to ensure IP addresses, timestamps, ports, and packet sizes look realistic.
