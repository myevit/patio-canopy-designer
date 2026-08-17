import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "./design-schema.js";

/**
 * Bundled, immutable sample project: an attached freeform timber canopy over
 * a curved, irregular patio. Posts sit outside the patio's curved perimeter,
 * and two overlapping fan fields produce non-orthogonal rafters that cross
 * each other, giving Milestone 0 a realistic plan/3D fixture to render.
 */
const document: ProjectDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  revision: 1,
  metadata: {
    name: "Attached freeform canopy (sample)",
    createdAt: "2026-08-16T00:00:00.000Z",
    notes: "Immutable bundled sample used to exercise the Studio shell.",
  },
  displayUnits: "mm",
  site: {
    houseOutlines: [
      {
        id: "house-outline-1",
        points: [
          { x: 0, y: -300, z: 0 },
          { x: 7000, y: -300, z: 0 },
          { x: 7000, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
      },
    ],
    roofPlanes: [
      {
        id: "roof-plane-1",
        houseOutlineId: "house-outline-1",
        referenceElevationMm: 2700,
        pitchDeg: 5,
        directionRad: Math.PI / 2,
        gutter: { widthMm: 125, dropMm: 60 },
      },
    ],
    patioOutlines: [
      {
        id: "patio-outline-1",
        points: [
          { x: -200, y: 600, z: 0 },
          { x: 600, y: 200, z: 0 },
          { x: 1800, y: 100, z: 0 },
          { x: 3200, y: 250, z: 0 },
          { x: 4600, y: 150, z: 0 },
          { x: 6100, y: 350, z: 0 },
          { x: 7300, y: 900, z: 0 },
          { x: 7450, y: 2200, z: 0 },
          { x: 7100, y: 3400, z: 0 },
          { x: 6000, y: 4300, z: 0 },
          { x: 4200, y: 4450, z: 0 },
          { x: 2400, y: 4300, z: 0 },
          { x: 900, y: 3900, z: 0 },
          { x: -100, y: 2600, z: 0 },
        ],
      },
    ],
  },
  anchors: [
    { id: "anchor-ha1", kind: "house", positionMm: { x: 800, y: 0, z: 2700 } },
    { id: "anchor-ha2", kind: "house", positionMm: { x: 2600, y: 0, z: 2700 } },
    { id: "anchor-ha3", kind: "house", positionMm: { x: 4550, y: 0, z: 2700 } },
    { id: "anchor-ha4", kind: "house", positionMm: { x: 6300, y: 0, z: 2700 } },

    { id: "anchor-p1-base", kind: "post-base", positionMm: { x: 800, y: 4500, z: 0 } },
    { id: "anchor-p1-top", kind: "post-top", positionMm: { x: 800, y: 4500, z: 2320 } },
    { id: "anchor-p2-base", kind: "post-base", positionMm: { x: 2600, y: 4550, z: 0 } },
    { id: "anchor-p2-top", kind: "post-top", positionMm: { x: 2600, y: 4550, z: 2300 } },
    { id: "anchor-p3-base", kind: "post-base", positionMm: { x: 4550, y: 4500, z: 0 } },
    { id: "anchor-p3-top", kind: "post-top", positionMm: { x: 4550, y: 4500, z: 2300 } },
    { id: "anchor-p4-base", kind: "post-base", positionMm: { x: 6300, y: 4200, z: 0 } },
    { id: "anchor-p4-top", kind: "post-top", positionMm: { x: 6300, y: 4200, z: 2330 } },
    { id: "anchor-p5-base", kind: "post-base", positionMm: { x: 7600, y: 3000, z: 0 } },
    { id: "anchor-p5-top", kind: "post-top", positionMm: { x: 7600, y: 3000, z: 2400 } },
  ],
  sections: [
    { id: "sec-post", name: "140x140 post", widthMm: 140, heightMm: 140 },
    { id: "sec-beam", name: "184x38 beam", widthMm: 184, heightMm: 38 },
    { id: "sec-rafter", name: "89x38 rafter", widthMm: 89, heightMm: 38 },
  ],
  materials: [{ id: "mat-1", name: "SPF No.2 dimension lumber" }],
  posts: [
    {
      id: "post-1",
      baseAnchorId: "anchor-p1-base",
      topAnchorId: "anchor-p1-top",
      sectionId: "sec-post",
      heightMm: 2320,
    },
    {
      id: "post-2",
      baseAnchorId: "anchor-p2-base",
      topAnchorId: "anchor-p2-top",
      sectionId: "sec-post",
      heightMm: 2300,
    },
    {
      id: "post-3",
      baseAnchorId: "anchor-p3-base",
      topAnchorId: "anchor-p3-top",
      sectionId: "sec-post",
      heightMm: 2300,
    },
    {
      id: "post-4",
      baseAnchorId: "anchor-p4-base",
      topAnchorId: "anchor-p4-top",
      sectionId: "sec-post",
      heightMm: 2330,
    },
    {
      id: "post-5",
      baseAnchorId: "anchor-p5-base",
      topAnchorId: "anchor-p5-top",
      sectionId: "sec-post",
      heightMm: 2400,
    },
  ],
  members: [
    {
      id: "member-ledger",
      role: "ledger",
      startAnchorId: "anchor-ha1",
      endAnchorId: "anchor-ha4",
      sectionId: "sec-beam",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-perim-1",
      role: "perimeter-beam",
      startAnchorId: "anchor-p1-top",
      endAnchorId: "anchor-p2-top",
      sectionId: "sec-beam",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-perim-2",
      role: "perimeter-beam",
      startAnchorId: "anchor-p2-top",
      endAnchorId: "anchor-p3-top",
      sectionId: "sec-beam",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-perim-3",
      role: "perimeter-beam",
      startAnchorId: "anchor-p3-top",
      endAnchorId: "anchor-p4-top",
      sectionId: "sec-beam",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-perim-4",
      role: "perimeter-beam",
      startAnchorId: "anchor-p4-top",
      endAnchorId: "anchor-p5-top",
      sectionId: "sec-beam",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-a-1",
      role: "fan-rafter",
      startAnchorId: "anchor-ha2",
      endAnchorId: "anchor-p1-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-a-2",
      role: "fan-rafter",
      startAnchorId: "anchor-ha2",
      endAnchorId: "anchor-p3-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-a-3",
      role: "fan-rafter",
      startAnchorId: "anchor-ha2",
      endAnchorId: "anchor-p4-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-b-1",
      role: "fan-rafter",
      startAnchorId: "anchor-ha3",
      endAnchorId: "anchor-p2-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-b-2",
      role: "fan-rafter",
      startAnchorId: "anchor-ha3",
      endAnchorId: "anchor-p4-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
    {
      id: "member-fan-b-3",
      role: "fan-rafter",
      startAnchorId: "anchor-ha3",
      endAnchorId: "anchor-p5-top",
      sectionId: "sec-rafter",
      materialId: "mat-1",
      rollRad: 0,
    },
  ],
  fanFields: [
    {
      id: "fan-field-a",
      sourceAnchorId: "anchor-ha2",
      targetAnchorIds: ["anchor-p1-top", "anchor-p3-top", "anchor-p4-top"],
      elevationRule: "linear slope from house eave anchor to post top",
      memberTemplate: { sectionId: "sec-rafter", materialId: "mat-1" },
      memberIds: ["member-fan-a-1", "member-fan-a-2", "member-fan-a-3"],
    },
    {
      id: "fan-field-b",
      sourceAnchorId: "anchor-ha3",
      targetAnchorIds: ["anchor-p2-top", "anchor-p4-top", "anchor-p5-top"],
      elevationRule: "linear slope from house eave anchor to post top",
      memberTemplate: { sectionId: "sec-rafter", materialId: "mat-1" },
      memberIds: ["member-fan-b-1", "member-fan-b-2", "member-fan-b-3"],
    },
  ],
  joints: [
    {
      id: "joint-crossing-1",
      connectedMemberIds: ["member-fan-a-2", "member-fan-b-1"],
      positionMm: { x: 3581, y: 2264, z: 2500 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    },
  ],
};

function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const SAMPLE_PROJECT: ProjectDocument = deepFreeze(document);
