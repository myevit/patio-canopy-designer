import { NEAR_ZERO_LENGTH_MM } from "@canopy/shared";
import { cornerAxisU, decomposeMiterBevel, type EndCutKind, type EndCutPlane } from "./end-cuts.js";

export interface EndCutReport {
  kind: EndCutKind;
  miterRad: number;
  bevelRad: number;
}

export interface TrimmedMember {
  /** Physical length between the two end-cut planes' axis intersections, i.e. the trimmed centreline length. */
  finishedLengthMm: number;
  endA: EndCutReport;
  endB: EndCutReport;
  /** The longest edge of the finished piece across all four section corners. Equals finishedLengthMm for two square cuts. */
  longPointMm: number;
  /** The shortest edge of the finished piece across all four section corners. Equals finishedLengthMm for two square cuts. */
  shortPointMm: number;
  isNearZeroLength: boolean;
}

export function trimMember(
  sectionWidthMm: number,
  sectionHeightMm: number,
  endA: EndCutPlane,
  endB: EndCutPlane,
): TrimmedMember {
  const finishedLengthMm = endB.axisU - endA.axisU;

  const halfWidth = sectionWidthMm / 2;
  const halfHeight = sectionHeightMm / 2;
  const corners: Array<[number, number]> = [
    [halfWidth, halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, halfHeight],
    [-halfWidth, -halfHeight],
  ];
  const cornerLengths = corners.map(([v, w]) => cornerAxisU(endB, v, w) - cornerAxisU(endA, v, w));

  return {
    finishedLengthMm,
    endA: { kind: endA.kind, ...decomposeMiterBevel(endA.normalLocal, -1) },
    endB: { kind: endB.kind, ...decomposeMiterBevel(endB.normalLocal, 1) },
    longPointMm: Math.max(...cornerLengths),
    shortPointMm: Math.min(...cornerLengths),
    isNearZeroLength: finishedLengthMm < NEAR_ZERO_LENGTH_MM,
  };
}
