import cv2

cap = cv2.VideoCapture(0)

orb = cv2.ORB_create(1500)

bf = cv2.BFMatcher(
    cv2.NORM_HAMMING,
    crossCheck=True
)

ret, old_frame = cap.read()

old_gray = cv2.cvtColor(
    old_frame,
    cv2.COLOR_BGR2GRAY
)

kp1, des1 = orb.detectAndCompute(
    old_gray,
    None
)

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

    if des2 is not None:

        matches = bf.match(
            des1,
            des2
        )

        matches = sorted(
            matches,
            key=lambda x:x.distance
        )

        output = cv2.drawMatches(
            old_frame,
            kp1,
            frame,
            kp2,
            matches[:50],
            None
        )

        cv2.imshow(
            "ORB Matching",
            output
        )

        kp1 = kp2
        des1 = des2
        old_frame = frame.copy()

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()