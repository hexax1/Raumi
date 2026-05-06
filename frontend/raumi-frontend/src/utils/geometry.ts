export type Point = {
  x: number;
  y: number;
};

export function constructPoint(x: number, y: number): Point {
  return {x, y}
}

export type Wall = {
  type: "wall";
  id: string;
  p1: Point;
  p2: Point;
  floorId: string;
};

export function copyWall(wall: Wall, update: Partial<Wall>): Wall {
  return { ...wall, 
    id: update.id ?? wall.id,
    p1: update.p1 ?? {...wall.p1},
    p2: update.p2 ?? {...wall.p2},
    floorId: update.floorId ?? wall.floorId
  }
}

export function copyGeometryObject(geometryObject: GeometryObject, update: Partial<GeometryObject>){
  return { ...geometryObject, 
    id: update.id ?? geometryObject.id,
    p1: update.p1 ?? {...geometryObject.p1},
    p2: update.p2 ?? {...geometryObject.p2},
    floorId: update.floorId ?? geometryObject.floorId
  }
}

export function constructWall(id: string, p1: Point, p2: Point, floorId: string): Wall{
  return {type: "wall", id, p1, p2, floorId}
}

export interface GeometryBehavior<T> {
  getDefiningPoints(obj: T): Point[];
  getSnappingPoints(obj: T): Point[];
  getSnappablePoints(obj: T): Point[];
  setDefiningPoints(obj: T, points: Point[]): T;
  move(obj: T, dx: number, dy: number): T;
}

export const wallBehavior: GeometryBehavior<Wall> = {
  getDefiningPoints: (wall) => [wall.p1, wall.p2],
  getSnappingPoints: (wall) => [wall.p1, wall.p2],
  getSnappablePoints: (wall) => [wall.p1, wall.p2],
  setDefiningPoints: (wall, definingPoints) => constructWall(wall.id, definingPoints[0], definingPoints[1], wall.floorId),
  move: (wall, dx, dy) => constructWall(wall.id, 
    constructPoint(wall.p1.x + dx, wall.p1.y + dy), 
    constructPoint(wall.p2.x + dx, wall.p2.y + dy), wall.floorId)
}

export const roomBehavior: GeometryBehavior<Room> = {
  getDefiningPoints: (room) => [room.p1, room.p2],
  getSnappingPoints: (room) => [room.p1, room.p2, constructPoint(room.p1.x, room.p2.y), constructPoint(room.p2.x, room.p1.y)],
  getSnappablePoints: (room) => [room.p1, room.p2, constructPoint(room.p1.x, room.p2.y), constructPoint(room.p2.x, room.p1.y)],
  setDefiningPoints: (room, definingPoints) => constructRoom(room.id, definingPoints[0], definingPoints[1], room.floorId),
  move: (room, dx, dy) => constructRoom(room.id, 
    constructPoint(room.p1.x + dx, room.p1.y + dy), 
    constructPoint(room.p2.x + dx, room.p2.y + dy), room.floorId)
}

export type GeometryObject = Wall | Room;

type BehaviorMap = {
  wall: GeometryBehavior<Wall>;
  room: GeometryBehavior<Room>;
};

export const behaviorMap: BehaviorMap = {
  wall: wallBehavior,
  room: roomBehavior
} as const;

export function getBehavior<T extends GeometryObject>(obj: T): GeometryBehavior<T> {
  return behaviorMap[obj.type] as GeometryBehavior<T>;
}

export function copyRoom(room: Room, update: Partial<Room>): Room {
  return {
    ...room,
    id: update.id ?? room.id,
    p1: update.p1 ?? {...room.p1},
    p2: update.p2 ?? {...room.p2},
    floorId: update.floorId ?? room.floorId,
    label: update.label ?? room.label,
  };
}

export function constructRoom(id: string, p1: Point, p2: Point, floorId: string): Room {
  return {type: "room", id, p1, p2, floorId, label: ""}
}

/**
 * p1: Upper Left Corner
 * p2: Lower Right Corner
 */
export type Room = {
  type: "room";
  id: string;
  label: string;
  p1: Point; // Upper Left Corner
  p2: Point; // Lower Right Corner
  floorId: string;
}

export function snapToPoints(point: Point, snapPoints: Point[], threshold: number = 10): [Point, Boolean] {
  let closest = null;
  let minDist = Infinity;

  for (const p of snapPoints) {
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < minDist && dist < threshold) {
      minDist = dist;
      closest = p;
    }
  }
  return closest ? [closest, true] : [point, false];
}

export function snapToAnything(point: Point, snapPoints: Point[], fixedPoint: Point, threshold: number = 10, maxAngle: number = 3){
  const [snappedToPointPoint, snappedToPointSuccessful] = snapToPoints(point, snapPoints, threshold)
  if (snappedToPointSuccessful){
    return snappedToPointPoint
  } else {
    return snapToAxisOfPoint(point, fixedPoint, maxAngle)
  }
}

// Wenn der Winkel von shiftingPoint zu fixedPoint nahe 0, 90, 180 oder 270 ist, wird shiftingPoint 
// so verschoben, dass der Winkel rechtwinklig wird.
// maxAngle in degrees
export function snapToAxisOfPoint(shiftingPoint: Point, fixedPoint: Point, maxAngle: number = 10): Point {
  const dx = shiftingPoint.x - fixedPoint.x;
  const dy = shiftingPoint.y - fixedPoint.y;
  
  // Don't snap if the point hasn't moved from the fixed point
  if (dx === 0 && dy === 0) return shiftingPoint;
  
  // Calculate angle from fixedPoint to shiftingPoint
  let angle = Math.atan2(dy, dx);
  
  // Convert to degrees and normalize to 0-360
  let angleDegrees = angle * (180 / Math.PI);
  if (angleDegrees < 0) angleDegrees += 360;
  
  // Find the closest cardinal direction (0°, 90°, 180°, 270°)
  const cardinalDirections = [0, 90, 180, 270];
  
  let closestCardinal = null;
  let minDiff = Infinity;
  
  for (const cardinal of cardinalDirections) {
    let diff = Math.abs(angleDegrees - cardinal);
    // Handle wrap-around (e.g., 350° is 10° away from 0°)
    if (diff > 180) diff = 360 - diff;
    
    if (diff < minDiff) {
      minDiff = diff;
      closestCardinal = cardinal;
    }
  }

  // If the angle is close to a cardinal direction, snap it
  if (minDiff < maxAngle && closestCardinal != null) {
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    const snapAngleRad = (closestCardinal * Math.PI) / 180;
    
    return constructPoint(fixedPoint.x + distance * Math.cos(snapAngleRad), 
    fixedPoint.y + distance * Math.sin(snapAngleRad))
  }
  return shiftingPoint;
}

export function isSamePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

export function pointsAreClose(a: Point, b: Point, eps: number = 2) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}