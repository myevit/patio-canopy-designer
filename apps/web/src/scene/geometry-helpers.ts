import type { Vector3Mm } from "@canopy/shared";

export function distance2D(a: Vector3Mm, b: Vector3Mm): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Closest point on segment [start, end] to `point`, in plan (x/y), clamped to the segment and interpolating z. */
export function projectPointOntoSegment(point: Vector3Mm, start: Vector3Mm, end: Vector3Mm): Vector3Mm {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { ...start };
  }
  const t = Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
    z: start.z + (end.z - start.z) * t,
  };
}
