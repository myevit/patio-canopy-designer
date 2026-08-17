import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { buildCutFabrication } from "./cut-fabrication.js";

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

describe("buildCutFabrication", () => {
  it("builds one card per physical member, carrying its section dimensions and exact finished length", () => {
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

    const cards = buildCutFabrication(doc);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.memberId).toBe("member-1");
    expect(card.kind).toBe("beam");
    expect(card.sectionWidthMm).toBe(89);
    expect(card.sectionHeightMm).toBe(38);
    expect(card.finishedLengthMm).toBeCloseTo(Math.hypot(1000, 500), 6);
    expect(card.endA.plane.kind).toBe("square");
    expect(card.endB.plane.kind).toBe("square");
    expect(card.isNearZeroLength).toBe(false);
  });

  it("produces a roof-plane cut card with a nonzero bevel angle sourced from the roof plane id", () => {
    const doc = baseDoc();
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

    const [card] = buildCutFabrication(doc);
    expect(card!.endB.roofPlaneId).toBe("roof-1");
    expect(card!.endB.plane.kind).toBe("plane-trim");
    // A sloped roof plane produces some nonzero rotation away from square.
    expect(Math.abs(card!.endB.miterRad) + Math.abs(card!.endB.bevelRad)).toBeGreaterThan(0.01);
    expect(card!.endA.roofPlaneId).toBeNull();
  });

  it("still reports a card for a near-zero-length member instead of dropping it", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 500, y: 500, z: 500 } },
      { id: "a-2", kind: "free", positionMm: { x: 500.2, y: 500, z: 500 } },
    );
    doc.members.push({
      id: "tiny",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const [card] = buildCutFabrication(doc);
    expect(card!.isNearZeroLength).toBe(true);
  });

  it("keeps stock length as an explicit, separate field from the exact finished length", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 3550, y: 0, z: 0 } },
    );
    doc.members.push({
      id: "member-1",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-rafter",
      rollRad: 0,
    });

    const [card] = buildCutFabrication(doc, 50);
    expect(card!.stockAllowanceMm).toBe(50);
    expect(card!.stockLengthMm).toBeGreaterThanOrEqual(card!.finishedLengthMm + 50);
  });
});
