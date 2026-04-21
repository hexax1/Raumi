export class Point {
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  x: number;
  y: number;
};

export class Wall {
  id: number | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  constructor(id: number | null, x1: number, y1: number, x2: number, y2: number) {
    this.id = id;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
};

export function snapPoint(point: Point, snapPoints: Point[], threshold: number = 10): Point {
  let closest = null;
  let minDist = Infinity;

  for (const p of snapPoints) {
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < minDist && dist < threshold) {
      minDist = dist;
      closest = p;
    }
  }

  return closest || point;
}

export function isSamePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

export function pointsAreClose(a: Point, b: Point, eps: number = 2) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}