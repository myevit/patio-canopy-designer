import type { AnalysisStatus } from "./status.js";

export interface BearingCheckInput {
  reactionN: number;
  bearingWidthMm: number;
  bearingLengthMm: number;
  allowableBearingStressMPa?: number;
}

export interface BearingCheckResult {
  status: AnalysisStatus;
  reason?: string;
  demandStressMPa?: number;
  ratio?: number;
}

/** Bearing demand from an already-computed reaction over an explicit user-supplied bearing area. */
export function checkBearingDemand(input: BearingCheckInput): BearingCheckResult {
  const { reactionN, bearingWidthMm, bearingLengthMm, allowableBearingStressMPa } = input;
  if (!(bearingWidthMm > 0) || !(bearingLengthMm > 0)) {
    return { status: "outside-validated-scope", reason: "Bearing area must have positive width and length." };
  }
  const demandStressMPa = reactionN / (bearingWidthMm * bearingLengthMm);
  if (allowableBearingStressMPa === undefined) {
    return {
      status: "input-requires-verification",
      reason: "No user-entered allowable bearing stress; demand stress computed but not compared.",
      demandStressMPa,
    };
  }
  return {
    status: "calculated-within-stated-assumptions",
    demandStressMPa,
    ratio: demandStressMPa / allowableBearingStressMPa,
  };
}
