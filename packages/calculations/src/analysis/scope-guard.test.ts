import { describe, expect, it } from "vitest";
import { memberAnalysisScope, postAnalysisScope } from "./scope-guard.js";
import { twoPostFrame } from "./test-fixtures.js";

describe("memberAnalysisScope", () => {
  it("supports a perimeter beam spanning two posts as simply-supported", () => {
    const result = memberAnalysisScope(twoPostFrame(), "beam-1");
    expect(result).toEqual({ supported: true, condition: "simply-supported" });
  });

  it("supports a perimeter beam from a post to a free anchor as cantilever", () => {
    const document = twoPostFrame();
    document.anchors.push({ id: "anchor-free", kind: "free", positionMm: { x: 6000, y: 0, z: 2400 } });
    document.members.push({
      id: "beam-2",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-b-top",
      endAnchorId: "anchor-free",
      sectionId: "section-beam",
      rollRad: 0,
    });
    const result = memberAnalysisScope(document, "beam-2");
    expect(result).toEqual({ supported: true, condition: "cantilever" });
  });

  it("refuses an unknown member id", () => {
    const result = memberAnalysisScope(twoPostFrame(), "nonexistent");
    expect(result.supported).toBe(false);
  });

  it("refuses a ledger member (unknown house-ledger stiffness)", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "ledger";
    const result = memberAnalysisScope(document, "beam-1");
    expect(result).toEqual({
      supported: false,
      reason: expect.stringMatching(/ledger/i),
    });
  });

  it("refuses a fan-rafter member (global saddle/gridshell stability)", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "fan-rafter";
    const result = memberAnalysisScope(document, "beam-1");
    expect(result).toEqual({
      supported: false,
      reason: expect.stringMatching(/saddle/i),
    });
  });

  it("refuses a member that participates in a modeled joint (semi-rigid/eccentric)", () => {
    const document = twoPostFrame();
    document.joints.push({
      id: "joint-1",
      connectedMemberIds: ["beam-1"],
      positionMm: { x: 2000, y: 0, z: 2400 },
      crossingBehavior: "structural-joint",
      engineeringStatus: "engineer-review-required",
    });
    const result = memberAnalysisScope(document, "beam-1");
    expect(result.supported).toBe(false);
  });

  it("refuses a member with an unsupported end-anchor combination", () => {
    const document = twoPostFrame();
    document.anchors.push({ id: "anchor-house-1", kind: "house", positionMm: { x: -1000, y: 0, z: 2400 } });
    document.members.push({
      id: "beam-3",
      role: "perimeter-beam",
      startAnchorId: "anchor-house-1",
      endAnchorId: "anchor-post-a-top",
      sectionId: "section-beam",
      rollRad: 0,
    });
    const result = memberAnalysisScope(document, "beam-3");
    expect(result.supported).toBe(false);
  });
});

describe("postAnalysisScope", () => {
  it("supports a post whose top anchor carries at most one member", () => {
    const result = postAnalysisScope(twoPostFrame(), "post-a");
    expect(result).toEqual({ supported: true });
  });

  it("refuses a post whose top anchor carries more than one member (multi-member frame)", () => {
    const document = twoPostFrame();
    document.members.push({
      id: "beam-extra",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-a-top",
      endAnchorId: "anchor-post-b-top",
      sectionId: "section-beam",
      rollRad: 0,
    });
    const result = postAnalysisScope(document, "post-a");
    expect(result.supported).toBe(false);
  });

  it("refuses an unknown post id", () => {
    const result = postAnalysisScope(twoPostFrame(), "nonexistent");
    expect(result.supported).toBe(false);
  });
});
