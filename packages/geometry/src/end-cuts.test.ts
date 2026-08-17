import { describe, expect, it } from "vitest";
import {
  bevelCut,
  compoundCut,
  decomposeMiterBevel,
  miterCut,
  planeTrimCut,
  squareCut,
} from "./end-cuts.js";

describe("squareCut", () => {
  it("is perpendicular to the member axis at the given axisU", () => {
    const cut = squareCut(1000, 1);
    expect(cut.axisU).toBe(1000);
    expect(cut.normalLocal).toEqual({ u: 1, v: 0, w: 0 });
    expect(cut.kind).toBe("square");
  });

  it("flips sign for the opposite end", () => {
    const cut = squareCut(0, -1);
    expect(cut.normalLocal).toEqual({ u: -1, v: 0, w: 0 });
  });
});

describe("miterCut", () => {
  it("rotates the normal in the u-v plane by the miter angle", () => {
    const cut = miterCut(1000, Math.PI / 4, 1);
    expect(cut.kind).toBe("miter");
    expect(cut.normalLocal.u).toBeCloseTo(Math.SQRT1_2, 9);
    expect(cut.normalLocal.v).toBeCloseTo(Math.SQRT1_2, 9);
    expect(cut.normalLocal.w).toBeCloseTo(0, 9);
  });

  it("round-trips through decomposeMiterBevel", () => {
    const cut = miterCut(500, (30 * Math.PI) / 180, 1);
    const { miterRad, bevelRad } = decomposeMiterBevel(cut.normalLocal, 1);
    expect(miterRad).toBeCloseTo((30 * Math.PI) / 180, 9);
    expect(bevelRad).toBeCloseTo(0, 9);
  });
});

describe("bevelCut", () => {
  it("rotates the normal in the u-w plane by the bevel angle", () => {
    const cut = bevelCut(1000, Math.PI / 4, 1);
    expect(cut.kind).toBe("bevel");
    expect(cut.normalLocal.u).toBeCloseTo(Math.SQRT1_2, 9);
    expect(cut.normalLocal.v).toBeCloseTo(0, 9);
    expect(cut.normalLocal.w).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it("round-trips through decomposeMiterBevel", () => {
    const cut = bevelCut(500, (15 * Math.PI) / 180, 1);
    const { miterRad, bevelRad } = decomposeMiterBevel(cut.normalLocal, 1);
    expect(miterRad).toBeCloseTo(0, 9);
    expect(bevelRad).toBeCloseTo((15 * Math.PI) / 180, 9);
  });
});

describe("compoundCut", () => {
  it("combines a miter and a bevel rotation and round-trips both angles", () => {
    const miterRad = (20 * Math.PI) / 180;
    const bevelRad = (10 * Math.PI) / 180;
    const cut = compoundCut(750, miterRad, bevelRad, 1);
    expect(cut.kind).toBe("compound");
    const decomposed = decomposeMiterBevel(cut.normalLocal, 1);
    expect(decomposed.miterRad).toBeCloseTo(miterRad, 9);
    expect(decomposed.bevelRad).toBeCloseTo(bevelRad, 9);
  });

  it("reduces to a square cut when both angles are zero", () => {
    const cut = compoundCut(300, 0, 0, -1);
    expect(cut.normalLocal).toEqual({ u: -1, v: 0, w: 0 });
  });
});

describe("planeTrimCut", () => {
  it("canonicalizes an arbitrary point+normal plane to its axis intersection", () => {
    const result = planeTrimCut({ point: { u: 900, v: 50, w: 0 }, normal: { u: 1, v: 0, w: 0 } }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    // Normal has no v/w component, so the plane crosses the axis at the same u as the given point.
    expect(result.cut.axisU).toBeCloseTo(900, 9);
    expect(result.cut.kind).toBe("plane-trim");
  });

  it("solves for the axis crossing when the plane is tilted", () => {
    // Plane through (900, 50, 0) with a normal tilted 45 degrees in u-v.
    const normal = { u: Math.SQRT1_2, v: Math.SQRT1_2, w: 0 };
    const result = planeTrimCut({ point: { u: 900, v: 50, w: 0 }, normal }, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    // u = pu + (nv*pv + nw*pw)/nu = 900 + (SQRT1_2*50)/SQRT1_2 = 950
    expect(result.cut.axisU).toBeCloseTo(950, 9);
  });

  it("rejects a plane parallel to the member axis", () => {
    const result = planeTrimCut({ point: { u: 500, v: 0, w: 0 }, normal: { u: 0, v: 1, w: 0 } }, 1);
    expect(result.ok).toBe(false);
  });
});

describe("decomposeMiterBevel", () => {
  it("reports zero angles for a square cut", () => {
    const { miterRad, bevelRad } = decomposeMiterBevel({ u: 1, v: 0, w: 0 }, 1);
    expect(miterRad).toBeCloseTo(0, 9);
    expect(bevelRad).toBeCloseTo(0, 9);
  });
});
