import { formatLengthMm, type DisplayLengthUnit } from "@canopy/shared";
import type { Point2D } from "./cut-diagram-layout.js";
import { projectPoint, type ProjectionPlane } from "./blueprint-projection.js";
import type { PhysicalMember } from "./resolve-physical-members.js";

export interface MemberLengthDimension {
  memberId: string;
  a: Point2D;
  b: Point2D;
  valueMm: number;
  label: string;
}

/**
 * A member's length callout, sourced directly from its already-validated
 * trimmed finished length (never re-measured from the projected drawing,
 * which would be foreshortened for any non-plan-parallel member).
 */
export function buildMemberLengthDimension(
  member: PhysicalMember,
  plane: ProjectionPlane,
  displayUnits: DisplayLengthUnit,
): MemberLengthDimension {
  const valueMm = member.trimmed.finishedLengthMm;
  return {
    memberId: member.id,
    a: projectPoint(member.startMm, plane),
    b: projectPoint(member.endMm, plane),
    valueMm,
    label: formatLengthMm(valueMm, displayUnits),
  };
}

export interface OverallDimension {
  axis: "x" | "y";
  a: Point2D;
  b: Point2D;
  valueMm: number;
  label: string;
}

/**
 * An overall bounding-box span across a set of already-projected sheet
 * points, held at a fixed offset on the other axis - an analytic
 * measurement of the drawing itself, not a hand-copied label.
 */
export function buildOverallDimension(
  points: Point2D[],
  axis: "x" | "y",
  atCoordinate: number,
  displayUnits: DisplayLengthUnit,
): OverallDimension {
  const values = points.map((p) => (axis === "x" ? p.x : p.y));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueMm = max - min;
  const a: Point2D = axis === "x" ? { x: min, y: atCoordinate } : { x: atCoordinate, y: min };
  const b: Point2D = axis === "x" ? { x: max, y: atCoordinate } : { x: atCoordinate, y: max };
  return { axis, a, b, valueMm, label: formatLengthMm(valueMm, displayUnits) };
}
