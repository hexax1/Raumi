export type Point = {
  x: number;
  y: number;
};

export type Wall = {
  id: number | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function snapPoint(point: Point, snapPoints: Point[], threshold: number = 30): Point {
  let closest = null;
  let minDist = Infinity;

  for (const p of snapPoints) {
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < minDist && dist < threshold) {
      minDist = dist;
      closest = p;
    }
    console.log(dist)
  }

  return closest || point;
}

export function isSamePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

export function pointsAreClose(a: Point, b: Point, eps: number = 2) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}