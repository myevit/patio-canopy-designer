import type { AnalysisStatus } from "./status.js";

export interface ConnectionDemandInput {
  jointId: string;
  shearN?: number;
  axialN?: number;
  upliftN?: number;
  momentNmm?: number;
}

export interface ConnectionDemandReport {
  status: AnalysisStatus;
  reason?: string;
  jointId: string;
  shearN?: number;
  axialN?: number;
  upliftN?: number;
  momentNmm?: number;
  /** Always present: reports the magnitude a connector must resist, never approves or selects a connector. */
  disclaimer: string;
}

const CONNECTOR_DISCLAIMER =
  "This reports the shear/axial/uplift/moment magnitude a connector must resist. It is not a connector selection or approval; connector adequacy is engineer-review-required.";

/** Connection demand reporting: the magnitudes a connector must resist, never an approval of the connector itself. */
export function reportConnectionDemand(input: ConnectionDemandInput): ConnectionDemandReport {
  const { jointId, shearN, axialN, upliftN, momentNmm } = input;
  const hasAnyDemand = [shearN, axialN, upliftN, momentNmm].some((v) => v !== undefined);

  if (!hasAnyDemand) {
    return {
      status: "input-requires-verification",
      reason: "No demand magnitude was supplied for this connection.",
      jointId,
      disclaimer: CONNECTOR_DISCLAIMER,
    };
  }

  return {
    status: "calculated-within-stated-assumptions",
    jointId,
    shearN,
    axialN,
    upliftN,
    momentNmm,
    disclaimer: CONNECTOR_DISCLAIMER,
  };
}
