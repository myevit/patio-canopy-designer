import { rectSectionAreaMm2, rectSectionIMm4 } from "./section-properties.js";
import type { AnalysisStatus } from "./status.js";

export interface PostAxialCheckInput {
  axialLoadN: number;
  endMomentNmm: number;
  /** Declared unbraced length; required input, not used to derive a slenderness reduction here. */
  unbracedLengthMm?: number;
  sectionWidthMm: number;
  sectionHeightMm: number;
  /** Must already account for whatever slenderness/unbraced-length effects apply; never derived by this check. */
  allowableCompressionStressMPa?: number;
  allowableBendingStressMPa?: number;
}

export interface PostAxialCheckResult {
  status: AnalysisStatus;
  reason?: string;
  axialStressMPa?: number;
  bendingStressMPa?: number;
  /** Simple linear superposition of demand/allowable ratios; not a code slenderness/amplification equation. */
  interactionRatio?: number;
}

/**
 * Post axial load plus a prescribed end moment: demand-only superposition of
 * axial and bending stress. The declared unbraced length is a required
 * input (its effect on allowable compression must already be captured in
 * the user-supplied allowable), never computed from a bundled equation.
 */
export function checkPostAxialAndMoment(input: PostAxialCheckInput): PostAxialCheckResult {
  const {
    axialLoadN,
    endMomentNmm,
    unbracedLengthMm,
    sectionWidthMm,
    sectionHeightMm,
    allowableCompressionStressMPa,
    allowableBendingStressMPa,
  } = input;

  if (unbracedLengthMm === undefined || !(unbracedLengthMm > 0)) {
    return {
      status: "input-requires-verification",
      reason: "Declared unbraced length is required before an axial-plus-moment demand can be reported.",
    };
  }

  const areaMm2 = rectSectionAreaMm2(sectionWidthMm, sectionHeightMm);
  const iMm4 = rectSectionIMm4(sectionWidthMm, sectionHeightMm);
  const axialStressMPa = axialLoadN / areaMm2;
  const bendingStressMPa = (endMomentNmm * (sectionHeightMm / 2)) / iMm4;

  if (allowableCompressionStressMPa === undefined || allowableBendingStressMPa === undefined) {
    return {
      status: "input-requires-verification",
      reason: "Allowable compression and bending stresses are required to compute an interaction ratio.",
      axialStressMPa,
      bendingStressMPa,
    };
  }

  return {
    status: "calculated-within-stated-assumptions",
    axialStressMPa,
    bendingStressMPa,
    interactionRatio: axialStressMPa / allowableCompressionStressMPa + bendingStressMPa / allowableBendingStressMPa,
  };
}
