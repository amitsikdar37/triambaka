import cv2

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()

    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    corners = cv2.goodFeaturesToTrack(
        gray,
        maxCorners=200,
        qualityLevel=0.01,
        minDistance=10
    )

    if corners is not None:
        for c in corners:
            x, y = c.ravel()

            cv2.circle(
                frame,
                (int(x), int(y)),
                3,
                (0, 255, 0),
                -1
            )

    cv2.imshow("Triambaka Features", frame)

    if cv2.waitKey(1) == ord("s"):
        break

cap.release()
cv2.destroyAllWindows()
 