import cv2

cap = cv2.VideoCapture(0)

orb = cv2.ORB_create(nfeatures=1500)

while True:

    ret, frame = cap.read()

    if not ret:
        break

    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY
    )

    kp, des = orb.detectAndCompute(
        gray,
        None
    )

    output = cv2.drawKeypoints(
        frame,
        kp,
        None,
        color=(0,0,255)
    )

    cv2.imshow(
        "ORB Features",
        output
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()