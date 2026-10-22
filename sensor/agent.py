import socket
import struct
import time
import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL","https://your-backend.onrender.com/pcap/upload")
PACKET_BATCH_SIZE = int(os.getenv("PACKET_BATCH_SIZE", 150))
API_KEY = os.getenv("API_KEY", "default_key")

def get_local_ip():
    """Dynamically finds the active network interface IP."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())

def build_pcap(packets):
    """Constructs a binary PCAP file entirely in RAM (Bypasses disk I/O & AV blocks)."""
    # Global PCAP Header: Magic, Major, Minor, Timezone, SigFigs, SnapLen, Network(1=Ethernet)
    pcap = bytearray(struct.pack('<IHHiIII', 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
    
    # Dummy Ethernet Header (Dest MAC, Src MAC, IPv4 Type 0x0800)
    dummy_eth = b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\x00'
    
    for ts, pkt_data in packets:
        sec = int(ts)
        usec = int((ts - sec) * 1_000_000)
        length = len(pkt_data) + 14  # Add 14 bytes for dummy Ethernet
        
        # Packet Header: timestamp_sec, timestamp_usec, captured_len, original_len
        pcap.extend(struct.pack('<IIII', sec, usec, length, length))
        pcap.extend(dummy_eth)
        pcap.extend(pkt_data)
        
    return bytes(pcap)

def stream_to_soc(pcap_bytes):
    """Uploads the PCAP payload using native urllib (no requests library needed)."""
    boundary = "----SOCAgentFormBoundary7MA4YWxkTrZu0gW"
    
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode('utf-8'))
    body.extend(b'Content-Disposition: form-data; name="file"; filename="stream.pcap"\r\n')
    body.extend(b'Content-Type: application/vnd.tcpdump.pcap\r\n\r\n')
    body.extend(pcap_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode('utf-8'))
    
    req = urllib.request.Request(API_URL, data=body)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    req.add_header('X-API-Key', API_KEY)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                threats = data.get("threats_detected", 0)
                print(f"[{time.strftime('%H:%M:%S')}] Stream Synced | Analyzed: {data.get('flows_analyzed')} flows | Threats: {threats}")
    except Exception as e:
        pass # Silently fail and retry on next batch to keep agent invisible

def run_agent():
    local_ip = get_local_ip()
    print(f"🚀 AI SOC Agent Active (Driverless Mode). Bound to {local_ip}")
    print(f"Sniffing {PACKET_BATCH_SIZE} packets per cycle...")
    
    try:
        # Create a raw native Windows socket (Requires Admin)
        s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
        s.bind((local_ip, 0))
        s.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
        
        # Enable promiscuous mode to capture all IPv4 traffic
        s.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
    except OSError as e:
        print(f"\n[CRITICAL ERROR] Failed to start packet capture.")
        print(f"You MUST run this application as an Administrator.")
        return

    try:
        while True:
            packets = []
            for _ in range(PACKET_BATCH_SIZE):
                packet_data, _ = s.recvfrom(65535)
                packets.append((time.time(), packet_data))
            
            pcap_binary = build_pcap(packets)
            stream_to_soc(pcap_binary)
            
    except KeyboardInterrupt:
        print("\nAgent shut down cleanly.")
    finally:
        try:
            # Disable promiscuous mode before exiting
            s.ioctl(socket.SIO_RCVALL, socket.RCVALL_OFF)
            s.close()
        except: pass

if __name__ == "__main__":
    run_agent()