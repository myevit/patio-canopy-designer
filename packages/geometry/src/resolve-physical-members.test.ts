import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { derivePhysicalMembers } from "./resolve-physical-members.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Test", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
  doc.site.houseOutlines.push({
    id: "house-1",
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 1000, z: 0 },
      { x: 0, y: 1000, z: 0 },
    ],
  });
  doc.site.roofPlanes.push({
    id: "roof-1",
    houseOutlineId: "house-1",
    referenceElevationMm: 0,
    pitchRad: (25 * Math.PI) / 180,
    directionRad: 0,
  });
  return doc;
}

describe("derivePhysicalMembers", () => {
  it("returns one entry per post and per member with no omissions or duplicates", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-post-base", kind: "free", positionMm: { x: 500, y: 0, z: 0 } },
      { id: "a-post-top", kind: "free", positionMm: { x: 500, y: 0, z: 2400 } },
      { id: "a-beam-1", kind: "free", positionMm: { x: 0, y: 500, z: 3000 } },
      { id: "a-beam-2", kind: "free", positionMm: { x: 1000, y: 500, z: 3500 } },
    );
    doc.posts.push({ id: "post-1", baseAnchorId: "a-post-base", topAnchorId: "a-post-top", sectionId: "sec-rafter", heightMm: 2400 });
    doc.members.push({
      id: "member-1",
      role: "perimeter-beam",
      startAnchorId: "a-beam-1",
      endAnchorId: "a-beam-2",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const result = derivePhysicalMembers(doc);
    const ids = result.map((m) => m.id).sort();
    expect(ids).toEqual(["member-1", "post-1"]);
  });

  it("assigns a square cut at both ends when neither endpoint lies on a roof plane", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 3000 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 3500 } },
    );
    doc.members.push({
      id: "member-1",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const [physical] = derivePhysicalMembers(doc);
    expect(physical!.endA.cut.kind).toBe("square");
    expect(physical!.endB.cut.kind).toBe("square");
    expect(physical!.endA.roofPlaneId).toBeNull();
    expect(physical!.endB.roofPlaneId).toBeNull();
  });

  it("assigns a roof-plane end cut when an endpoint lies on the canonical roof plane", () => {
    const doc = baseDoc();
    // The eave anchor (x=1000) sits exactly on the sloped roof surface (z=0 there);
    // the ridge anchor is well clear of the plane, so only one end should trim to it.
    doc.anchors.push(
      { id: "a-ridge", kind: "free", positionMm: { x: 0, y: 500, z: 2000 } },
      { id: "a-eave", kind: "free", positionMm: { x: 1000, y: 500, z: 0 } },
    );
    doc.members.push({
      id: "rafter-1",
      role: "fan-rafter",
      startAnchorId: "a-ridge",
      endAnchorId: "a-eave",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const [physical] = derivePhysicalMembers(doc);
    expect(physical!.endA.cut.kind).toBe("square");
    expect(physical!.endA.roofPlaneId).toBeNull();
    expect(physical!.endB.cut.kind).toBe("plane-trim");
    expect(physical!.endB.roofPlaneId).toBe("roof-1");
  });

  it("flags a near-zero-length member's trimmed geometry instead of omitting it", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 500, y: 500, z: 500 } },
      { id: "a-2", kind: "free", positionMm: { x: 500.2, y: 500, z: 500 } },
    );
    doc.members.push({
      id: "tiny-member",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const [physical] = derivePhysicalMembers(doc);
    expect(physical!.trimmed.isNearZeroLength).toBe(true);
  });
});
