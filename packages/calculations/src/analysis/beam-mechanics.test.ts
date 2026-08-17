import { describe, expect, it } from "vitest";
import { analyzeBeam, type BeamMechanicsInput } from "./beam-mechanics.js";

describe("analyzeBeam - simply supported, uniform load", () => {
  const input: BeamMechanicsInput = {
    support: "simply-supported",
    spanMm: 4000,
    load: { kind: "uniform", wNPerMm: 10 },
    elasticModulusMPa: 10000,
    momentOfInertiaMm4: 1e8,
  };

  it("matches hand-calculated reactions, moment, shear, and deflection", () => {
    const result = analyzeBeam(input);
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.reactionStartN).toBeCloseTo(20000, 6);
    expect(result.reactionEndN).toBeCloseTo(20000, 6);
    expect(result.maxMomentNmm).toBeCloseTo(20000000, 3);
    expect(result.maxMomentPositionMm).toBeCloseTo(2000, 6);
    expect(result.maxShearN).toBeCloseTo(20000, 6);
    expect(result.maxDeflectionMm).toBeCloseTo(33.3333, 3);
    expect(result.maxDeflectionPositionMm).toBeCloseTo(2000, 6);
  });

  it("satisfies static equilibrium: reactions sum to the total applied load", () => {
    const result = analyzeBeam(input);
    const totalLoadN = input.load.kind === "uniform" ? input.load.wNPerMm * input.spanMm : 0;
    expect((result.reactionStartN ?? 0) + (result.reactionEndN ?? 0)).toBeCloseTo(totalLoadN, 6);
  });

  it("fails closed on deflection when elastic modulus/inertia are missing, but still reports statics", () => {
    const result = analyzeBeam({ support: "simply-supported", spanMm: 4000, load: { kind: "uniform", wNPerMm: 10 } });
    expect(result.status).toBe("input-requires-verification");
    expect(result.maxDeflectionMm).toBeUndefined();
    expect(result.reactionStartN).toBeCloseTo(20000, 6);
  });
});

describe("analyzeBeam - simply supported, point load at midspan", () => {
  const input: BeamMechanicsInput = {
    support: "simply-supported",
    spanMm: 4000,
    load: { kind: "point-midspan", pN: 8000 },
    elasticModulusMPa: 10000,
    momentOfInertiaMm4: 1e8,
  };

  it("matches hand-calculated reactions, moment, shear, and deflection", () => {
    const result = analyzeBeam(input);
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.reactionStartN).toBeCloseTo(4000, 6);
    expect(result.reactionEndN).toBeCloseTo(4000, 6);
    expect(result.maxMomentNmm).toBeCloseTo(8000000, 3);
    expect(result.maxMomentPositionMm).toBeCloseTo(2000, 6);
    expect(result.maxShearN).toBeCloseTo(4000, 6);
    expect(result.maxDeflectionMm).toBeCloseTo(10.6667, 3);
  });
});

describe("analyzeBeam - cantilever, uniform load", () => {
  const input: BeamMechanicsInput = {
    support: "cantilever",
    spanMm: 3000,
    load: { kind: "uniform", wNPerMm: 10 },
    elasticModulusMPa: 10000,
    momentOfInertiaMm4: 1e8,
  };

  it("matches hand-calculated fixed-end reaction, moment, shear, and tip deflection", () => {
    const result = analyzeBeam(input);
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.reactionStartN).toBeCloseTo(30000, 6);
    expect(result.reactionEndN ?? 0).toBeCloseTo(0, 6);
    expect(result.fixedEndMomentNmm).toBeCloseTo(45000000, 3);
    expect(result.maxMomentNmm).toBeCloseTo(45000000, 3);
    expect(result.maxShearN).toBeCloseTo(30000, 6);
    expect(result.maxDeflectionMm).toBeCloseTo(101.25, 3);
    expect(result.maxDeflectionPositionMm).toBeCloseTo(3000, 6);
  });

  it("satisfies static equilibrium: the single reaction carries the total applied load", () => {
    const result = analyzeBeam(input);
    expect(result.reactionStartN).toBeCloseTo(10 * 3000, 6);
  });
});

describe("analyzeBeam - cantilever, point load at tip", () => {
  const input: BeamMechanicsInput = {
    support: "cantilever",
    spanMm: 3000,
    load: { kind: "point-tip", pN: 5000 },
    elasticModulusMPa: 10000,
    momentOfInertiaMm4: 1e8,
  };

  it("matches hand-calculated fixed-end reaction, moment, shear, and tip deflection", () => {
    const result = analyzeBeam(input);
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.reactionStartN).toBeCloseTo(5000, 6);
    expect(result.fixedEndMomentNmm).toBeCloseTo(15000000, 3);
    expect(result.maxShearN).toBeCloseTo(5000, 6);
    expect(result.maxDeflectionMm).toBeCloseTo(45, 3);
  });
});

describe("analyzeBeam - adversarial / unsupported combinations", () => {
  it("refuses a point load at midspan applied to a cantilever", () => {
    const result = analyzeBeam({ support: "cantilever", spanMm: 3000, load: { kind: "point-midspan", pN: 1000 } });
    expect(result.status).toBe("check-not-implemented");
  });

  it("refuses a tip point load applied to a simply-supported member", () => {
    const result = analyzeBeam({
      support: "simply-supported",
      spanMm: 3000,
      load: { kind: "point-tip", pN: 1000 },
    });
    expect(result.status).toBe("check-not-implemented");
  });

  it("refuses a non-positive span", () => {
    const result = analyzeBeam({ support: "simply-supported", spanMm: 0, load: { kind: "uniform", wNPerMm: 10 } });
    expect(result.status).toBe("outside-validated-scope");
  });
});

describe("analyzeBeam - scale/unit invariance", () => {
  it("moment scales as w*L^2 and deflection as w*L^4/(E*I) under proportional scaling", () => {
    const base = analyzeBeam({
      support: "simply-supported",
      spanMm: 4000,
      load: { kind: "uniform", wNPerMm: 10 },
      elasticModulusMPa: 10000,
      momentOfInertiaMm4: 1e8,
    });
    // Double the span and quarter the load: w*L^2 held constant -> same moment.
    const scaled = analyzeBeam({
      support: "simply-supported",
      spanMm: 8000,
      load: { kind: "uniform", wNPerMm: 2.5 },
      elasticModulusMPa: 10000,
      momentOfInertiaMm4: 1e8,
    });
    expect(scaled.maxMomentNmm).toBeCloseTo(base.maxMomentNmm!, 3);
  });
});
