import { describe, expect, it } from "vitest";
import { checkPostAxialAndMoment } from "./post-axial.js";

describe("checkPostAxialAndMoment", () => {
  const base = {
    axialLoadN: 50000,
    endMomentNmm: 3000000,
    unbracedLengthMm: 2400,
    sectionWidthMm: 140,
    sectionHeightMm: 140,
  };

  it("computes axial stress, bending stress, and a linear interaction ratio from explicit allowables", () => {
    const result = checkPostAxialAndMoment({
      ...base,
      allowableCompressionStressMPa: 8,
      allowableBendingStressMPa: 10,
    });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.axialStressMPa).toBeCloseTo(2.551, 2);
    expect(result.bendingStressMPa).toBeCloseTo(6.56, 2);
    expect(result.interactionRatio).toBeCloseTo(0.975, 2);
  });

  it("fails closed when the unbraced length is not declared", () => {
    const result = checkPostAxialAndMoment({
      ...base,
      unbracedLengthMm: undefined,
      allowableCompressionStressMPa: 8,
      allowableBendingStressMPa: 10,
    });
    expect(result.status).toBe("input-requires-verification");
    expect(result.reason).toMatch(/unbraced length/i);
  });

  it("fails closed when allowable stresses are missing, but still reports demand stresses", () => {
    const result = checkPostAxialAndMoment(base);
    expect(result.status).toBe("input-requires-verification");
    expect(result.axialStressMPa).toBeCloseTo(2.551, 2);
    expect(result.interactionRatio).toBeUndefined();
  });
});
