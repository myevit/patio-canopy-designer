import { describe, expect, it } from "vitest";
import { checkFootingBearingAndUplift } from "./footing.js";

describe("checkFootingBearingAndUplift", () => {
  it("computes bearing demand and ratio from a user-supplied geotechnical capacity", () => {
    const result = checkFootingBearingAndUplift({
      reactionCompressionN: 20000,
      footingWidthMm: 600,
      footingLengthMm: 600,
      allowableBearingCapacityKPa: 150,
    });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    // 20000N / 360000mm^2 = 0.055556 MPa = 55.556 kPa
    expect(result.bearingDemandKPa).toBeCloseTo(55.556, 2);
    expect(result.bearingRatio).toBeCloseTo(0.3704, 3);
  });

  it("fails closed when no geotechnical bearing capacity is supplied", () => {
    const result = checkFootingBearingAndUplift({
      reactionCompressionN: 20000,
      footingWidthMm: 600,
      footingLengthMm: 600,
    });
    expect(result.status).toBe("input-requires-verification");
    expect(result.bearingDemandKPa).toBeCloseTo(55.556, 2);
    expect(result.bearingRatio).toBeUndefined();
  });

  it("computes an uplift ratio only when both uplift demand and resistance are declared", () => {
    const result = checkFootingBearingAndUplift({
      reactionCompressionN: 20000,
      footingWidthMm: 600,
      footingLengthMm: 600,
      allowableBearingCapacityKPa: 150,
      upliftDemandN: 4000,
      upliftResistanceN: 8000,
    });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.upliftRatio).toBeCloseTo(0.5, 6);
  });

  it("fails closed when uplift demand is declared without a resistance value", () => {
    const result = checkFootingBearingAndUplift({
      reactionCompressionN: 20000,
      footingWidthMm: 600,
      footingLengthMm: 600,
      allowableBearingCapacityKPa: 150,
      upliftDemandN: 4000,
    });
    expect(result.status).toBe("input-requires-verification");
    expect(result.upliftRatio).toBeUndefined();
  });

  it("refuses a non-positive footing area", () => {
    const result = checkFootingBearingAndUplift({ reactionCompressionN: 20000, footingWidthMm: 0, footingLengthMm: 600 });
    expect(result.status).toBe("outside-validated-scope");
  });
});
