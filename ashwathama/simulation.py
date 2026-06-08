import cv2
import numpy as np
import json
import time
import base64
import threading
import socket
import qrcode
from io import BytesIO
from PIL import Image
from flask import Flask, render_template, jsonify, send_from_directory
import os
from flask_socketio import SocketIO
from ultralytics import YOLO

app = Flask(__name__)
# Enable CORS for socketio
socketio = SocketIO(app, cors_allowed_origins="*")

model = YOLO("yolov8n.pt")

# Global state for latest frames and telemetry
frames = {
    "Drone_Alpha": None,
    "Drone_Bravo": None,
    "Drone_Charlie": None
}
global_telemetry = {"timestamp": 0}

# Fixed coordinates for drones (UI scale)
drone_coords = {
    "Drone_Alpha": 120.0,
    "Drone_Bravo": 350.0,
    "Drone_Charlie": 550.0
}

# Optical flow state
of_state = {
    "Drone_Alpha": {"old_gray": None, "p0": None},
    "Drone_Bravo": {"old_gray": None, "p0": None},
    "Drone_Charlie": {"old_gray": None, "p0": None}
}
lk_params = dict(winSize=(15, 15), maxLevel=2, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03))

# Smoothed coordinates for jitter-free UI
smoothed_missile_x = 325.0
smoothed_missile_z = 200.0

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.254.254.254', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

@app.route('/')
def index():
    return render_template('camera.html')

@app.route('/dashboard')
def dashboard():
    return send_from_directory(os.getcwd(), 'index.html')

@app.route('/telemetry.json')
def get_telemetry():
    response = jsonify(global_telemetry)
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

@socketio.on('video_frame')
def handle_video_frame(data):
    drone_id = data.get('drone_id')
    image_b64 = data.get('image')
    
    if drone_id and image_b64:
        try:
            # Decode base64 to OpenCV image
            header, encoded = image_b64.split(",", 1)
            img_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_data))
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            frames[drone_id] = frame
        except Exception as e:
            print("Error decoding frame:", e)

def process_frames():
    print("🎯 Target Allocation Processor Started.")
    global smoothed_missile_x, smoothed_missile_z
    
    while True:
        current_time = time.time()
        
        assigned_interceptor = "None"
        best_bbox_area = 0
        raw_missile_x = 325.0
        raw_missile_z = 200.0

        dashboard_frames = []
        valid_drones = []
        batch_frames = []
        target_positions = {}

        # Sort the drones so they display strictly left-to-right according to their physical position
        sorted_drones = sorted(["Drone_Alpha", "Drone_Bravo", "Drone_Charlie"], key=lambda k: drone_coords[k])

        # Gather frames for batch processing
        for d_id in sorted_drones:
            frame = frames[d_id]
            
            if frame is None:
                # Create a blank frame if not connected
                blank = np.zeros((240, 320, 3), dtype=np.uint8)
                cv2.putText(blank, f"{d_id}: OFFLINE", (50, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                dashboard_frames.append(blank)
                continue
            
            # Make a copy for processing and display
            display_frame = cv2.resize(frame, (320, 240))
            frame_gray = cv2.cvtColor(display_frame, cv2.COLOR_BGR2GRAY)
            
            # --- OPTICAL FLOW TRACKING ---
            state = of_state[d_id]
            if state["old_gray"] is not None and state["p0"] is not None:
                p1, st, err = cv2.calcOpticalFlowPyrLK(state["old_gray"], frame_gray, state["p0"], None, **lk_params)
                if p1 is not None and len(p1[st==1]) > 0:
                    avg_dx = np.mean((p1[st==1] - state["p0"][st==1])[:, 0])
                    # Apply a deadzone to eliminate micro-jitter and hand shake
                    if abs(avg_dx) > 0.4:
                        # Shift the drone coordinate (camera left -> background right -> avg_dx > 0 -> x decreases)
                        drone_coords[d_id] -= avg_dx * 1.5  # Tuned sensitivity multiplier
                        drone_coords[d_id] = max(20.0, min(drone_coords[d_id], 630.0))

            # Re-initialize tracking points for next frame
            state["old_gray"] = frame_gray.copy()
            state["p0"] = cv2.goodFeaturesToTrack(state["old_gray"], maxCorners=30, qualityLevel=0.3, minDistance=7, blockSize=7)
            # -----------------------------
            
            batch_frames.append(display_frame)
            valid_drones.append(d_id)
            dashboard_frames.append(display_frame)

        # Run YOLO in a single batch (Much faster!)
        if batch_frames:
            results = model(batch_frames, verbose=False)
            
            for i, result in enumerate(results):
                d_id = valid_drones[i]
                display_frame = batch_frames[i]
                local_locked = False
                
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    # Look for Cell Phone (67)
                    if class_id == 67 and confidence > 0.4:
                        local_locked = True
                        x1, y1, x2, y2 = box.xyxy[0]
                        
                        target_x_center = (x1 + x2) / 2
                        target_positions[d_id] = target_x_center
                        
                        area = (x2 - x1) * (y2 - y1)
                        if area > best_bbox_area:
                            best_bbox_area = area
                            assigned_interceptor = d_id
                            
                            # Accurately map the target X coordinate relative to the *specific drone's physical position*
                            offset_x = ((target_x_center - 160.0) / 160.0) * 180.0  # 180 pixels FOV spread
                            raw_missile_x = float(drone_coords[d_id] + offset_x)
                            raw_missile_z = float(((y1 + y2) / 2 / 240) * 400)
                            
                        cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                        break

                if local_locked:
                    cv2.putText(display_frame, "TARGET DETECTED", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

                # Add title
                cv2.putText(display_frame, d_id, (10, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # --- PARALLAX AUTO-ALIGNMENT ---
        # If multiple cameras see the target, we can deduce their physical left-to-right order!
        if len(target_positions) > 1:
            # The drone seeing the target furthest to the right (largest X) is physically the furthest left.
            sorted_by_parallax = sorted(target_positions.keys(), key=lambda k: target_positions[k], reverse=True)
            
            # Their current order on the graph
            current_order = sorted(target_positions.keys(), key=lambda k: drone_coords[k])
            
            if current_order != sorted_by_parallax:
                # They are physically out of order compared to the graph!
                # Instantly swap their coordinates to fix the order, maintaining optical flow positions
                current_coords_sorted = sorted([drone_coords[d] for d in target_positions.keys()])
                for i, d in enumerate(sorted_by_parallax):
                    drone_coords[d] = current_coords_sorted[i]
        # -------------------------------

        # Highlight the assigned interceptor
        if assigned_interceptor != "None":
            idx = sorted_drones.index(assigned_interceptor)
            cv2.rectangle(dashboard_frames[idx], (0, 0), (319, 239), (0, 255, 0), 4)
            cv2.putText(dashboard_frames[idx], "ASSIGNED", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Combine frames side-by-side
        if len(dashboard_frames) == 3:
            combined = np.hstack(dashboard_frames)
            cv2.imshow("Ashwathama Multi-Drone Dashboard", combined)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Smooth the target movement for a highly precise and jitter-free UI
        if assigned_interceptor != "None":
            smoothed_missile_x = smoothed_missile_x * 0.7 + raw_missile_x * 0.3
            smoothed_missile_z = smoothed_missile_z * 0.7 + raw_missile_z * 0.3

        # Sync telemetry to RAM (Do not write to disk to avoid Live Server reloads!)
        global global_telemetry
        global_telemetry = {
            "is_locked": assigned_interceptor != "None",
            "missile_x": float(smoothed_missile_x),
            "missile_z": float(smoothed_missile_z),
            "drone_alpha_x": float(drone_coords["Drone_Alpha"]),
            "drone_bravo_x": float(drone_coords["Drone_Bravo"]),
            "drone_charlie_x": float(drone_coords["Drone_Charlie"]),
            "target_speed": 450.0 if assigned_interceptor != "None" else 0.0,
            "drone_speed": 0.0,
            "assigned_interceptor": assigned_interceptor,
            "timestamp": float(current_time)
        }

        time.sleep(0.05) # ~20 FPS loop max

if __name__ == '__main__':
    local_ip = get_local_ip()
    url = f"https://{local_ip}:5000"
    
    print("\n" + "="*50)
    print("📡 Ashwathama Server Started!")
    print(f"🔗 Connect your smartphone cameras at: {url}")
    print("="*50 + "\n")
    
    # Generate QR Code
    qr = qrcode.QRCode()
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)
    
    print("\n⚠️ NOTE: Because we use a self-signed certificate, your browser will show a 'Not Secure' warning.")
    print("⚠️ Click 'Advanced' -> 'Proceed to site' to allow camera access.\n")

    # Start processing thread
    processor_thread = threading.Thread(target=process_frames, daemon=True)
    processor_thread.start()

    # Run Flask with adhoc SSL
    try:
        socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True, ssl_context='adhoc')
    except TypeError:
        # Fallback if allow_unsafe_werkzeug is not supported in this version
        socketio.run(app, host='0.0.0.0', port=5000, ssl_context='adhoc')