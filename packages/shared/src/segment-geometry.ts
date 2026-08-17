import type { Vector3Mm } from "./units.js";

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function scale(a: Vector3Mm, t: number): Vector3Mm {
  return { x: a.x * t, y: a.y * t, z: a.z * t };
}

function add(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function length(a: Vector3Mm): number {
  return Math.sqrt(dot(a, a));
}

export interface ClosestSegmentPoints {
  pointA: Vector3Mm;
  pointB: Vector3Mm;
  distanceMm: number;
}

/**
 * Closest points between two 3D line segments (Ericson, "Real-Time Collision
 * Detection", ClosestPtSegmentSegment). Used to detect where two member
 * centrelines meet or pass near each other, including skew (non-coplanar)
 * segments and degenerate (zero-length) inputs.
 */
export function closestPointsBetweenSegments(
  a1: Vector3Mm,
  a2: Vector3Mm,
  b1: Vector3Mm,
  b2: Vector3Mm,
): ClosestSegmentPoints {
  const d1 = subtract(a2, a1);
  const d2 = subtract(b2, b1);
  const r = subtract(a1, b1);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  const EPSILON = 1e-12;
  let s: number;
  let t: number;

  if (a <= EPSILON && e <= EPSILON) {
    s = 0;
    t = 0;
  } else if (a <= EPSILON) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPSILON) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      if (denom > EPSILON) {
        s = clamp01((b * f - c * e) / denom);
      } else {
        s = 0;
      }
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const pointA = add(a1, scale(d1, s));
  const pointB = add(b1, scale(d2, t));
  return { pointA, pointB, distanceMm: length(subtract(pointA, pointB)) };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
