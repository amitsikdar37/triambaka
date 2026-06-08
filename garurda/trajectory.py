import cv2
import numpy as np

# =====================================
# Camera Initialization
# =====================================
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera not found")
    exit()

# =====================================
# ORB Setup
# =====================================
orb = cv2.ORB_create(nfeatures=1500)

bf = cv2.BFMatcher(
    cv2.NORM_HAMMING,
    crossCheck=True
)

# =====================================
# First Frame
# =====================================
ret, prev_frame = cap.read()

if not ret:
    print("Cannot read camera")
    exit()

prev_gray = cv2.cvtColor(
    prev_frame,
    cv2.COLOR_BGR2GRAY
)

kp1, des1 = orb.detectAndCompute(
    prev_gray,
    None
)

# =====================================
# Trajectory Map
# =====================================
traj = np.zeros(
    (600, 600, 3),
    dtype=np.uint8
)

# Starting position
x = 300
y = 300
path_points = [] 

# Dashboard Variables
feature_count = 0
match_count = 0

# =====================================
# Planned Route
# =====================================
planned_path = [
    (300, 300),
    (320, 290),
    (340, 280),
    (360, 270),
    (380, 260),
    (400, 250),
    (420, 240),
    (440, 230),
    (460, 220)
]
target_x = 500
target_y = 150 

# =====================================
# Main Loop
# =====================================
while True:

    ret, frame = cap.read()

    if not ret:
        break

    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY
    )

    kp2, des2 = orb.detectAndCompute(
        gray,
        None
    )

    feature_count = len(kp2)

    if des1 is not None and des2 is not None:

        matches = bf.match(
            des1,
            des2
        )

        matches = sorted(
            matches,
            key=lambda m: m.distance
        )

        good = matches[:80]

        match_count = len(good)

        if len(good) > 10:

            pts1 = np.float32(
                [kp1[m.queryIdx].pt for m in good]
            ).reshape(-1, 1, 2)

            pts2 = np.float32(
                [kp2[m.trainIdx].pt for m in good]
            ).reshape(-1, 1, 2)

            M, _ = cv2.estimateAffinePartial2D(
                pts1,
                pts2
            )

            if M is not None:

                dx = np.clip(
                    M[0, 2],
                    -10,
                    10
                )

                dy = np.clip(
                    M[1, 2],
                    -10,
                    10
                )

                x += int(dx)
                y += int(dy)
                path_points.append((x, y)) 

                x = max(
                    0,
                    min(599, x)
                )

                y = max(
                    0,
                    min(599, y)
                )

                # Actual trajectory
                cv2.circle(
                    traj,
                    (x, y),
                    2,
                    (0, 0, 255),
                    -1
                )

        kp1 = kp2
        des1 = des2
        prev_frame = frame.copy()
        prev_gray = gray.copy()

    # =====================================
    # Display Map
    # =====================================
    display_traj = traj.copy()
    for i in range(1, len(path_points)):
     cv2.line(
        display_traj,
        path_points[i-1],
        path_points[i],
        (0,255,0),
        2
    )

    # Planned Path (Blue)
    for i in range(len(planned_path) - 1):
        cv2.line(
            display_traj,
            planned_path[i],
            planned_path[i + 1],
            (255, 0, 0),
            2
        )

    # Current Position
    cv2.circle(
        display_traj,
        (x, y),
        6,
        (255, 255, 255),
        -1
    )

    # =====================================
    # Mini Map
    # =====================================
    mini_map = cv2.resize(
        display_traj,
        (250, 250)
    )

    h, w, _ = frame.shape

    frame[
        10:260,
        w - 260:w - 10
    ] = mini_map

    # =====================================
    # Dashboard
    # =====================================
    cv2.putText(
        frame,
        "GARUDA TRAJECTORY",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        3
    )

    cv2.putText(
        frame,
        "STATUS : ACTIVE",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 0),
        2
    )

    cv2.putText(
        frame,
        f"ORB FEATURES : {feature_count}",
        (20, 120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"MATCHES : {match_count}",
        (20, 160),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"X : {x}",
        (20, 200),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"Y : {y}",
        (20, 240),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    # Calculate values to return to original trajectory
    min_dist = float('inf')
    closest_pt = planned_path[0]
    for pt in planned_path:
        dist = (pt[0] - x)**2 + (pt[1] - y)**2
        if dist < min_dist:
            min_dist = dist
            closest_pt = pt
            
    return_x = closest_pt[0] - x
    return_y = closest_pt[1] - y

    cv2.putText(
        frame,
        f"RETURN X : {return_x}",
        (20, 280),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"RETURN Y : {return_y}",
        (20, 320),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2
    )

    cv2.imshow(
        "Garuda Dashboard",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()