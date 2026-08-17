import type { Anchor, FanDistribution, FanElevationRule, FanTarget, Member } from "./design-schema.js";
import type { Vector3Mm } from "./units.js";

/** Below this length (mm), a target edge or rafter is treated as degenerate. */
const MIN_LENGTH_MM = 1;

function vectorBetween(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function length(v: Vector3Mm): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function lerp(a: Vector3Mm, b: Vector3Mm, t: number): Vector3Mm {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function resolveCount(distribution: FanDistribution, edgeLengthMm: number): number {
  if (distribution.mode === "count") {
    return distribution.count;
  }
  return Math.max(2, Math.floor(edgeLengthMm / distribution.spacingMm) + 1);
}

export interface DeriveFanFieldTargetPositionsInput {
  sourcePosition: Vector3Mm;
  targetStart: Vector3Mm;
  targetEnd: Vector3Mm;
  distribution: FanDistribution;
  reversed: boolean;
  elevationRule: FanElevationRule;
}

export type DeriveFanFieldPositionsResult =
  | { ok: true; points: Vector3Mm[] }
  | { ok: false; error: string };

/**
 * Pure ruled-surface fan geometry: each rafter runs from a fixed source point
 * to a point distributed along the target edge. `elevationRule: parabolic`
 * adds a sag term that is zero at the target edge's endpoints and maximal at
 * its midpoint, so two overlapping fields with opposite-signed sag produce a
 * saddle where their target edge crosses.
 */
export function deriveFanFieldTargetPositions(
  input: DeriveFanFieldTargetPositionsInput,
): DeriveFanFieldPositionsResult {
  const edgeLengthMm = length(vectorBetween(input.targetStart, input.targetEnd));
  if (edgeLengthMm < MIN_LENGTH_MM) {
    return { ok: false, error: "Fan target edge is degenerate (zero-length)." };
  }

  const count = resolveCount(input.distribution, edgeLengthMm);
  if (!Number.isFinite(count) || count < 2) {
    return { ok: false, error: "A fan field needs at least two members." };
  }

  const points: Vector3Mm[] = [];
  for (let i = 0; i < count; i += 1) {
    const rawT = i / (count - 1);
    const t = input.reversed ? 1 - rawT : rawT;
    const base = lerp(input.targetStart, input.targetEnd, t);
    const sag = input.elevationRule.kind === "parabolic" ? input.elevationRule.sagMm * 4 * t * (1 - t) : 0;
    points.push({ x: base.x, y: base.y, z: base.z + sag });
  }

  const hasZeroLengthRafter = points.some(
    (point) => length(vectorBetween(input.sourcePosition, point)) < MIN_LENGTH_MM,
  );
  if (hasZeroLengthRafter) {
    return { ok: false, error: "A fan rafter would be zero-length (source coincides with a target point)." };
  }

  return { ok: true, points };
}

export interface DeriveFanFieldGeometryInput {
  sourceAnchorId: string;
  target: FanTarget;
  distribution: FanDistribution;
  reversed: boolean;
  elevationRule: FanElevationRule;
}

export function deriveFanFieldGeometry(
  input: DeriveFanFieldGeometryInput,
  anchorsById: Map<string, Anchor>,
  membersById: Map<string, Member>,
): DeriveFanFieldPositionsResult {
  const source = anchorsById.get(input.sourceAnchorId);
  if (!source) {
    return { ok: false, error: `Unreachable fan source anchor: ${input.sourceAnchorId}` };
  }

  let targetStartId: string;
  let targetEndId: string;
  if (input.target.kind === "member") {
    const member = membersById.get(input.target.memberId);
    if (!member) {
      return { ok: false, error: `Unreachable fan target member: ${input.target.memberId}` };
    }
    targetStartId = member.startAnchorId;
    targetEndId = member.endAnchorId;
  } else {
    targetStartId = input.target.startAnchorId;
    targetEndId = input.target.endAnchorId;
  }

  if (targetStartId === targetEndId) {
    return { ok: false, error: "Fan target edge needs two different anchors." };
  }

  const targetStart = anchorsById.get(targetStartId);
  if (!targetStart) {
    return { ok: false, error: `Unreachable fan target anchor: ${targetStartId}` };
  }
  const targetEnd = anchorsById.get(targetEndId);
  if (!targetEnd) {
    return { ok: false, error: `Unreachable fan target anchor: ${targetEndId}` };
  }

  return deriveFanFieldTargetPositions({
    sourcePosition: source.positionMm,
    targetStart: targetStart.positionMm,
    targetEnd: targetEnd.positionMm,
    distribution: input.distribution,
    reversed: input.reversed,
    elevationRule: input.elevationRule,
  });
}

/** Deterministic derived member id: stable across regeneration, keyed only by the field id and index. */
export function deriveFanFieldMemberId(fanFieldId: string, index: number): string {
  return `${fanFieldId}::rafter::${index}`;
}

/** Deterministic derived target-anchor id: stable across regeneration, keyed only by the field id and index. */
export function deriveFanFieldTargetAnchorId(fanFieldId: string, index: number): string {
  return `${fanFieldId}::target::${index}`;
}
