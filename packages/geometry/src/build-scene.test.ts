import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, SAMPLE_PROJECT, type ProjectDocument } from "@canopy/shared";
import { buildScene } from "./build-scene.js";

function fixtureDocument(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 1,
    metadata: { name: "Fixture", createdAt: "2026-08-16T00:00:00.000Z" },
    displayUnits: "mm",
    site: {
      houseOutlines: [
        {
          id: "house-1",
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            { x: 100, y: 100, z: 0 },
          ],
        },
      ],
      roofPlanes: [
        {
          id: "roof-1",
          houseOutlineId: "house-1",
          referenceElevationMm: 2700,
          pitchRad: (10 * Math.PI) / 180,
          directionRad: Math.PI / 2,
        },
      ],
      gutters: [
        {
          id: "gutter-1",
          roofPlaneId: "roof-1",
          houseOutlineId: "house-1",
          edgeIndex: 1,
          widthMm: 100,
          dropMm: 50,
        },
      ],
      patioOutlines: [
        {
          id: "patio-1",
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 200, y: 0, z: 0 },
            { x: 200, y: 200, z: 0 },
          ],
        },
      ],
    },
    anchors: [
      { id: "a-base", kind: "post-base", positionMm: { x: 10, y: 20, z: 0 } },
      { id: "a-top", kind: "post-top", positionMm: { x: 10, y: 20, z: 2400 } },
      { id: "a-start", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
    ],
    sections: [
      { id: "sec-post", name: "Post", widthMm: 140, heightMm: 140 },
      { id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 },
    ],
    materials: [],
    posts: [
      { id: "post-1", baseAnchorId: "a-base", topAnchorId: "a-top", sectionId: "sec-post", heightMm: 2400 },
    ],
    members: [
      {
        id: "member-1",
        role: "fan-rafter",
        startAnchorId: "a-start",
        endAnchorId: "a-top",
        sectionId: "sec-beam",
        rollRad: 0,
      },
    ],
    fanFields: [],
    joints: [
      {
        id: "joint-1",
        connectedMemberIds: ["member-1"],
        positionMm: { x: 5, y: 10, z: 2500 },
        crossingBehavior: "unresolved",
        engineeringStatus: "engineer-review-required",
      },
    ],
  };
}

describe("buildScene", () => {
  it("resolves a post's base/top anchors and section dimensions", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.posts).toHaveLength(1);
    const [post] = scene.posts;
    expect(post).toEqual({
      id: "post-1",
      kind: "post",
      base: { x: 10, y: 20, z: 0 },
      top: { x: 10, y: 20, z: 2400 },
      baseAnchorId: "a-base",
      topAnchorId: "a-top",
      widthMm: 140,
      depthMm: 140,
    });
  });

  it("exposes house-kind anchors as selectable house anchors in the scene", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.houseAnchors).toEqual([
      { id: "a-start", kind: "house-anchor", position: { x: 0, y: 0, z: 2700 } },
    ]);
  });

  it("resolves a member's start/end anchors, role, section dimensions, and roll", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.members).toHaveLength(1);
    const [member] = scene.members;
    expect(member).toEqual({
      id: "member-1",
      kind: "member",
      role: "fan-rafter",
      start: { x: 0, y: 0, z: 2700 },
      end: { x: 10, y: 20, z: 2400 },
      widthMm: 184,
      heightMm: 38,
      rollRad: 0,
    });
  });

  it("passes a joint's position and connected member ids through unchanged", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.joints).toEqual([
      {
        id: "joint-1",
        kind: "joint",
        position: { x: 5, y: 10, z: 2500 },
        connectedMemberIds: ["member-1"],
      },
    ]);
  });

  it("passes through house outline and patio outline points", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.houseOutlines).toEqual([
      { id: "house-1", kind: "house-outline", points: fixtureDocument().site.houseOutlines[0]!.points },
    ]);
    expect(scene.patioOutlines).toEqual([
      { id: "patio-1", kind: "patio-outline", points: fixtureDocument().site.patioOutlines[0]!.points },
    ]);
  });

  it("derives the roof plane's 3D outline from its house outline and pitch", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.roofPlanes).toHaveLength(1);
    const [roofPlane] = scene.roofPlanes;
    // The (100,100) vertex has the greatest projection along +y, so it is the eave.
    expect(roofPlane!.outline[2]).toEqual({ x: 100, y: 100, z: 2700 });
    expect(roofPlane!.outline[0]!.z).toBeGreaterThan(2700);
    expect(roofPlane!.houseOutlineId).toBe("house-1");
    expect(roofPlane!.referenceElevationMm).toBe(2700);
    expect(roofPlane!.pitchRad).toBeCloseTo((10 * Math.PI) / 180, 10);
  });

  it("derives a gutter from its referenced edge, sharing the reference elevation at both ends", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.gutters).toHaveLength(1);
    const [gutter] = scene.gutters;
    expect(gutter!.roofPlaneId).toBe("roof-1");
    expect(gutter!.widthMm).toBe(100);
    expect(gutter!.dropMm).toBe(50);
    expect(gutter!.start.z).toBe(2700);
    expect(gutter!.end.z).toBe(2700);
  });

  it("builds one wall per house outline edge, rising to the roof's reference elevation", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.walls).toHaveLength(3);
    for (const wall of scene.walls) {
      expect(wall.heightMm).toBe(2700);
    }
    expect(scene.walls[0]).toEqual({
      id: "house-1-wall-0",
      kind: "wall",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 100, y: 0, z: 0 },
      heightMm: 2700,
    });
  });

  it("builds walls for a house outline that has no roof plane, using a default height", () => {
    const doc = fixtureDocument();
    doc.site.roofPlanes = [];
    doc.site.gutters = [];
    const scene = buildScene(doc);
    expect(scene.walls).toHaveLength(3);
    expect(scene.roofPlanes).toHaveLength(0);
    for (const wall of scene.walls) {
      expect(wall.heightMm).toBeGreaterThan(0);
    }
  });

  it("builds exactly one set of walls per house outline even with multiple house outlines", () => {
    const doc = fixtureDocument();
    doc.site.houseOutlines.push({
      id: "house-2",
      points: [
        { x: 500, y: 500, z: 0 },
        { x: 600, y: 500, z: 0 },
        { x: 600, y: 600, z: 0 },
      ],
    });
    const scene = buildScene(doc);
    expect(scene.walls).toHaveLength(6);
    expect(scene.walls.filter((w) => w.id.startsWith("house-2"))).toHaveLength(3);
  });

  it("throws a descriptive error when a member references a section that cannot be resolved", () => {
    const doc = fixtureDocument();
    doc.members[0]!.sectionId = "missing-section";
    expect(() => buildScene(doc)).toThrow(/missing-section/);
  });

  it("builds a complete scene from the bundled sample project with matching object ids", () => {
    const scene = buildScene(SAMPLE_PROJECT);
    expect(scene.posts.map((p) => p.id).sort()).toEqual(
      SAMPLE_PROJECT.posts.map((p) => p.id).sort(),
    );
    expect(scene.members.map((m) => m.id).sort()).toEqual(
      SAMPLE_PROJECT.members.map((m) => m.id).sort(),
    );
    expect(scene.joints).toHaveLength(SAMPLE_PROJECT.joints.length);
    expect(scene.houseOutlines).toHaveLength(1);
    expect(scene.roofPlanes).toHaveLength(1);
    expect(scene.gutters).toHaveLength(1);
    expect(scene.patioOutlines).toHaveLength(1);
  });
});
