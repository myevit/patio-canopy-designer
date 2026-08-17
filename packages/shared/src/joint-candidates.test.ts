import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "./empty-project.js";
import type { ProjectDocument } from "./design-schema.js";
import { deriveJointCandidates, findUnresolvedJointCandidates, regenerateJointPosition } from "./joint-candidates.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Untitled", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 89, heightMm: 38 });
  return doc;
}

describe("deriveJointCandidates: shared endpoints", () => {
  it("finds a candidate where two members share an anchor", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1000, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-3", sectionId: "sec-beam", rollRad: 0 },
    );

    const candidates = deriveJointCandidates(doc);
    const sharedEndpoint = candidates.find((c) => c.kind === "shared-endpoint");
    expect(sharedEndpoint).toBeDefined();
    expect(sharedEndpoint!.memberIds.sort()).toEqual(["m-1", "m-2"]);
    expect(sharedEndpoint!.positionMm).toEqual({ x: 1000, y: 0, z: 0 });
    expect(sharedEndpoint!.existingJointId).toBeNull();
  });

  it("does not report a candidate for a member's unshared free endpoint", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
    );
    doc.members.push({
      id: "m-1",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-beam",
      rollRad: 0,
    });

    expect(deriveJointCandidates(doc)).toHaveLength(0);
  });

  it("marks a candidate resolved once a matching joint exists", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1000, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-3", sectionId: "sec-beam", rollRad: 0 },
    );
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["m-1", "m-2"],
      positionMm: { x: 1000, y: 0, z: 0 },
      crossingBehavior: "structural-joint",
      engineeringStatus: "engineer-review-required",
    });

    const candidates = deriveJointCandidates(doc);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.existingJointId).toBe("joint-1");
    expect(findUnresolvedJointCandidates(doc)).toHaveLength(0);
  });
});

describe("deriveJointCandidates: interior crossings", () => {
  function withCrossingBeams(): ProjectDocument {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 500, y: 0, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 500, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
    );
    return doc;
  }

  it("finds a crossing candidate at the intersection point of two beams that don't share an anchor", () => {
    const doc = withCrossingBeams();
    const candidates = deriveJointCandidates(doc);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.kind).toBe("crossing");
    expect(candidates[0]!.memberIds.sort()).toEqual(["m-1", "m-2"]);
    expect(candidates[0]!.positionMm.x).toBeCloseTo(500, 6);
    expect(candidates[0]!.positionMm.y).toBeCloseTo(500, 6);
  });

  it("does not flag two beams that pass well clear of each other", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 0, y: 5000, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 1000, y: 5000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
    );
    expect(deriveJointCandidates(doc)).toHaveLength(0);
  });
});

describe("regenerateJointPosition", () => {
  it("recomputes a shared-endpoint joint's position from the anchor's current position", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1500, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1500, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-3", sectionId: "sec-beam", rollRad: 0 },
    );
    const joint = {
      id: "joint-1",
      connectedMemberIds: ["m-1", "m-2"],
      positionMm: { x: 1000, y: 0, z: 0 },
      crossingBehavior: "structural-joint" as const,
      engineeringStatus: "engineer-review-required" as const,
    };

    const regenerated = regenerateJointPosition(doc, joint);
    expect(regenerated).toEqual({ x: 1500, y: 0, z: 0 });
  });

  it("returns null once the connected members no longer meet", () => {
    const doc = withMovedApartCrossing();
    const joint = {
      id: "joint-1",
      connectedMemberIds: ["m-1", "m-2"],
      positionMm: { x: 500, y: 500, z: 0 },
      crossingBehavior: "structural-joint" as const,
      engineeringStatus: "engineer-review-required" as const,
    };
    expect(regenerateJointPosition(doc, joint)).toBeNull();
  });

  function withMovedApartCrossing(): ProjectDocument {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 500, y: 5000, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 500, y: 6000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
    );
    return doc;
  }
});
