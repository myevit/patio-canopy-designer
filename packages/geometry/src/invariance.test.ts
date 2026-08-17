import { createEmptyProjectDocument, type ProjectDocument, type Vector3Mm } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { buildCutFabrication, type CutFabricationCard } from "./cut-fabrication.js";
import { buildMemberSchedule } from "./member-schedule.js";

/**
 * A rigid transform meaningful for this domain: translate freely, but only
 * rotate about the vertical (world-Z) axis ("yaw"/site heading). Roof planes
 * are defined by pitch/direction relative to a horizontal ground plane, so
 * tipping the whole document sideways would change what "pitch" even means;
 * yaw + translation are the rigid transforms that preserve that semantics.
 */
interface RigidTransform {
  translateMm: Vector3Mm;
  yawRad: number;
}

function applyRigidTransform(point: Vector3Mm, transform: RigidTransform): Vector3Mm {
  const cos = Math.cos(transform.yawRad);
  const sin = Math.sin(transform.yawRad);
  const rotated = { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos, z: point.z };
  return {
    x: rotated.x + transform.translateMm.x,
    y: rotated.y + transform.translateMm.y,
    z: rotated.z + transform.translateMm.z,
  };
}

function transformDocument(document: ProjectDocument, transform: RigidTransform): ProjectDocument {
  return {
    ...document,
    anchors: document.anchors.map((a) => ({ ...a, positionMm: applyRigidTransform(a.positionMm, transform) })),
    site: {
      ...document.site,
      houseOutlines: document.site.houseOutlines.map((h) => ({
        ...h,
        points: h.points.map((p) => applyRigidTransform(p, transform)),
      })),
      roofPlanes: document.site.roofPlanes.map((r) => ({
        ...r,
        directionRad: r.directionRad + transform.yawRad,
        referenceElevationMm: r.referenceElevationMm + transform.translateMm.z,
      })),
    },
  };
}

function buildDocWithRoofRafter(): ProjectDocument {
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
    rollRad: (10 * Math.PI) / 180,
  });
  return doc;
}

function expectCardsPhysicallyEqual(a: CutFabricationCard, b: CutFabricationCard) {
  expect(a.finishedLengthMm).toBeCloseTo(b.finishedLengthMm, 6);
  expect(a.longPointMm).toBeCloseTo(b.longPointMm, 6);
  expect(a.shortPointMm).toBeCloseTo(b.shortPointMm, 6);
  expect(a.endA.plane.kind).toBe(b.endA.plane.kind);
  expect(a.endB.plane.kind).toBe(b.endB.plane.kind);
  expect(a.endA.roofPlaneId !== null).toBe(b.endA.roofPlaneId !== null);
  expect(a.endB.roofPlaneId !== null).toBe(b.endB.roofPlaneId !== null);
  expect(a.endA.miterRad).toBeCloseTo(b.endA.miterRad, 6);
  expect(a.endA.bevelRad).toBeCloseTo(b.endA.bevelRad, 6);
  expect(a.endB.miterRad).toBeCloseTo(b.endB.miterRad, 6);
  expect(a.endB.bevelRad).toBeCloseTo(b.endB.bevelRad, 6);
}

describe("rigid transform invariance", () => {
  it("preserves finished length, long/short point, and end-cut angles under translation", () => {
    const original = buildDocWithRoofRafter();
    const translated = transformDocument(original, { translateMm: { x: 5000, y: -3000, z: 1200 }, yawRad: 0 });

    const [originalCard] = buildCutFabrication(original);
    const [translatedCard] = buildCutFabrication(translated);
    expectCardsPhysicallyEqual(originalCard!, translatedCard!);
  });

  it("preserves finished length, long/short point, and end-cut angles under a yaw rotation about the vertical axis", () => {
    const original = buildDocWithRoofRafter();
    const rotated = transformDocument(original, { translateMm: { x: 0, y: 0, z: 0 }, yawRad: (37 * Math.PI) / 180 });

    const [originalCard] = buildCutFabrication(original);
    const [rotatedCard] = buildCutFabrication(rotated);
    expectCardsPhysicallyEqual(originalCard!, rotatedCard!);
  });

  it("preserves geometry under a combined translation and yaw rotation", () => {
    const original = buildDocWithRoofRafter();
    const transformed = transformDocument(original, {
      translateMm: { x: -1500, y: 4200, z: 300 },
      yawRad: (-52 * Math.PI) / 180,
    });

    const [originalCard] = buildCutFabrication(original);
    const [transformedCard] = buildCutFabrication(transformed);
    expectCardsPhysicallyEqual(originalCard!, transformedCard!);
  });
});

describe("endpoint reversal", () => {
  it("swaps end-A/end-B labels while preserving finished length, long/short point, and cut magnitudes", () => {
    const doc = buildDocWithRoofRafter();
    const reversed: ProjectDocument = {
      ...doc,
      members: doc.members.map((m) => ({ ...m, startAnchorId: m.endAnchorId, endAnchorId: m.startAnchorId })),
    };

    const [forward] = buildCutFabrication(doc);
    const [reversedCard] = buildCutFabrication(reversed);

    expect(forward!.finishedLengthMm).toBeCloseTo(reversedCard!.finishedLengthMm, 6);
    expect(forward!.longPointMm).toBeCloseTo(reversedCard!.longPointMm, 6);
    expect(forward!.shortPointMm).toBeCloseTo(reversedCard!.shortPointMm, 6);

    // What was end B is now end A, and vice versa.
    expect(reversedCard!.endA.plane.kind).toBe(forward!.endB.plane.kind);
    expect(reversedCard!.endA.roofPlaneId).toBe(forward!.endB.roofPlaneId);
    expect(Math.abs(reversedCard!.endA.miterRad)).toBeCloseTo(Math.abs(forward!.endB.miterRad), 6);
    expect(Math.abs(reversedCard!.endA.bevelRad)).toBeCloseTo(Math.abs(forward!.endB.bevelRad), 6);

    expect(reversedCard!.endB.plane.kind).toBe(forward!.endA.plane.kind);
    expect(reversedCard!.endB.roofPlaneId).toBe(forward!.endA.roofPlaneId);
    expect(Math.abs(reversedCard!.endB.miterRad)).toBeCloseTo(Math.abs(forward!.endA.miterRad), 6);
    expect(Math.abs(reversedCard!.endB.bevelRad)).toBeCloseTo(Math.abs(forward!.endA.bevelRad), 6);
  });
});

describe("unit presentation vs canonical geometry", () => {
  it("leaves canonical BOM/cut millimetre values unaffected by the document's display-unit preference", () => {
    const doc = buildDocWithRoofRafter();
    const mmSchedule = buildMemberSchedule({ ...doc, displayUnits: "mm" });
    const ftInSchedule = buildMemberSchedule({ ...doc, displayUnits: "ft-in" });
    const mSchedule = buildMemberSchedule({ ...doc, displayUnits: "m" });

    expect(ftInSchedule.rows).toEqual(mmSchedule.rows);
    expect(mSchedule.rows).toEqual(mmSchedule.rows);
  });
});
