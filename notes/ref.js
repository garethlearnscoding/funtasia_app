let prevTouches = [];

function getDistance(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function getMidpoint(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
  };
}

function getAngle(t1, t2) {
  return Math.atan2(
    t2.clientY - t1.clientY,
    t2.clientX - t1.clientX
  );
}

function getVector(tPrev, tNow) {
  return {
    x: tNow.clientX - tPrev.clientX,
    y: tNow.clientY - tPrev.clientY
  };
}

function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

function magnitude(v) {
  return Math.hypot(v.x, v.y);
}

function isParallel(v1, v2) {
  const cos = dot(v1, v2) / (magnitude(v1) * magnitude(v2));
  return cos > 0.9; // ~same direction
}

function isOpposite(v1, v2) {
  const cos = dot(v1, v2) / (magnitude(v1) * magnitude(v2));
  return cos < -0.9; // opposite direction
}

element.addEventListener("touchmove", (e) => {
  if (e.touches.length !== 2 || prevTouches.length !== 2) return;

  const [p1, p2] = prevTouches;
  const [c1, c2] = e.touches;

  // VECTORS
  const v1 = getVector(p1, c1);
  const v2 = getVector(p2, c2);

  // DISTANCE
  const prevDist = getDistance(p1, p2);
  const currDist = getDistance(c1, c2);

  // MIDPOINT
  const prevMid = getMidpoint(p1, p2);
  const currMid = getMidpoint(c1, c2);

  // ANGLE
  const prevAngle = getAngle(p1, p2);
  const currAngle = getAngle(c1, c2);

  // --- DETECTION ---

  if (isParallel(v1, v2)) {
    console.log("PAN");
    // use midpoint delta
    const dx = currMid.x - prevMid.x;
    const dy = currMid.y - prevMid.y;
  }

  else if (isOpposite(v1, v2)) {
    console.log("PINCH ZOOM");
    const zoomDelta = currDist - prevDist;
  }

  if (Math.abs(currAngle - prevAngle) > 0.05) {
    console.log("ROTATE");
  }

  prevTouches = [...e.touches];
});

element.addEventListener("touchstart", (e) => {
  prevTouches = [...e.touches];
});