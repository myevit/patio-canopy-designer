import type { LocalVector } from "./member-frame.js";

/**
 * -1 for the member's start (end A), +1 for the member's end (end B). This is
 * the sign convention every constructor below uses to seed the "square"
 * normal before any miter/bevel rotation is applied.
 */
export type EndSign = 1 | -1;

export type EndCutKind = "square" | "miter" | "bevel" | "compound" | "plane-trim";

/**
 * A cut face expressed entirely in a member's local frame: the plane crosses
 * the member axis (v=0, w=0) at `axisU`, with unit normal `normalLocal`. Any
 * point+normal plane can be canonicalized to this form (see planeTrimCut),
 * so every end cut - however it was constructed - shares one representation
 * for length/angle derivation.
 */
export interface EndCutPlane {
  axisU: number;
  normalLocal: LocalVector;
  kind: EndCutKind;
}

function rotateAboutW(vector: LocalVector, angleRad: number): LocalVector {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { u: vector.u * cos - vector.v * sin, v: vector.u * sin + vector.v * cos, w: vector.w };
}

function rotateAboutV(vector: LocalVector, angleRad: number): LocalVector {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { u: vector.u * cos - vector.w * sin, v: vector.v, w: vector.u * sin + vector.w * cos };
}

/** A face perpendicular to the member axis. */
export function squareCut(axisU: number, endSign: EndSign): EndCutPlane {
  return { axisU, normalLocal: { u: endSign, v: 0, w: 0 }, kind: "square" };
}

/** A face rotated about the section's w-axis (e.g. a plan-view corner miter). */
export function miterCut(axisU: number, miterRad: number, endSign: EndSign): EndCutPlane {
  return { axisU, normalLocal: rotateAboutW({ u: endSign, v: 0, w: 0 }, miterRad), kind: "miter" };
}

/** A face rotated about the section's v-axis (e.g. a roof-slope plumb/bevel cut). */
export function bevelCut(axisU: number, bevelRad: number, endSign: EndSign): EndCutPlane {
  return { axisU, normalLocal: rotateAboutV({ u: endSign, v: 0, w: 0 }, bevelRad), kind: "bevel" };
}

/** A face combining a miter (about w) and a bevel (about v) rotation. */
export function compoundCut(axisU: number, miterRad: number, bevelRad: number, endSign: EndSign): EndCutPlane {
  const square: LocalVector = { u: endSign, v: 0, w: 0 };
  const normalLocal = rotateAboutV(rotateAboutW(square, miterRad), bevelRad);
  return { axisU, normalLocal, kind: "compound" };
}

export interface LocalPlane {
  point: LocalVector;
  normal: LocalVector;
}

export type PlaneTrimResult = { ok: true; cut: EndCutPlane } | { ok: false; error: string };

/** Minimum |normal.u| for a plane to be considered non-parallel to the member axis. */
const AXIS_PARALLEL_EPSILON = 1e-9;

/**
 * Canonicalizes an arbitrary point+normal plane (e.g. a roof plane
 * transformed into member-local coordinates) to the axisU/normal form every
 * other cut constructor produces, by solving for where the plane crosses the
 * member's centreline (v=0, w=0).
 */
export function planeTrimCut(plane: LocalPlane, endSign: EndSign): PlaneTrimResult {
  const { point, normal } = plane;
  if (Math.abs(normal.u) < AXIS_PARALLEL_EPSILON) {
    return { ok: false, error: "Cut plane is parallel to the member axis and never closes off the member." };
  }
  const axisU = point.u + (normal.v * point.v + normal.w * point.w) / normal.u;
  const oriented = normal.u * endSign < 0 ? { u: -normal.u, v: -normal.v, w: -normal.w } : normal;
  return { ok: true, cut: { axisU, normalLocal: oriented, kind: "plane-trim" } };
}

/** The axial position (local u) where the cut plane crosses the fiber line running through cross-section point (v, w). */
export function cornerAxisU(cut: EndCutPlane, v: number, w: number): number {
  return cut.axisU - (cut.normalLocal.v * v + cut.normalLocal.w * w) / cut.normalLocal.u;
}

export interface MiterBevel {
  miterRad: number;
  bevelRad: number;
}

/**
 * Inverse of the miter/bevel composition: recovers the miter (rotation about
 * w) and bevel (rotation about v) angles that would produce `normalLocal`
 * from the given end's square normal. Valid for cuts within +/-90 degrees of
 * square, which covers every practical fabrication angle.
 */
export function decomposeMiterBevel(normalLocal: LocalVector, endSign: EndSign): MiterBevel {
  const a = normalLocal.u * endSign;
  const b = normalLocal.v * endSign;
  const c = normalLocal.w * endSign;
  return {
    miterRad: Math.atan2(b, Math.hypot(a, c)),
    bevelRad: Math.atan2(c, a),
  };
}
