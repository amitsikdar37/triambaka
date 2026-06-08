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
from flask import Flask, render_template
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

# Fixed coordinates for drones (UI scale)
drone_coords = {
    "Drone_Alpha": 120.0,
    "Drone_Bravo": 350.0,
    "Drone_Charlie": 550.0
}

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
    while True:
        current_time = time.time()
        
        assigned_interceptor = "None"
        best_bbox_area = 0
        missile_x = 0.0
        missile_z = 0.0

        dashboard_frames = []

        # Process each drone's latest frame
        for d_id in ["Drone_Alpha", "Drone_Bravo", "Drone_Charlie"]:
            frame = frames[d_id]
            
            if frame is None:
                # Create a blank frame if not connected
                blank = np.zeros((240, 320, 3), dtype=np.uint8)
                cv2.putText(blank, f"{d_id}: OFFLINE", (50, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                dashboard_frames.append(blank)
                continue
            
            # Make a copy for processing and display
            display_frame = cv2.resize(frame, (320, 240))
            
            # Run YOLO
            results = model(display_frame, verbose=False)
            
            local_locked = False
            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    # Look for Cell Phone (67)
                    if class_id == 67 and confidence > 0.4:
                        local_locked = True
                        x1, y1, x2, y2 = box.xyxy[0]
                        
                        area = (x2 - x1) * (y2 - y1)
                        if area > best_bbox_area:
                            best_bbox_area = area
                            assigned_interceptor = d_id
                            
                            # Estimate missile X/Z from this frame
                            x = (x1 + x2) / 2
                            y = (y1 + y2) / 2
                            missile_x = float((x / 320) * 650)
                            missile_z = float((y / 240) * 400)
                            
                        cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                        break

            if local_locked:
                cv2.putText(display_frame, "TARGET DETECTED", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

            # Add title
            cv2.putText(display_frame, d_id, (10, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            dashboard_frames.append(display_frame)

        # Highlight the assigned interceptor
        if assigned_interceptor != "None":
            idx = ["Drone_Alpha", "Drone_Bravo", "Drone_Charlie"].index(assigned_interceptor)
            cv2.rectangle(dashboard_frames[idx], (0, 0), (319, 239), (0, 255, 0), 4)
            cv2.putText(dashboard_frames[idx], "ASSIGNED", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Combine frames side-by-side
        if len(dashboard_frames) == 3:
            combined = np.hstack(dashboard_frames)
            cv2.imshow("Ashwathama Multi-Drone Dashboard", combined)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Sync telemetry
        telemetry = {
            "is_locked": assigned_interceptor != "None",
            "missile_x": missile_x,
            "missile_z": missile_z,
            "drone_alpha_x": drone_coords["Drone_Alpha"],
            "drone_bravo_x": drone_coords["Drone_Bravo"],
            "drone_charlie_x": drone_coords["Drone_Charlie"],
            "target_speed": 450.0 if assigned_interceptor != "None" else 0.0,
            "drone_speed": 0.0,
            "assigned_interceptor": assigned_interceptor,
            "timestamp": current_time
        }
        
        try:
            with open("telemetry.json", "w") as f:
                json.dump(telemetry, f)
        except Exception as e:
            pass

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