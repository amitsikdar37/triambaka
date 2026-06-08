import socket
import json
import time
import numpy as np

# Configure local machine network settings
UDP_IP = "127.0.0.1"
THREAT_PORT = 6000

# Set up the UDP network socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

print("🚀 Threat Generation System Active. Simulating airspace...")

# Initial missile conditions (X, Y, Altitude)
start_pos = np.array([0.0, 10.0, 100.0])
velocity = np.array([5.0, 4.0, -4.5])  # Meters per step

step = 0
while step < 25:
    # Calculate current position based on velocity vector
    current_pos = start_pos + (velocity * step)
    
    # Inject environmental wind/atmospheric noise
    noise = np.random.normal(0, 0.2, 3)
    noisy_pos = current_pos + noise
    
    # Construct telemetry payload
    payload = {
        "step": step,
        "x": float(noisy_pos[0]),
        "y": float(noisy_pos[1]),
        "z": float(noisy_pos[2]),
        "timestamp": time.time()
    }
    
    # Compress payload to JSON string and broadcast over local network
    message = json.dumps(payload).encode('utf-8')
    sock.sendto(message, (UDP_IP, THREAT_PORT))
    
    print(f"📡 Broadcasted Threat Position [Step {step}]: X={payload['x']:.2f}, Y={payload['y']:.2f}, Alt={payload['z']:.2f}")
    
    step += 1
    time.sleep(0.5)  # Output frequency rate (Hz)

print("🏳️ Missile simulation path finished.")