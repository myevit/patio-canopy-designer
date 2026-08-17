import { describe, expect, it } from "vitest";
import type { MemberLoadCase } from "./beam-mechanics.js";
import { computeSelfWeightLoad, type MaterialUnitWeightInput } from "./loads.js";
import { analyzedLoadFromApplied, analyzeMember, type AnalyzedLoad } from "./member-analysis.js";
import { freezeAnalysisSnapshot } from "./snapshot.js";
import { BEAM_SECTION_ID, MATERIAL_ID, twoPostFrame } from "./test-fixtures.js";

/** Wraps a bare mechanics load case as a user-entered `AnalyzedLoad` for tests that don't care about provenance content. */
function userLoad(load: MemberLoadCase): AnalyzedLoad {
  return { case: load, kind: "user-defined", provenance: { source: "user-entered", label: "Test load" } };
}

describe("analyzeMember", () => {
  it("analyzes the simply-supported span between two posts under a single uniform load", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, {
      memberId: "beam-1",
      loads: [userLoad({ kind: "uniform", wNPerMm: 10 })],
      elasticModulusMPa: 10000,
      momentOfInertiaMm4: 1e8,
      bearing: { widthMm: 100, lengthMm: 150, allowableStressMPa: 2 },
    });
    expect(report.status).toBe("calculated-within-stated-assumptions");
    expect(report.condition).toBe("simply-supported");
    expect(report.spanMm).toBeCloseTo(4000, 6);
    expect(report.reactionStartN).toBeCloseTo(20000, 6);
    expect(report.reactionEndN).toBeCloseTo(20000, 6);
    expect(report.maxMomentNmm).toBeCloseTo(20000000, 3);
    expect(report.maxDeflectionMm).toBeCloseTo(33.3333, 3);
    expect(report.bearingStart?.status).toBe("calculated-within-stated-assumptions");
    expect(report.bearingEnd?.status).toBe("calculated-within-stated-assumptions");
    expect(report.loadProvenance).toEqual([{ kind: "user-defined", provenance: { source: "user-entered", label: "Test load" } }]);
  });

  it("superposes multiple loads and keeps equilibrium (reactions sum to total applied load)", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, {
      memberId: "beam-1",
      loads: [userLoad({ kind: "uniform", wNPerMm: 4 }), userLoad({ kind: "uniform", wNPerMm: 6 })],
    });
    // Equivalent to a single 10 N/mm uniform load: R = 10*4000/2 = 20000 each.
    expect(report.reactionStartN).toBeCloseTo(20000, 6);
    expect(report.reactionEndN).toBeCloseTo(20000, 6);
    expect(report.maxMomentNmm).toBeCloseTo(20000000, 3);
    expect(report.loadProvenance).toHaveLength(2);
  });

  it("keeps each load's own provenance distinct in the report (computed self-weight alongside a user-entered load)", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const selfWeightLoad: AnalyzedLoad = {
      case: { kind: "uniform", wNPerMm: 0.1 },
      kind: "self-weight",
      provenance: { source: "computed-self-weight", label: "Computed from section geometry and user-entered specific weight" },
    };
    const report = analyzeMember(snapshot, {
      memberId: "beam-1",
      loads: [selfWeightLoad, userLoad({ kind: "uniform", wNPerMm: 10 })],
    });
    expect(report.loadProvenance).toEqual([
      { kind: "self-weight", provenance: selfWeightLoad.provenance },
      { kind: "user-defined", provenance: { source: "user-entered", label: "Test load" } },
    ]);
  });

  it("wires computeSelfWeightLoad's output straight into analyzeMember, preserving its computed-self-weight provenance", () => {
    const document = twoPostFrame();
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const beamSection = document.sections.find((s) => s.id === BEAM_SECTION_ID)!;
    const unitWeights: MaterialUnitWeightInput[] = [
      { materialId: MATERIAL_ID, specificWeightNPerMm3: 5e-6, provenance: { source: "user-entered", label: "User material unit weight" } },
    ];
    const selfWeight = computeSelfWeightLoad(beamSection, MATERIAL_ID, unitWeights);
    expect(selfWeight.status).toBe("calculated-within-stated-assumptions");

    const report = analyzeMember(snapshot, {
      memberId: "beam-1",
      loads: [analyzedLoadFromApplied(selfWeight.load!)],
      elasticModulusMPa: 10000,
      momentOfInertiaMm4: 1e8,
    });

    expect(report.status).toBe("calculated-within-stated-assumptions");
    expect(report.loadProvenance).toEqual([
      { kind: "self-weight", provenance: { source: "computed-self-weight", label: "Computed from section geometry and user-entered specific weight" } },
    ]);
    // 184*38*5e-6 = 0.03496 N/mm; R = w*span/2 = 0.03496*4000/2 = 69.92 N.
    expect(report.reactionStartN).toBeCloseTo(69.92, 2);
  });

  it("fails closed with input-requires-verification when elastic modulus is missing (deflection unavailable)", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [userLoad({ kind: "uniform", wNPerMm: 10 })] });
    expect(report.status).toBe("input-requires-verification");
    expect(report.maxDeflectionMm).toBeUndefined();
    expect(report.reactionStartN).toBeCloseTo(20000, 6);
  });

  it("fails closed with input-requires-verification when no loads are supplied", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [] });
    expect(report.status).toBe("input-requires-verification");
    expect(report.loadProvenance).toEqual([]);
  });

  it("refuses a ledger member as outside-validated-scope, reporting no numeric results", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "ledger";
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [userLoad({ kind: "uniform", wNPerMm: 10 })] });
    expect(report.status).toBe("outside-validated-scope");
    expect(report.reactionStartN).toBeUndefined();
    expect(report.loadProvenance).toBeUndefined();
  });

  it("refuses an unsupported load pattern for the member's support condition", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [userLoad({ kind: "point-tip", pN: 1000 })] });
    expect(report.status).toBe("check-not-implemented");
  });

  it("passes user-supplied jurisdiction metadata through unchanged, never using it to look up a value", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const jurisdiction = {
      provider: "Local building authority",
      edition: "2026 edition",
      effectiveDate: "2026-01-01",
    };
    const report = analyzeMember(snapshot, {
      memberId: "beam-1",
      loads: [userLoad({ kind: "uniform", wNPerMm: 10 })],
      jurisdiction,
    });
    expect(report.jurisdiction).toEqual(jurisdiction);
  });

  it("analyzes a cantilever span from a post to a free anchor", () => {
    const document = twoPostFrame();
    document.anchors.push({ id: "anchor-free", kind: "free", positionMm: { x: 3000, y: 0, z: 2400 } });
    document.members.push({
      id: "beam-cantilever",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-a-top",
      endAnchorId: "anchor-free",
      sectionId: "section-beam",
      rollRad: 0,
    });
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, {
      memberId: "beam-cantilever",
      loads: [userLoad({ kind: "point-tip", pN: 5000 })],
      elasticModulusMPa: 10000,
      momentOfInertiaMm4: 1e8,
    });
    expect(report.status).toBe("calculated-within-stated-assumptions");
    expect(report.condition).toBe("cantilever");
    expect(report.spanMm).toBeCloseTo(3000, 6);
    expect(report.reactionStartN).toBeCloseTo(5000, 6);
    expect(report.fixedEndMomentNmm).toBeCloseTo(15000000, 3);
  });
});
