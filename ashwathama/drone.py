import socket
import json
import time
import numpy as np

# Set up receiver socket to listen directly to the local sensor/threat broadcast
UDP_IP = "127.0.0.1"
THREAT_PORT = 6000

rx_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
rx_sock.bind((UDP_IP, THREAT_PORT))

# Fixed physical coordinates for our decentralized swarm fleet
drone_alpha_x = 120.0
drone_bravo_x = 350.0
drone_charlie_x = 550.0

print("🛰️ Ad-Hoc P2P Mesh Active. Listening directly for standalone sensor broadcasts...")

while True:
    # 1. Intercept raw radio packet straight from the sensor broadcast
    data, addr = rx_sock.recvfrom(1024)
    packet = json.loads(data.decode('utf-8'))
    
    current_time = time.time()
    
    # Extract coordinates sent by the standalone sensor
    missile_x = packet["x"]
    missile_z = packet["z"]
    
    # Map the threat coordinates onto the dashboard's visual grid scale
    scaled_missile_x = (missile_x / 120.0) * 650
    scaled_missile_z = (1.0 - (missile_z / 100.0)) * 400

    # --- DECENTRALIZED SWARM ALLOCATION ALGORITHM ---
    # The drones calculate who is closest to the target locally on the edge
    dist_alpha = abs(scaled_missile_x - drone_alpha_x)
    dist_bravo = abs(scaled_missile_x - drone_bravo_x)
    dist_charlie = abs(scaled_missile_x - drone_charlie_x)
    
    min_dist = min(dist_alpha, dist_bravo, dist_charlie)
    if min_dist == dist_alpha: assigned_interceptor = "Drone_Alpha"
    elif min_dist == dist_bravo: assigned_interceptor = "Drone_Bravo"
    else: assigned_interceptor = "Drone_Charlie"

    # --- P2P DIRECT FILE LOGGING ---
    # Write directly to the shared telemetry file, bypassing any central web servers
    telemetry = {
        "is_locked": True,
        "missile_x": float(scaled_missile_x),
        "missile_z": float(scaled_missile_z),
        "drone_alpha_x": float(drone_alpha_x),
        "drone_bravo_x": float(drone_bravo_x),
        "drone_charlie_x": float(drone_charlie_x),
        "target_speed": 450.0, # Simulated supersonic missile velocity (m/s)
        "drone_speed": 45.0,
        "assigned_interceptor": assigned_interceptor,
        "timestamp": current_time
    }
    
    with open("telemetry.json", "w") as f:
        json.dump(telemetry, f)
        
    print(f"📡 P2P Relay [Step {packet['step']}]: Intercepted Sensor Data -> Routed Alert to {assigned_interceptor}")