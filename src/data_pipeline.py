import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Directories
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
OUTPUT_PATH = os.path.join(DATA_DIR, "threats_cleaned.csv")
os.makedirs(DATA_DIR, exist_ok=True)

# Attacker GeoIP Pool (Authentic IP hotspots for global threat map visualization)
ATTACKER_GEOS = [
    {"country": "United States", "city": "Ashburn", "lat": 39.0438, "lon": -77.4874, "ip_prefix": "198.51.100"},
    {"country": "Germany", "city": "Frankfurt", "lat": 50.1109, "lon": 8.6821, "ip_prefix": "185.220.101"},
    {"country": "Russia", "city": "Moscow", "lat": 55.7558, "lon": 37.6173, "ip_prefix": "91.109.25"},
    {"country": "China", "city": "Beijing", "lat": 39.9042, "lon": 116.4074, "ip_prefix": "202.108.22"},
    {"country": "Netherlands", "city": "Amsterdam", "lat": 52.3676, "lon": 4.9041, "ip_prefix": "77.247.110"},
    {"country": "Brazil", "city": "Sao Paulo", "lat": -23.5505, "lon": -46.6333, "ip_prefix": "177.136.250"},
    {"country": "Singapore", "city": "Singapore", "lat": 1.3521, "lon": 103.8198, "ip_prefix": "103.253.144"},
    {"country": "United Kingdom", "city": "London", "lat": 51.5074, "lon": -0.1278, "ip_prefix": "82.165.197"},
    {"country": "Canada", "city": "Toronto", "lat": 43.6532, "lon": -79.3832, "ip_prefix": "192.206.151"}
]

# Internal Protected Infrastructure (SOC Monitored Assets)
INTERNAL_SERVERS = {
    "web": {"ip": "10.0.1.10", "ports": [80, 443], "name": "DMZ Web Cluster"},
    "db": {"ip": "10.0.1.20", "ports": [5432, 1433], "name": "Core SQL Database"},
    "ad": {"ip": "10.0.1.5", "ports": [88, 389, 22], "name": "Active Directory Controller"},
    "api": {"ip": "10.0.1.50", "ports": [8080, 8443], "name": "API Gateway"}
}

INTERNAL_WORKSTATIONS = [
    "10.0.2.15", "10.0.2.22", "10.0.2.58", "10.0.2.104", "10.0.2.165"
]

# MITRE ATT&CK Framework Mapping
MITRE_MAP = {
    'DDoS': 'T1498',          # Network Denial of Service
    'PortScan': 'T1046',      # Network Service Discovery
    'Brute Force': 'T1110',   # Brute Force Credentials
    'Web Attack': 'T1190',    # Exploit Public-Facing Application
    'Botnet': 'T1071',        # Application Layer Protocol (C2)
    'Benign': 'None'          # Normal Traffic
}

def generate_cic_dataset(num_records=12000, random_seed=42):
    """
    Synthesize an authentic, class-balanced modern network flow dataset conforming to
    the Canadian Institute for Cybersecurity (CIC-IDS2017) flow telemetry standards.
    """
    print(f"Generating {num_records} CIC-IDS2017 flow telemetry records...")
    rng = np.random.default_rng(random_seed)

    # Class target allocations
    class_distribution = {
        'Benign': int(num_records * 0.35),
        'DDoS': int(num_records * 0.25),
        'PortScan': int(num_records * 0.15),
        'Brute Force': int(num_records * 0.12),
        'Web Attack': int(num_records * 0.08),
        'Botnet': int(num_records * 0.05)
    }

    rows = []
    base_time = datetime.now() - timedelta(days=28)
    current_time = base_time

    for attack_type, count in class_distribution.items():
        is_attack = (attack_type != 'Benign')
        mitre_id = MITRE_MAP[attack_type]

        for _ in range(count):
            # Step time forward by a realistic increment (between 15 and 90 seconds)
            current_time += timedelta(seconds=int(rng.integers(15, 90)))
            timestamp_str = current_time.strftime("%Y-%m-%dT%H:%M:%SZ")

            # 1. Network Endpoints & Geolocation
            if is_attack:
                geo = rng.choice(ATTACKER_GEOS)
                source_ip = f"{geo['ip_prefix']}.{rng.integers(2, 254)}"
                geo_country = geo['country']
                geo_city = geo['city']
                geo_lat = geo['lat'] + round(rng.uniform(-0.05, 0.05), 4)
                geo_lon = geo['lon'] + round(rng.uniform(-0.05, 0.05), 4)

                # Target server selection based on attack vector
                if attack_type == 'DDoS':
                    target = INTERNAL_SERVERS['web']
                    dst_port = rng.choice(target['ports'])
                    destination_ip = target['ip']
                    protocol = 'TCP'
                elif attack_type == 'Web Attack':
                    target = rng.choice([INTERNAL_SERVERS['web'], INTERNAL_SERVERS['api']])
                    dst_port = rng.choice(target['ports'])
                    destination_ip = target['ip']
                    protocol = 'TCP'
                elif attack_type == 'Brute Force':
                    target = rng.choice([INTERNAL_SERVERS['ad'], INTERNAL_SERVERS['db']])
                    dst_port = 22 if target == INTERNAL_SERVERS['ad'] else 5432
                    destination_ip = target['ip']
                    protocol = 'TCP'
                elif attack_type == 'PortScan':
                    target = rng.choice(list(INTERNAL_SERVERS.values()))
                    dst_port = int(rng.integers(1, 65535))
                    destination_ip = target['ip']
                    protocol = 'TCP' if rng.random() > 0.15 else 'UDP'
                else: # Botnet
                    destination_ip = rng.choice(INTERNAL_WORKSTATIONS)
                    dst_port = rng.choice([6667, 8080, 4444, 53])
                    protocol = 'TCP' if dst_port != 53 else 'UDP'
            else:
                # Benign traffic (internal corporate communications or normal web browsing)
                source_ip = rng.choice(INTERNAL_WORKSTATIONS)
                target = rng.choice(list(INTERNAL_SERVERS.values()))
                destination_ip = target['ip']
                dst_port = rng.choice(target['ports'])
                protocol = 'TCP'
                geo_country = "Internal Corporate"
                geo_city = "Data Center"
                geo_lat = 37.7749 # San Francisco datacenter
                geo_lon = -122.4194

            # 2. CICFlowMeter Statistical Flow Characteristics (CIC-IDS2017)
            if attack_type == 'DDoS':
                flow_duration = int(rng.integers(500, 15000))
                tot_fwd_pkts = int(rng.integers(120, 2500))
                tot_bwd_pkts = int(rng.integers(0, 15))
                totlen_fwd_pkts = int(tot_fwd_pkts * rng.uniform(40, 120))
                totlen_bwd_pkts = int(tot_bwd_pkts * rng.uniform(0, 60))
                fwd_pkt_len_mean = float(rng.uniform(40, 80))
                bwd_pkt_len_mean = float(rng.uniform(0, 30))
                flow_byts_s = float(totlen_fwd_pkts / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_iat_mean = float(rng.uniform(0.5, 5.0))
                flow_iat_std = float(rng.uniform(0.1, 2.0))
                fwd_iat_mean = float(rng.uniform(0.5, 4.0))
                bwd_iat_mean = float(rng.uniform(0.0, 1.0))
                syn_flag_cnt = 1
                rst_flag_cnt = 0
                psh_flag_cnt = 0
                ack_flag_cnt = 1 if rng.random() > 0.4 else 0
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 20)
                bwd_header_len = int(tot_bwd_pkts * 20)
                down_up_ratio = round(tot_bwd_pkts / max(1, tot_fwd_pkts), 2)
                pkt_len_variance = float(rng.uniform(10, 80))
                subflow_fwd_pkts = tot_fwd_pkts

            elif attack_type == 'PortScan':
                flow_duration = int(rng.integers(10, 800))
                tot_fwd_pkts = int(rng.integers(1, 4))
                tot_bwd_pkts = int(rng.integers(0, 2))
                totlen_fwd_pkts = int(tot_fwd_pkts * 44)
                totlen_bwd_pkts = int(tot_bwd_pkts * 40)
                fwd_pkt_len_mean = 44.0
                bwd_pkt_len_mean = 40.0 if tot_bwd_pkts > 0 else 0.0
                flow_byts_s = float((totlen_fwd_pkts + totlen_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_iat_mean = float(rng.uniform(5.0, 50.0))
                flow_iat_std = float(rng.uniform(1.0, 20.0))
                fwd_iat_mean = float(flow_iat_mean)
                bwd_iat_mean = 0.0
                syn_flag_cnt = 1
                rst_flag_cnt = 1 if tot_bwd_pkts > 0 else 0
                psh_flag_cnt = 0
                ack_flag_cnt = 0
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 20)
                bwd_header_len = int(tot_bwd_pkts * 20)
                down_up_ratio = 0.0
                pkt_len_variance = 0.0
                subflow_fwd_pkts = tot_fwd_pkts

            elif attack_type == 'Brute Force':
                flow_duration = int(rng.integers(2000, 15000))
                tot_fwd_pkts = int(rng.integers(15, 60))
                tot_bwd_pkts = int(rng.integers(12, 50))
                totlen_fwd_pkts = int(tot_fwd_pkts * rng.uniform(50, 120))
                totlen_bwd_pkts = int(tot_bwd_pkts * rng.uniform(80, 200))
                fwd_pkt_len_mean = float(rng.uniform(50, 90))
                bwd_pkt_len_mean = float(rng.uniform(80, 150))
                flow_byts_s = float((totlen_fwd_pkts + totlen_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_iat_mean = float(rng.uniform(80.0, 400.0))
                flow_iat_std = float(rng.uniform(20.0, 150.0))
                fwd_iat_mean = float(flow_iat_mean * 1.1)
                bwd_iat_mean = float(flow_iat_mean * 0.9)
                syn_flag_cnt = 1
                rst_flag_cnt = 1 if rng.random() > 0.6 else 0
                psh_flag_cnt = 1
                ack_flag_cnt = 1
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 32)
                bwd_header_len = int(tot_bwd_pkts * 32)
                down_up_ratio = round(tot_bwd_pkts / max(1, tot_fwd_pkts), 2)
                pkt_len_variance = float(rng.uniform(200, 1200))
                subflow_fwd_pkts = tot_fwd_pkts

            elif attack_type == 'Web Attack':
                flow_duration = int(rng.integers(1500, 25000))
                tot_fwd_pkts = int(rng.integers(8, 35))
                tot_bwd_pkts = int(rng.integers(6, 40))
                totlen_fwd_pkts = int(rng.integers(1200, 8500)) # Large HTTP POST payloads
                totlen_bwd_pkts = int(rng.integers(800, 18000))
                fwd_pkt_len_mean = float(totlen_fwd_pkts / tot_fwd_pkts)
                bwd_pkt_len_mean = float(totlen_bwd_pkts / tot_bwd_pkts)
                flow_byts_s = float((totlen_fwd_pkts + totlen_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_iat_mean = float(rng.uniform(40.0, 250.0))
                flow_iat_std = float(rng.uniform(10.0, 80.0))
                fwd_iat_mean = float(flow_iat_mean)
                bwd_iat_mean = float(flow_iat_mean)
                syn_flag_cnt = 1
                rst_flag_cnt = 0
                psh_flag_cnt = 1
                ack_flag_cnt = 1
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 32)
                bwd_header_len = int(tot_bwd_pkts * 32)
                down_up_ratio = round(tot_bwd_pkts / max(1, tot_fwd_pkts), 2)
                pkt_len_variance = float(rng.uniform(1500, 12000))
                subflow_fwd_pkts = tot_fwd_pkts

            elif attack_type == 'Botnet':
                flow_duration = int(rng.integers(10000, 90000))
                tot_fwd_pkts = int(rng.integers(10, 45))
                tot_bwd_pkts = int(rng.integers(8, 40))
                totlen_fwd_pkts = int(tot_fwd_pkts * rng.uniform(30, 90))
                totlen_bwd_pkts = int(tot_bwd_pkts * rng.uniform(40, 110))
                fwd_pkt_len_mean = float(rng.uniform(40, 80))
                bwd_pkt_len_mean = float(rng.uniform(40, 95))
                flow_byts_s = float((totlen_fwd_pkts + totlen_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                # Fixed periodicity beaconing characteristic
                flow_iat_mean = float(rng.uniform(1500.0, 3000.0))
                flow_iat_std = float(rng.uniform(5.0, 40.0))
                fwd_iat_mean = float(flow_iat_mean)
                bwd_iat_mean = float(flow_iat_mean)
                syn_flag_cnt = 1
                rst_flag_cnt = 0
                psh_flag_cnt = 1
                ack_flag_cnt = 1
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 20)
                bwd_header_len = int(tot_bwd_pkts * 20)
                down_up_ratio = round(tot_bwd_pkts / max(1, tot_fwd_pkts), 2)
                pkt_len_variance = float(rng.uniform(50, 400))
                subflow_fwd_pkts = tot_fwd_pkts

            else: # Benign
                flow_duration = int(rng.integers(800, 30000))
                tot_fwd_pkts = int(rng.integers(5, 50))
                tot_bwd_pkts = int(rng.integers(4, 70))
                totlen_fwd_pkts = int(tot_fwd_pkts * rng.uniform(80, 400))
                totlen_bwd_pkts = int(tot_bwd_pkts * rng.uniform(200, 1200))
                fwd_pkt_len_mean = float(totlen_fwd_pkts / tot_fwd_pkts)
                bwd_pkt_len_mean = float(totlen_bwd_pkts / tot_bwd_pkts)
                flow_byts_s = float((totlen_fwd_pkts + totlen_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_pkts_s = float((tot_fwd_pkts + tot_bwd_pkts) / max(1, flow_duration / 1000.0))
                flow_iat_mean = float(rng.uniform(50.0, 600.0))
                flow_iat_std = float(rng.uniform(20.0, 300.0))
                fwd_iat_mean = float(flow_iat_mean)
                bwd_iat_mean = float(flow_iat_mean)
                syn_flag_cnt = 1 if rng.random() > 0.1 else 0
                rst_flag_cnt = 0
                psh_flag_cnt = 1
                ack_flag_cnt = 1
                urg_flag_cnt = 0
                fwd_header_len = int(tot_fwd_pkts * 32)
                bwd_header_len = int(tot_bwd_pkts * 32)
                down_up_ratio = round(tot_bwd_pkts / max(1, tot_fwd_pkts), 2)
                pkt_len_variance = float(rng.uniform(1000, 8000))
                subflow_fwd_pkts = tot_fwd_pkts

            packet_size = totlen_fwd_pkts + totlen_bwd_pkts

            rows.append({
                # Metadata / Display
                'timestamp': timestamp_str,
                'source_ip': source_ip,
                'destination_ip': destination_ip,
                'protocol': protocol,
                'port': dst_port,
                'packet_size': packet_size,
                'duration': round(flow_duration / 1000.0, 2),
                'attack_type': attack_type,
                'is_attack': is_attack,
                'mitre_id': mitre_id,
                'geo_country': geo_country,
                'geo_city': geo_city,
                'geo_lat': geo_lat,
                'geo_lon': geo_lon,
                # 22 Core CICFlowMeter Features
                'flow_duration': flow_duration,
                'tot_fwd_pkts': tot_fwd_pkts,
                'tot_bwd_pkts': tot_bwd_pkts,
                'totlen_fwd_pkts': totlen_fwd_pkts,
                'totlen_bwd_pkts': totlen_bwd_pkts,
                'fwd_pkt_len_mean': round(fwd_pkt_len_mean, 2),
                'bwd_pkt_len_mean': round(bwd_pkt_len_mean, 2),
                'flow_byts_s': round(flow_byts_s, 2),
                'flow_pkts_s': round(flow_pkts_s, 2),
                'flow_iat_mean': round(flow_iat_mean, 2),
                'flow_iat_std': round(flow_iat_std, 2),
                'fwd_iat_mean': round(fwd_iat_mean, 2),
                'bwd_iat_mean': round(bwd_iat_mean, 2),
                'syn_flag_cnt': syn_flag_cnt,
                'rst_flag_cnt': rst_flag_cnt,
                'psh_flag_cnt': psh_flag_cnt,
                'ack_flag_cnt': ack_flag_cnt,
                'urg_flag_cnt': urg_flag_cnt,
                'fwd_header_len': fwd_header_len,
                'bwd_header_len': bwd_header_len,
                'down_up_ratio': down_up_ratio,
                'pkt_len_variance': round(pkt_len_variance, 2),
                'subflow_fwd_pkts': subflow_fwd_pkts
            })

    # Shuffle dataset
    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=random_seed).reset_index(drop=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"CIC-IDS2017 flow dataset exported to {OUTPUT_PATH} with {len(df)} rows.")

    print("\nClass Distribution Summary:")
    print(df['attack_type'].value_counts())
    return df

if __name__ == "__main__":
    generate_cic_dataset()
