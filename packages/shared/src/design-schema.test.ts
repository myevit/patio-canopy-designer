import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  parseProjectDocument,
  type ProjectDocument,
} from "./design-schema.js";

function minimalDocument(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 1,
    metadata: { name: "Empty project", createdAt: "2026-08-16T00:00:00.000Z" },
    displayUnits: "mm",
    site: { houseOutlines: [], roofPlanes: [], gutters: [], patioOutlines: [] },
    anchors: [],
    sections: [],
    materials: [],
    posts: [],
    members: [],
    fanFields: [],
    joints: [],
  };
}

function rectanglePoints() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

function withHouseOutline(doc: ProjectDocument): ProjectDocument {
  doc.site.houseOutlines.push({ id: "house-1", points: rectanglePoints() });
  return doc;
}

describe("parseProjectDocument", () => {
  it("accepts a minimal valid empty project document", () => {
    const result = parseProjectDocument(minimalDocument());
    expect(result.success).toBe(true);
  });

  it("rejects an unknown schema version", () => {
    const doc = { ...minimalDocument(), schemaVersion: 999 };
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a section with a non-positive width", () => {
    const doc = minimalDocument();
    doc.sections.push({ id: "sec-1", name: "Bad section", widthMm: 0, heightMm: 140 });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a section with a non-finite height", () => {
    const doc = minimalDocument();
    doc.sections.push({ id: "sec-1", name: "Bad section", widthMm: 89, heightMm: Number.NaN });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a post referencing an anchor id that does not exist", () => {
    const doc = minimalDocument();
    doc.sections.push({ id: "sec-post", name: "Post section", widthMm: 140, heightMm: 140 });
    doc.posts.push({
      id: "post-1",
      baseAnchorId: "anchor-missing-base",
      topAnchorId: "anchor-missing-top",
      sectionId: "sec-post",
      heightMm: 2400,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a joint referencing a member id that does not exist", () => {
    const doc = minimalDocument();
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["member-missing"],
      positionMm: { x: 0, y: 0, z: 0 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate anchor ids", () => {
    const doc = minimalDocument();
    doc.anchors.push(
      { id: "anchor-duplicate", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "anchor-duplicate", kind: "free", positionMm: { x: 100, y: 0, z: 0 } },
    );
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate section ids", () => {
    const doc = minimalDocument();
    doc.sections.push(
      { id: "section-duplicate", name: "First", widthMm: 38, heightMm: 184 },
      { id: "section-duplicate", name: "Second", widthMm: 89, heightMm: 235 },
    );
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects an id shared by a post and member", () => {
    const doc = minimalDocument();
    doc.sections.push({ id: "section-frame", name: "Frame", widthMm: 140, heightMm: 140 });
    doc.anchors.push(
      { id: "anchor-base", kind: "post-base", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "anchor-top", kind: "post-top", positionMm: { x: 0, y: 0, z: 2400 } },
      { id: "anchor-end", kind: "free", positionMm: { x: 1000, y: 0, z: 2400 } },
    );
    doc.posts.push({
      id: "selectable-duplicate",
      baseAnchorId: "anchor-base",
      topAnchorId: "anchor-top",
      sectionId: "section-frame",
      heightMm: 2400,
    });
    doc.members.push({
      id: "selectable-duplicate",
      role: "perimeter-beam",
      startAnchorId: "anchor-top",
      endAnchorId: "anchor-end",
      sectionId: "section-frame",
      rollRad: 0,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a roof plane referencing a house outline id that does not exist", () => {
    const doc = minimalDocument();
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-missing",
      referenceElevationMm: 2690,
      pitchRad: (10 * Math.PI) / 180,
      directionRad: 0,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a roof plane pitch of 90 degrees or more", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: Math.PI / 2,
      directionRad: 0,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a second roof plane attached to the same house outline", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.roofPlanes.push(
      {
        id: "roof-1",
        houseOutlineId: "house-1",
        referenceElevationMm: 2690,
        pitchRad: (10 * Math.PI) / 180,
        directionRad: 0,
      },
      {
        id: "roof-2",
        houseOutlineId: "house-1",
        referenceElevationMm: 2400,
        pitchRad: (8 * Math.PI) / 180,
        directionRad: 0,
      },
    );
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a self-intersecting house outline", () => {
    const doc = minimalDocument();
    doc.site.houseOutlines.push({
      id: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 3000, z: 0 },
        { x: 4000, y: 0, z: 0 },
        { x: 0, y: 3000, z: 0 },
      ],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a zero-area house outline", () => {
    const doc = minimalDocument();
    doc.site.houseOutlines.push({
      id: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 2000, y: 0, z: 0 },
      ],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a house outline with a duplicated vertex", () => {
    const doc = minimalDocument();
    doc.site.houseOutlines.push({
      id: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 3000, z: 0 },
      ],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("accepts a roof plane with an exact 2690 mm reference elevation attached to a house outline", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: 0,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      const [roofPlane] = result.data.site.roofPlanes;
      expect(roofPlane!.referenceElevationMm).toBe(2690);
    }
  });

  it("accepts a gutter referencing a valid roof plane, house outline, and edge index", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: Math.PI / 2,
    });
    doc.site.gutters.push({
      id: "gutter-1",
      roofPlaneId: "roof-1",
      houseOutlineId: "house-1",
      edgeIndex: 2,
      widthMm: 100,
      dropMm: 50,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
  });

  it("rejects a gutter referencing an unknown roof plane", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.gutters.push({
      id: "gutter-1",
      roofPlaneId: "missing-roof",
      houseOutlineId: "house-1",
      edgeIndex: 0,
      widthMm: 100,
      dropMm: 50,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a gutter edge index out of range for its house outline", () => {
    const doc = withHouseOutline(minimalDocument());
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: 0,
    });
    doc.site.gutters.push({
      id: "gutter-1",
      roofPlaneId: "roof-1",
      houseOutlineId: "house-1",
      edgeIndex: 99,
      widthMm: 100,
      dropMm: 50,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  function withFanFieldFixtures(doc: ProjectDocument): ProjectDocument {
    doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
    doc.anchors.push(
      { id: "source-1", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
      { id: "edge-start", kind: "post-top", positionMm: { x: 0, y: 4000, z: 2300 } },
      { id: "edge-end", kind: "post-top", positionMm: { x: 4000, y: 4000, z: 2300 } },
    );
    doc.members.push({
      id: "rafter-1",
      role: "fan-rafter",
      startAnchorId: "source-1",
      endAnchorId: "edge-start",
      sectionId: "sec-rafter",
      rollRad: 0,
    });
    return doc;
  }

  it("accepts a fan field with an edge target", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["rafter-1"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
  });

  it("accepts a fan field with a parabolic elevation rule and a spacing distribution", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "spacing", spacingMm: 600 },
      reversed: true,
      elevationRule: { kind: "parabolic", sagMm: 150 },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["rafter-1"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
  });

  it("rejects a fan field referencing an unknown source anchor", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "missing",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["rafter-1"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a fan field whose member target does not exist", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "member", memberId: "missing" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["rafter-1"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a fan field whose memberIds reference a member that does not exist", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["missing-member"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("rejects a fan distribution count below 2", () => {
    const doc = withFanFieldFixtures(minimalDocument());
    doc.fanFields.push({
      id: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 1 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter", rollRad: 0 },
      memberIds: ["rafter-1"],
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(false);
  });

  it("accepts a document with a fully cross-referenced post", () => {
    const doc = minimalDocument();
    doc.sections.push({ id: "sec-post", name: "Post section", widthMm: 140, heightMm: 140 });
    doc.anchors.push(
      { id: "a-base", kind: "post-base", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-top", kind: "post-top", positionMm: { x: 0, y: 0, z: 2400 } },
    );
    doc.posts.push({
      id: "post-1",
      baseAnchorId: "a-base",
      topAnchorId: "a-top",
      sectionId: "sec-post",
      heightMm: 2400,
    });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
  });
});
