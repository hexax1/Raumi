export class Point {
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  x: number;
  y: number;

  copyWith(update: Partial<Point>): Point {
    return new Point(
      update.x ?? this.x,
      update.y ?? this.y
    );
  }
};

export class Wall implements Movable {
  id: number | null;
  p1: Point;
  p2: Point;

  constructor(id: number | null, p1: Point, p2: Point) {
    this.id = id;
    this.p1 = p1;
    this.p2 = p2;
  }

  copyWith(update: Partial<Wall>): Wall {
    return new Wall(
      update.id ?? this.id,
      update.p1 ?? this.p1.copyWith({}), // Create a copy of the point to avoid mutating the original
      update.p2 ?? this.p2.copyWith({})
    );
  }

  getSnappingPoints(): Point[] {
    return [this.p1, this.p2];
  }

  getSnappablePoints(): Point[] {
    return [this.p1, this.p2];
  }

  getDefiningPoints(): Point[] {
    return [this.p1, this.p2];
  }

  move(dx: number, dy: number): void {
    this.p1.x += dx;
    this.p1.y += dy;
    this.p2.x += dx;
    this.p2.y += dy;
  }
};


export interface Movable {
  id: number | null;
  getSnappingPoints(): Point[]; // Points that should snap when this Element is moved.
  getSnappablePoints(): Point[]; // Points that are potential hooks for other elements to snap to.
  getDefiningPoints(): Point[]; // Points that define the shape (e.g. for a Room, the upper left and lower right corner)
  copyWith(update: Partial<Movable>): Movable; // Create a copy of this element with some properties updated.
  move(dx: number, dy: number): void; // Move the element by the given delta.
}

/**
 * p1: Upper Left Corner
 * p2: Lower Right Corner
 */
export class Room implements Movable {
  id: number | null;
  label: string | null;
  p1: Point; // Upper Left Corner
  p2: Point; // Lower Right Corner
  
  constructor(id: number | null, p1: Point, p2: Point) {
    this.id = id;
    this.label = null;
    this.p1 = p1;
    this.p2 = p2;
  }

  copyWith(update: Partial<Room>): Room {
    const copy = new Room(
      update.id ?? this.id,
      update.p1 ?? this.p1.copyWith({}), // Create a copy of the point to avoid mutating the original
      update.p2 ?? this.p2.copyWith({})
    );

    copy.label = update.label ?? this.label;

    return copy;
  }
  
  getSnappingPoints(): Point[] {
    return [this.p1, this.p2, new Point(this.p1.x, this.p2.y), new Point(this.p2.x, this.p1.y)];
  }

  getSnappablePoints(): Point[] {
    return [this.p1, this.p2, new Point(this.p1.x, this.p2.y), new Point(this.p2.x, this.p1.y)];
  }

  getDefiningPoints(): Point[] {
    return [this.p1, this.p2];
  }

  move(dx: number, dy: number): void {
    this.p1.x += dx;
    this.p1.y += dy;
    this.p2.x += dx;
    this.p2.y += dy;
  }
}

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