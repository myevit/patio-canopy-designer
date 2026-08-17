import { describe, expect, it } from "vitest";
import { analyzePost, type PostAppliedLoad } from "./post-analysis.js";
import { freezeAnalysisSnapshot } from "./snapshot.js";
import { twoPostFrame } from "./test-fixtures.js";

function userLoad(axialLoadN: number, endMomentNmm: number): PostAppliedLoad {
  return { axialLoadN, endMomentNmm, kind: "user-defined", provenance: { source: "user-entered", label: "Test load" } };
}

describe("analyzePost", () => {
  it("computes axial-plus-moment demand for a post with a single member at its top anchor", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzePost(snapshot, {
      postId: "post-a",
      load: userLoad(50000, 3000000),
      unbracedLengthMm: 2400,
      allowableCompressionStressMPa: 8,
      allowableBendingStressMPa: 10,
      footing: { widthMm: 600, lengthMm: 600, allowableBearingCapacityKPa: 150 },
    });
    expect(report.status).toBe("calculated-within-stated-assumptions");
    expect(report.axial?.interactionRatio).toBeCloseTo(0.975, 2);
    // 50000N / 360000mm^2 = 0.1389 MPa = 138.89 kPa; ratio vs 150 kPa = 0.9259
    expect(report.footing?.bearingRatio).toBeCloseTo(0.9259, 3);
    expect(report.loadProvenance).toEqual({ kind: "user-defined", provenance: { source: "user-entered", label: "Test load" } });
  });

  it("fails closed when the unbraced length is not declared", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzePost(snapshot, { postId: "post-a", load: userLoad(50000, 3000000) });
    expect(report.status).toBe("input-requires-verification");
  });

  it("passes user-supplied jurisdiction metadata through unchanged", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const jurisdiction = { provider: "Local building authority", edition: "2026 edition", effectiveDate: "2026-01-01" };
    const report = analyzePost(snapshot, {
      postId: "post-a",
      load: userLoad(50000, 3000000),
      unbracedLengthMm: 2400,
      jurisdiction,
    });
    expect(report.jurisdiction).toEqual(jurisdiction);
  });

  it("refuses a post whose top anchor carries more than one member", () => {
    const document = twoPostFrame();
    document.members.push({
      id: "beam-extra",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-a-top",
      endAnchorId: "anchor-post-b-top",
      sectionId: "section-beam",
      rollRad: 0,
    });
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzePost(snapshot, {
      postId: "post-a",
      load: userLoad(50000, 3000000),
      unbracedLengthMm: 2400,
    });
    expect(report.status).toBe("outside-validated-scope");
    expect(report.axial).toBeUndefined();
    expect(report.loadProvenance).toBeUndefined();
  });
});
