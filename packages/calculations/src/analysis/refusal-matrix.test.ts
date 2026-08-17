import { describe, expect, it } from "vitest";
import { analyzeMember } from "./member-analysis.js";
import { analyzePost } from "./post-analysis.js";
import { freezeAnalysisSnapshot } from "./snapshot.js";
import { twoPostFrame } from "./test-fixtures.js";

/**
 * One test per bullet in the delivery plan's "Must refuse" list for
 * Milestone 7. Each case must come back `outside-validated-scope` (or
 * `check-not-implemented` for a load pattern this module never claims to
 * handle) and never `calculated-within-stated-assumptions`.
 */
describe("Milestone 7 refusal matrix", () => {
  it("refuses global saddle/gridshell stability (fan-rafter member)", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "fan-rafter";
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [{ kind: "uniform", wNPerMm: 1 }] });
    expect(report.status).toBe("outside-validated-scope");
  });

  it("refuses semi-rigid/eccentric joints (member participating in a modeled joint)", () => {
    const document = twoPostFrame();
    document.joints.push({
      id: "joint-1",
      connectedMemberIds: ["beam-1"],
      positionMm: { x: 2000, y: 0, z: 2400 },
      crossingBehavior: "structural-joint",
      engineeringStatus: "engineer-review-required",
    });
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [{ kind: "uniform", wNPerMm: 1 }] });
    expect(report.status).toBe("outside-validated-scope");
  });

  it("refuses unknown house-ledger stiffness (ledger member)", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "ledger";
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [{ kind: "uniform", wNPerMm: 1 }] });
    expect(report.status).toBe("outside-validated-scope");
  });

  it("refuses biaxial post bending from a multi-member frame (post top anchor shared by two members)", () => {
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
    const report = analyzePost(snapshot, { postId: "post-a", axialLoadN: 1000, endMomentNmm: 1000, unbracedLengthMm: 2400 });
    expect(report.status).toBe("outside-validated-scope");
  });

  it("refuses an unsupported/arbitrary load position (never approximated as a supported case)", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    const report = analyzeMember(snapshot, { memberId: "beam-1", loads: [{ kind: "point-tip", pN: 1000 }] });
    expect(report.status).toBe("check-not-implemented");
  });

  it("never reports connector approval - connection demand always carries an engineer-review disclaimer", async () => {
    const { reportConnectionDemand } = await import("./connection-demand.js");
    const result = reportConnectionDemand({ jointId: "joint-1", shearN: 100 });
    expect(result.disclaimer).toMatch(/engineer-review-required/i);
    expect(result.status).not.toBe("engineer-review-required");
  });
});
