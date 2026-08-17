import { describe, expect, it } from "vitest";
import { bevelCut, compoundCut, miterCut, squareCut } from "./end-cuts.js";
import { trimMember } from "./member-trim.js";

const SECTION_WIDTH_MM = 89;
const SECTION_HEIGHT_MM = 38;

describe("trimMember", () => {
  it("computes the finished length between two square cuts and reports zero-offset long/short points", () => {
    const endA = squareCut(0, -1);
    const endB = squareCut(3000, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);

    expect(trimmed.finishedLengthMm).toBeCloseTo(3000, 9);
    expect(trimmed.endA.kind).toBe("square");
    expect(trimmed.endA.miterRad).toBeCloseTo(0, 9);
    expect(trimmed.endA.bevelRad).toBeCloseTo(0, 9);
    expect(trimmed.endB.miterRad).toBeCloseTo(0, 9);
    expect(trimmed.endB.bevelRad).toBeCloseTo(0, 9);
    // Square cuts: every corner sits at the same axial position, so long point == short point == finished length.
    expect(trimmed.longPointMm).toBeCloseTo(3000, 9);
    expect(trimmed.shortPointMm).toBeCloseTo(3000, 9);
    expect(trimmed.isNearZeroLength).toBe(false);
  });

  it("reports a wider long/short point spread for a miter cut than a square cut", () => {
    const endA = squareCut(0, -1);
    const endB = miterCut(3000, (30 * Math.PI) / 180, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);

    expect(trimmed.finishedLengthMm).toBeCloseTo(3000, 9);
    expect(trimmed.endB.kind).toBe("miter");
    expect(trimmed.endB.miterRad).toBeCloseTo((30 * Math.PI) / 180, 9);
    expect(trimmed.longPointMm).toBeGreaterThan(trimmed.finishedLengthMm);
    expect(trimmed.shortPointMm).toBeLessThan(trimmed.finishedLengthMm);
    // The spread is symmetric about the centreline reference length.
    expect(trimmed.longPointMm - trimmed.finishedLengthMm).toBeCloseTo(trimmed.finishedLengthMm - trimmed.shortPointMm, 6);
  });

  it("reports a spread for a bevel cut along the height axis instead of the width axis", () => {
    const endA = squareCut(0, -1);
    const endB = bevelCut(3000, (15 * Math.PI) / 180, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);

    const expectedSpread = (SECTION_HEIGHT_MM / 2) * Math.tan((15 * Math.PI) / 180);
    expect(trimmed.longPointMm - trimmed.finishedLengthMm).toBeCloseTo(expectedSpread, 6);
    expect(trimmed.finishedLengthMm - trimmed.shortPointMm).toBeCloseTo(expectedSpread, 6);
  });

  it("supports a compound miter+bevel cut at one end and a square cut at the other", () => {
    const endA = squareCut(0, -1);
    const endB = compoundCut(2400, (20 * Math.PI) / 180, (10 * Math.PI) / 180, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);

    expect(trimmed.endB.kind).toBe("compound");
    expect(trimmed.endB.miterRad).toBeCloseTo((20 * Math.PI) / 180, 6);
    expect(trimmed.endB.bevelRad).toBeCloseTo((10 * Math.PI) / 180, 6);
    expect(trimmed.longPointMm).toBeGreaterThan(trimmed.finishedLengthMm);
    expect(trimmed.shortPointMm).toBeLessThan(trimmed.finishedLengthMm);
  });

  it("flags a near-zero-length member instead of reporting a spurious finished length", () => {
    const endA = squareCut(0, -1);
    const endB = squareCut(0.5, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);
    expect(trimmed.isNearZeroLength).toBe(true);
  });

  it("flags a near-zero-length member when the end planes are inverted", () => {
    const endA = squareCut(1000, -1);
    const endB = squareCut(500, 1);
    const trimmed = trimMember(SECTION_WIDTH_MM, SECTION_HEIGHT_MM, endA, endB);
    expect(trimmed.isNearZeroLength).toBe(true);
  });
});
