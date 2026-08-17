import type { Vector3Mm } from "@canopy/shared";
import type { Point2D } from "./cut-diagram-layout.js";
import { localToWorld, type MemberFrame } from "./member-frame.js";

/**
 * Orthographic drawing views: "plan" looks straight down (-Z), "front" looks
 * along +Y onto the XZ plane, "side" looks along +X onto the YZ plane. Each
 * simply drops one world axis, so foreshortening never distorts a length -
 * dimensions must always be read from the model, never from these projected
 * coordinates.
 */
export type ProjectionPlane = "plan" | "front" | "side";

export function projectPoint(point: Vector3Mm, plane: ProjectionPlane): Point2D {
  switch (plane) {
    case "plan":
      return { x: point.x, y: point.y };
    case "front":
      return { x: point.x, y: -point.z };
    case "side":
      return { x: point.y, y: -point.z };
  }
}

function cross(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Andrew's monotone chain: a deterministic convex hull, given a stable sort
 * order (by x, then y) and a strict "pop on non-left-turn" rule that also
 * discards collinear boundary points.
 */
export function convexHull(points: Point2D[]): Point2D[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const unique: Point2D[] = [];
  for (const p of sorted) {
    const last = unique[unique.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) unique.push(p);
  }
  if (unique.length <= 2) return unique;

  const lower: Point2D[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * Projects a member's oriented rectangular volume (its 8 bounding corners,
 * derived from its analytic frame and cross-section, never re-measured by
 * hand) onto one drawing plane, then takes the convex hull so any viewing
 * angle - including fan rafters that converge in plan - produces a correct
 * silhouette.
 */
export function projectMemberOutline(
  frame: MemberFrame,
  plane: ProjectionPlane,
  sectionWidthMm: number,
  sectionHeightMm: number,
): Point2D[] {
  const halfWidth = sectionWidthMm / 2;
  const halfHeight = sectionHeightMm / 2;
  const corners: Vector3Mm[] = [];
  for (const u of [0, frame.lengthMm]) {
    for (const v of [-halfWidth, halfWidth]) {
      for (const w of [-halfHeight, halfHeight]) {
        corners.push(localToWorld(frame, { u, v, w }));
      }
    }
  }
  return convexHull(corners.map((corner) => projectPoint(corner, plane)));
}
