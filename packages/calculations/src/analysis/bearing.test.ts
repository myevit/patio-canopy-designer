import { describe, expect, it } from "vitest";
import { checkBearingDemand } from "./bearing.js";

describe("checkBearingDemand", () => {
  it("computes demand stress and ratio from an explicit user allowable", () => {
    const result = checkBearingDemand({
      reactionN: 20000,
      bearingWidthMm: 100,
      bearingLengthMm: 150,
      allowableBearingStressMPa: 2,
    });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    // 20000 / (100*150) = 1.3333 MPa
    expect(result.demandStressMPa).toBeCloseTo(1.3333, 3);
    expect(result.ratio).toBeCloseTo(0.6667, 3);
  });

  it("fails closed when no allowable bearing stress is supplied, but still reports demand", () => {
    const result = checkBearingDemand({ reactionN: 20000, bearingWidthMm: 100, bearingLengthMm: 150 });
    expect(result.status).toBe("input-requires-verification");
    expect(result.demandStressMPa).toBeCloseTo(1.3333, 3);
    expect(result.ratio).toBeUndefined();
  });

  it("refuses a non-positive bearing area", () => {
    const result = checkBearingDemand({ reactionN: 20000, bearingWidthMm: 0, bearingLengthMm: 150 });
    expect(result.status).toBe("outside-validated-scope");
  });
});
