import { describe, expect, it } from "vitest";
import { rectSectionAreaMm2, rectSectionIMm4 } from "./section-properties.js";

describe("rectSectionAreaMm2", () => {
  it("computes width times height", () => {
    expect(rectSectionAreaMm2(140, 140)).toBeCloseTo(19600, 6);
    expect(rectSectionAreaMm2(184, 38)).toBeCloseTo(6992, 6);
  });
});

describe("rectSectionIMm4", () => {
  it("computes b*h^3/12 about the axis perpendicular to the given height", () => {
    // Hand check: 140 * 140^3 / 12 = 32,013,333.33...
    expect(rectSectionIMm4(140, 140)).toBeCloseTo(32013333.33, 1);
    // Hand check: 100 * 200^3 / 12 = 66,666,666.67
    expect(rectSectionIMm4(100, 200)).toBeCloseTo(66666666.67, 1);
  });
});
