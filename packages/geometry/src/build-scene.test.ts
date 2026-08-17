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
          pointMm: { x: 0, y: 0, z: 2700 },
          normal: { x: 0, y: 0, z: 1 },
          outline: [
            { x: 0, y: 0, z: 2700 },
            { x: 100, y: 0, z: 2700 },
            { x: 100, y: 100, z: 2400 },
          ],
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
      widthMm: 140,
      depthMm: 140,
    });
  });

  it("resolves a member's start/end anchors, role, and section dimensions", () => {
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

  it("passes through house outline, roof plane, and patio outline points", () => {
    const scene = buildScene(fixtureDocument());
    expect(scene.houseOutlines).toEqual([
      { id: "house-1", kind: "house-outline", points: fixtureDocument().site.houseOutlines[0]!.points },
    ]);
    expect(scene.roofPlanes).toEqual([
      { id: "roof-1", kind: "roof-plane", outline: fixtureDocument().site.roofPlanes[0]!.outline },
    ]);
    expect(scene.patioOutlines).toEqual([
      { id: "patio-1", kind: "patio-outline", points: fixtureDocument().site.patioOutlines[0]!.points },
    ]);
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
    expect(scene.patioOutlines).toHaveLength(1);
  });
});
