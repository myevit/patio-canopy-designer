import { describe, expect, it } from "vitest";
import {
  computeSelfWeightLoad,
  computeTributaryWidthMm,
  computeSurfaceLoad,
  type MaterialUnitWeightInput,
  type RectangularPanel,
} from "./loads.js";

describe("computeSelfWeightLoad", () => {
  const section = { widthMm: 100, heightMm: 200 };

  it("computes a distributed self-weight load from an explicit user-entered specific weight", () => {
    const unitWeights: MaterialUnitWeightInput[] = [
      { materialId: "spf-2", specificWeightNPerMm3: 5e-6, provenance: { source: "user-entered", label: "User material unit weight" } },
    ];
    const result = computeSelfWeightLoad(section, "spf-2", unitWeights);
    expect(result.status).toBe("calculated-within-stated-assumptions");
    // 100 * 200 * 5e-6 = 0.1 N/mm
    expect(result.load?.distributionNPerMm).toBeCloseTo(0.1, 9);
    expect(result.load?.kind).toBe("self-weight");
    expect(result.load?.provenance.source).toBe("computed-self-weight");
  });

  it("fails closed when no material id is given", () => {
    const result = computeSelfWeightLoad(section, undefined, []);
    expect(result.status).toBe("input-requires-verification");
    expect(result.load).toBeUndefined();
  });

  it("fails closed when the material has no user-entered unit weight", () => {
    const result = computeSelfWeightLoad(section, "unknown-material", []);
    expect(result.status).toBe("input-requires-verification");
    expect(result.load).toBeUndefined();
  });
});

describe("computeTributaryWidthMm", () => {
  it("splits an explicit rectangular panel evenly among interior members", () => {
    const panel: RectangularPanel = { widthMm: 3000, memberCount: 3, edgeMember: false };
    expect(computeTributaryWidthMm(panel)).toBeCloseTo(1000, 9);
  });

  it("halves the share for an edge member", () => {
    const panel: RectangularPanel = { widthMm: 3000, memberCount: 3, edgeMember: true };
    expect(computeTributaryWidthMm(panel)).toBeCloseTo(500, 9);
  });
});

describe("computeSurfaceLoad", () => {
  it("converts a user-entered pressure and tributary width into a distributed line load", () => {
    // 1.5 kPa * 1000 mm tributary width = 1.5 N/mm
    const load = computeSurfaceLoad(1.5, 1000, "snow", { source: "user-entered", label: "User snow load" });
    expect(load.distributionNPerMm).toBeCloseTo(1.5, 9);
    expect(load.kind).toBe("snow");
    expect(load.provenance.source).toBe("user-entered");
  });
});
