import type { Vector3Mm } from "@canopy/shared";
import { deriveRoofOutline } from "./derive-roof.js";
import { planeTrimCut, type EndSign, type PlaneTrimResult } from "./end-cuts.js";
import { worldDirectionToLocal, worldToLocal, type MemberFrame } from "./member-frame.js";

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(a: Vector3Mm): Vector3Mm {
  const len = Math.sqrt(dot(a, a));
  if (len <= 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

export interface RoofPlaneSlope {
  referenceElevationMm: number;
  pitchRad: number;
  directionRad: number;
}

export interface RoofPlaneGeometry {
  point: Vector3Mm;
  /** Unit normal, oriented so its z-component is non-negative (points away from the roof surface, upward). */
  normal: Vector3Mm;
}

/**
 * Derives the roof plane's world-space point/normal directly from the same
 * outline geometry the 3D scene renders (deriveRoofOutline), rather than
 * re-deriving the pitch/direction trigonometry independently, so the cut
 * geometry can never drift from what the canopy actually looks like.
 */
export function deriveRoofPlaneGeometry(footprint: Vector3Mm[], roofPlane: RoofPlaneSlope): RoofPlaneGeometry {
  const outline = deriveRoofOutline(footprint, roofPlane);
  const [p0, p1, p2] = outline;
  if (!p0 || !p1 || !p2) {
    throw new Error("Cannot derive roof plane geometry: outline needs at least 3 points.");
  }
  const normal = normalize(cross(subtract(p1, p0), subtract(p2, p0)));
  const oriented = normal.z < 0 ? { x: -normal.x, y: -normal.y, z: -normal.z } : normal;
  return { point: p0, normal: oriented };
}

export function isPointOnRoofPlane(geometry: RoofPlaneGeometry, point: Vector3Mm, toleranceMm: number): boolean {
  const distance = Math.abs(dot(subtract(point, geometry.point), geometry.normal));
  return distance <= toleranceMm;
}

/** Transforms the canonical roof plane into a member's local frame and canonicalizes it into an end cut. */
export function roofPlaneEndCut(frame: MemberFrame, endSign: EndSign, geometry: RoofPlaneGeometry): PlaneTrimResult {
  const point = worldToLocal(frame, geometry.point);
  const normal = worldDirectionToLocal(frame, geometry.normal);
  return planeTrimCut({ point, normal }, endSign);
}
