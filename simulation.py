import cv2
import numpy as np
import json
import time
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture(0)

# Background tracking matrix settings for Optical Flow
ret, old_frame = cap.read()
old_gray = cv2.cvtColor(old_frame, cv2.COLOR_BGR2GRAY)
p0 = cv2.goodFeaturesToTrack(old_gray, maxCorners=30, qualityLevel=0.3, minDistance=7, blockSize=7)
lk_params = dict(winSize=(15, 15), maxLevel=2, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03))

# Initialize 3 distinct drone swarm points spread out over the map profile
drone_alpha_x = 120.0
drone_bravo_x = 350.0
drone_charlie_x = 550.0

last_target_x, last_target_y = 0, 0
last_calc_time = time.time()
target_speed = 0.0
drone_speed = 0.0

print("🎯 Swarm Allocation Core Active. Present a CELL PHONE to trigger tracking assignment...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret: break
    
    current_time = time.time()
    dt = current_time - last_calc_time
    last_calc_time = current_time

    frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # 1. OPTICAL FLOW INDEPENDENT DRIFT (Simulates drone patrol pattern under jamming)
    if p0 is not None:
        p1, st, err = cv2.calcOpticalFlowPyrLK(old_gray, frame_gray, p0, None, **lk_params)
        if p1 is not None and len(p1[st==1]) > 0:
            avg_dx = np.mean((p1[st==1] - p0[st==1])[:, 0])
            drone_speed = abs(avg_dx / (dt + 1e-5)) * 0.05
            # Shift our baseline tracking drone based on webcam background movement
            drone_alpha_x -= avg_dx * 1.0
            drone_alpha_x = max(20, min(drone_alpha_x, 250))

    results = model(frame, verbose=False)
    is_locked = False
    missile_x, missile_z = 0.0, 0.0
    assigned_interceptor = "None"

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            
            # Look for a Cell Phone (Class ID 67)
            if class_id == 67 and confidence > 0.4:
                is_locked = True
                x1, y1, x2, y2 = box.xyxy[0]
                x = (x1 + x2) / 2
                y = (y1 + y2) / 2
                
                # Map bounding box onto browser canvas spatial limits
                missile_x = float((x / frame.shape[1]) * 650)
                missile_z = float((y / frame.shape[0]) * 400)

                # --- NEW TARGET ALLOCATION LOGIC ---
                # Calculate absolute distances from target x position to each drone
                dist_alpha = abs(missile_x - drone_alpha_x)
                dist_bravo = abs(missile_x - drone_bravo_x)
                dist_charlie = abs(missile_x - drone_charlie_x)
                
                # Assign the closest drone as the designated interceptor element
                min_dist = min(dist_alpha, dist_bravo, dist_charlie)
                if min_dist == dist_alpha: assigned_interceptor = "Drone_Alpha"
                elif min_dist == dist_bravo: assigned_interceptor = "Drone_Bravo"
                else: assigned_interceptor = "Drone_Charlie"

                # Speed Tracker calculation mechanics
                if last_target_x != 0:
                    pixel_distance = np.sqrt((x - last_target_x)**2 + (y - last_target_y)**2)
                    target_speed = (pixel_distance / (dt + 1e-5)) * 0.08
                
                last_target_x, last_target_y = x, y
                
                # Draw high-contrast UI graphics over openCV window
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                cv2.putText(frame, f"ASSIGNED TO: {assigned_interceptor}", (int(x1), int(y1)-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                break

    if not is_locked:
        target_speed *= 0.5
        last_target_x, last_target_y = 0, 0

    # Sync variables down to the file bridge data structure
    telemetry = {
        "is_locked": is_locked,
        "missile_x": missile_x,
        "missile_z": missile_z,
        "drone_alpha_x": float(drone_alpha_x),
        "drone_bravo_x": float(drone_bravo_x),
        "drone_charlie_x": float(drone_charlie_x),
        "target_speed": float(target_speed),
        "drone_speed": float(drone_speed),
        "assigned_interceptor": assigned_interceptor,
        "timestamp": current_time
    }
    with open("telemetry.json", "w") as f:
        json.dump(telemetry, f)

    cv2.imshow("Sky Shield Intelligent Allocation Matrix Processor", frame)
    
    old_gray = frame_gray.copy()
    p0 = cv2.goodFeaturesToTrack(old_gray, maxCorners=30, qualityLevel=0.3, minDistance=7, blockSize=7)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()