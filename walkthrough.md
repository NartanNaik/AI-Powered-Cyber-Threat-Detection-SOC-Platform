# Walkthrough - Phase 1: Data Pipeline

We have successfully designed, built, and executed the Data Pipeline for Phase 1 of the **AI Cyber Threat Detection Platform**.

## Accomplishments

1. **Automation Script** (`src/data_pipeline.py`):
   - Programmatically downloads `KDDTrain+.txt` and `KDDTest+.txt` from the remote repository.
   - Cleans the raw NSL-KDD dataset (handling missing values, standardizing strings).
   - Maps raw intrusion labels to 6 high-level categories: `Normal`, `DDoS`, `Port Scan`, `Recon`, `Brute Force`, and `Malware`.
   - Synthesizes realistic logs display fields (`timestamp`, `source_ip`, `destination_ip`, `protocol`, `port`, `packet_size`, `is_attack`).
   - Implements class-balanced sampling to maintain minority categories.
   - Exports the processed data to `data/threats_cleaned.csv`.
2. **Project Documentation** (`README.md`):
   - Outlines the column format, attack categories, IP synthesis strategy, and running instructions.

## Verification & Validation Results

We executed the data pipeline successfully. Below is the summary of the generated dataset:

### Class Balance Summary (`data/threats_cleaned.csv`)

- **Total Row Count**: 14,834
- **Features / Columns**: 49 (9 dashboard visualization columns + 40 KDD ML features)

| Threat Category | Count | Percentage | Description |
| :--- | :--- | :--- | :--- |
| **DDoS** | 5,338 | 35.98% | Flooding & Denial of Service attacks |
| **Normal** | 3,852 | 25.97% | Standard benign traffic (inbound/outbound/internal) |
| **Recon** | 2,035 | 13.72% | Network discovery, mapping, and sweeps |
| **Brute Force** | 1,874 | 12.63% | Password guessing and authentication attacks |
| **Port Scan** | 1,483 | 10.00% | Vulnerability scans and port probes |
| **Malware** | 252 | 1.70% | Privilege escalation and host takeover attempts (U2R) |

### Sample Output Records
Here is a preview of the structured CSV columns consumed by the dashboard:

```csv
timestamp,source_ip,destination_ip,protocol,port,packet_size,duration,attack_type,is_attack
2026-08-29T14:57:19Z,77.247.110.12,10.0.1.10,TCP,20859,491,0,DDoS,True
2026-08-29T14:57:22Z,45.143.203.14,10.0.1.10,TCP,41561,0,0,DDoS,True
2026-08-29T14:57:23Z,192.168.1.76,8.8.8.8,TCP,80,245,0,Normal,False
2026-08-29T14:57:24Z,77.247.110.12,10.0.1.10,TCP,41561,491,0,DDoS,True
2026-08-29T14:57:27Z,198.51.100.43,10.0.1.10,TCP,41561,0,0,Port Scan,True
```

The dataset is perfectly preprocessed and ready to train the ML classifier in Phase 2.
