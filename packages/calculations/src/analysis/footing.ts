import type { AnalysisStatus } from "./status.js";

export interface FootingCheckInput {
  reactionCompressionN: number;
  footingWidthMm: number;
  footingLengthMm: number;
  /** User-supplied geotechnical bearing capacity; never looked up from a bundled table. */
  allowableBearingCapacityKPa?: number;
  upliftDemandN?: number;
  upliftResistanceN?: number;
}

export interface FootingCheckResult {
  status: AnalysisStatus;
  reason?: string;
  bearingDemandKPa?: number;
  bearingRatio?: number;
  upliftRatio?: number;
}

/** Preliminary footing bearing/uplift demand from user-supplied geotechnical capacities. */
export function checkFootingBearingAndUplift(input: FootingCheckInput): FootingCheckResult {
  const {
    reactionCompressionN,
    footingWidthMm,
    footingLengthMm,
    allowableBearingCapacityKPa,
    upliftDemandN,
    upliftResistanceN,
  } = input;

  if (!(footingWidthMm > 0) || !(footingLengthMm > 0)) {
    return { status: "outside-validated-scope", reason: "Footing area must have positive width and length." };
  }

  const areaMm2 = footingWidthMm * footingLengthMm;
  // N/mm^2 (MPa) * 1000 = kPa
  const bearingDemandKPa = (reactionCompressionN / areaMm2) * 1000;

  const missingBearingCapacity = allowableBearingCapacityKPa === undefined;
  const upliftDeclaredWithoutResistance = upliftDemandN !== undefined && upliftResistanceN === undefined;

  if (missingBearingCapacity || upliftDeclaredWithoutResistance) {
    return {
      status: "input-requires-verification",
      reason: missingBearingCapacity
        ? "No user-supplied geotechnical bearing capacity; demand computed but not compared."
        : "Uplift demand declared without a user-supplied uplift resistance.",
      bearingDemandKPa,
      upliftRatio: undefined,
    };
  }

  const upliftRatio =
    upliftDemandN !== undefined && upliftResistanceN !== undefined ? upliftDemandN / upliftResistanceN : undefined;

  return {
    status: "calculated-within-stated-assumptions",
    bearingDemandKPa,
    bearingRatio: bearingDemandKPa / (allowableBearingCapacityKPa as number),
    upliftRatio,
  };
}
