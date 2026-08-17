import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "../empty-project.js";
import type { ProjectDocument } from "../design-schema.js";
import { applyCommand } from "./apply-command.js";
import type { DocumentCommand } from "./types.js";

function baseDoc(): ProjectDocument {
  return createEmptyProjectDocument({ name: "Untitled project", createdAt: "2026-08-16T00:00:00.000Z" });
}

function rectanglePoints() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

describe("applyCommand: create-house-outline", () => {
  it("adds a valid closed outline and bumps the revision", () => {
    const doc = baseDoc();
    const command: DocumentCommand = { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() };
    const result = applyCommand(doc, command);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.houseOutlines).toHaveLength(1);
      expect(result.document.site.houseOutlines[0]!.id).toBe("house-1");
      expect(result.document.revision).toBe(doc.revision + 1);
    }
  });

  it("rejects a self-intersecting outline with a recoverable message", () => {
    const doc = baseDoc();
    const command: DocumentCommand = {
      type: "create-house-outline",
      outlineId: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 3000, z: 0 },
        { x: 4000, y: 0, z: 0 },
        { x: 0, y: 3000, z: 0 },
      ],
    };
    const result = applyCommand(doc, command);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cross each other/i);
    }
  });

  it("rejects a duplicate house outline id", () => {
    const doc = baseDoc();
    const first = applyCommand(doc, { type: "create-house-outline", outlineId: "house-1", points: rectanglePoints() });
    expect(first.ok).toBe(true);
    const second = applyCommand((first as { ok: true; document: ProjectDocument }).document, {
      type: "create-house-outline",
      outlineId: "house-1",
      points: rectanglePoints().map((p) => ({ ...p, x: p.x + 10000 })),
    });
    expect(second.ok).toBe(false);
  });
});

describe("applyCommand: house outline vertex editing", () => {
  function withOutline(): ProjectDocument {
    const result = applyCommand(baseDoc(), {
      type: "create-house-outline",
      outlineId: "house-1",
      points: rectanglePoints(),
    });
    if (!result.ok) throw new Error("setup failed");
    return result.document;
  }

  it("moves a vertex to a new position", () => {
    const doc = withOutline();
    const result = applyCommand(doc, {
      type: "move-house-outline-vertex",
      outlineId: "house-1",
      vertexIndex: 0,
      position: { x: -500, y: -500, z: 0 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.houseOutlines[0]!.points[0]).toEqual({ x: -500, y: -500, z: 0 });
      expect(result.document.revision).toBe(doc.revision + 1);
    }
  });

  it("rejects a move that would make the outline self-intersect", () => {
    const doc = withOutline();
    const result = applyCommand(doc, {
      type: "move-house-outline-vertex",
      outlineId: "house-1",
      vertexIndex: 0,
      position: { x: 4000, y: 3000, z: 0 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects moving a vertex on an unknown outline", () => {
    const doc = withOutline();
    const result = applyCommand(doc, {
      type: "move-house-outline-vertex",
      outlineId: "missing",
      vertexIndex: 0,
      position: { x: 0, y: 0, z: 0 },
    });
    expect(result.ok).toBe(false);
  });

  it("inserts a vertex after the given index", () => {
    const doc = withOutline();
    const result = applyCommand(doc, {
      type: "insert-house-outline-vertex",
      outlineId: "house-1",
      afterIndex: 0,
      position: { x: 2000, y: -500, z: 0 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.houseOutlines[0]!.points).toHaveLength(5);
      expect(result.document.site.houseOutlines[0]!.points[1]).toEqual({ x: 2000, y: -500, z: 0 });
    }
  });

  it("deletes a vertex", () => {
    const inserted = applyCommand(withOutline(), {
      type: "insert-house-outline-vertex",
      outlineId: "house-1",
      afterIndex: 0,
      position: { x: 2000, y: -500, z: 0 },
    });
    if (!inserted.ok) throw new Error("setup failed");
    const result = applyCommand(inserted.document, {
      type: "delete-house-outline-vertex",
      outlineId: "house-1",
      vertexIndex: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.houseOutlines[0]!.points).toHaveLength(4);
    }
  });

  it("rejects deleting a vertex that would leave fewer than three points", () => {
    const doc = withOutline();
    const removeOne = applyCommand(doc, { type: "delete-house-outline-vertex", outlineId: "house-1", vertexIndex: 0 });
    if (!removeOne.ok) throw new Error("setup failed");
    const result = applyCommand(removeOne.document, {
      type: "delete-house-outline-vertex",
      outlineId: "house-1",
      vertexIndex: 0,
    });
    expect(result.ok).toBe(false);
  });
});

describe("applyCommand: roof plane", () => {
  function withOutline(): ProjectDocument {
    const result = applyCommand(baseDoc(), {
      type: "create-house-outline",
      outlineId: "house-1",
      points: rectanglePoints(),
    });
    if (!result.ok) throw new Error("setup failed");
    return result.document;
  }

  function addRoofPlane(doc: ProjectDocument, overrides: Partial<Record<string, unknown>> = {}) {
    return applyCommand(doc, {
      type: "add-roof-plane",
      roofPlaneId: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (10 * Math.PI) / 180,
      directionRad: Math.PI / 2,
      gutterId: "gutter-1",
      gutterWidthMm: 100,
      gutterDropMm: 50,
      ...overrides,
    } as never);
  }

  it("adds a roof plane referencing a house outline", () => {
    const doc = withOutline();
    const result = addRoofPlane(doc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.roofPlanes).toHaveLength(1);
      expect(result.document.site.roofPlanes[0]!.referenceElevationMm).toBe(2690);
    }
  });

  it("also creates a gutter attached to the eave edge for the given direction", () => {
    const doc = withOutline();
    const result = addRoofPlane(doc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.site.gutters).toHaveLength(1);
      const gutter = result.document.site.gutters[0]!;
      expect(gutter.roofPlaneId).toBe("roof-1");
      expect(gutter.houseOutlineId).toBe("house-1");
      // directionRad = +y, so the y=3000 edge (vertices 2,3) is the eave.
      expect(gutter.edgeIndex).toBe(2);
      expect(gutter.widthMm).toBe(100);
      expect(gutter.dropMm).toBe(50);
    }
  });

  it("rejects a roof plane referencing a missing house outline", () => {
    const doc = baseDoc();
    const result = addRoofPlane(doc, { houseOutlineId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("rejects a second roof plane on the same house outline", () => {
    const doc = withOutline();
    const first = addRoofPlane(doc);
    if (!first.ok) throw new Error("setup failed");
    const second = addRoofPlane(first.document, {
      roofPlaneId: "roof-2",
      gutterId: "gutter-2",
      referenceElevationMm: 2400,
      pitchRad: (8 * Math.PI) / 180,
    });
    expect(second.ok).toBe(false);
  });

  it("updates roof plane fields with a patch", () => {
    const doc = withOutline();
    const added = addRoofPlane(doc);
    if (!added.ok) throw new Error("setup failed");
    const result = applyCommand(added.document, {
      type: "update-roof-plane",
      roofPlaneId: "roof-1",
      patch: { pitchRad: (15 * Math.PI) / 180 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const roofPlane = result.document.site.roofPlanes[0]!;
      expect(roofPlane.pitchRad).toBeCloseTo((15 * Math.PI) / 180, 10);
      expect(roofPlane.referenceElevationMm).toBe(2690);
    }
  });

  it("rejects updating an unknown roof plane", () => {
    const doc = withOutline();
    const result = applyCommand(doc, {
      type: "update-roof-plane",
      roofPlaneId: "missing",
      patch: { pitchRad: (15 * Math.PI) / 180 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a pitch update outside the valid range", () => {
    const doc = withOutline();
    const added = addRoofPlane(doc);
    if (!added.ok) throw new Error("setup failed");
    const result = applyCommand(added.document, {
      type: "update-roof-plane",
      roofPlaneId: "roof-1",
      patch: { pitchRad: Math.PI / 2 },
    });
    expect(result.ok).toBe(false);
  });

  it("recomputes the gutter's eave edge when the roof direction changes", () => {
    const doc = withOutline();
    const added = addRoofPlane(doc);
    if (!added.ok) throw new Error("setup failed");
    expect(added.document.site.gutters[0]!.edgeIndex).toBe(2);

    const result = applyCommand(added.document, {
      type: "update-roof-plane",
      roofPlaneId: "roof-1",
      patch: { directionRad: 0 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // directionRad = +x now, so the x=4000 edge (vertices 1,2) is the eave.
      expect(result.document.site.gutters[0]!.edgeIndex).toBe(1);
    }
  });
});

describe("applyCommand: posts", () => {
  function withSection(): ProjectDocument {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-post", name: "Post", widthMm: 140, heightMm: 140 });
    return doc;
  }

  it("adds a post with fresh base/top anchors at the given position and height", () => {
    const doc = withSection();
    const result = applyCommand(doc, {
      type: "add-post",
      postId: "post-1",
      baseAnchorId: "anchor-base-1",
      topAnchorId: "anchor-top-1",
      sectionId: "sec-post",
      heightMm: 2400,
      position: { x: 1000, y: 2000, z: 0 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.posts).toHaveLength(1);
      expect(result.document.posts[0]).toEqual({
        id: "post-1",
        baseAnchorId: "anchor-base-1",
        topAnchorId: "anchor-top-1",
        sectionId: "sec-post",
        heightMm: 2400,
      });
      const base = result.document.anchors.find((a) => a.id === "anchor-base-1");
      const top = result.document.anchors.find((a) => a.id === "anchor-top-1");
      expect(base).toEqual({ id: "anchor-base-1", kind: "post-base", positionMm: { x: 1000, y: 2000, z: 0 } });
      expect(top).toEqual({ id: "anchor-top-1", kind: "post-top", positionMm: { x: 1000, y: 2000, z: 2400 } });
    }
  });

  it("rejects a post referencing an unknown section", () => {
    const doc = baseDoc();
    const result = applyCommand(doc, {
      type: "add-post",
      postId: "post-1",
      baseAnchorId: "anchor-base-1",
      topAnchorId: "anchor-top-1",
      sectionId: "missing-section",
      heightMm: 2400,
      position: { x: 0, y: 0, z: 0 },
    });
    expect(result.ok).toBe(false);
  });

  function withPost(): ProjectDocument {
    const result = applyCommand(withSection(), {
      type: "add-post",
      postId: "post-1",
      baseAnchorId: "anchor-base-1",
      topAnchorId: "anchor-top-1",
      sectionId: "sec-post",
      heightMm: 2400,
      position: { x: 1000, y: 2000, z: 0 },
    });
    if (!result.ok) throw new Error("setup failed");
    return result.document;
  }

  it("moves a post by updating its base and top anchor positions, preserving height", () => {
    const doc = withPost();
    const result = applyCommand(doc, {
      type: "move-post",
      postId: "post-1",
      position: { x: 5000, y: 6000, z: 0 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const base = result.document.anchors.find((a) => a.id === "anchor-base-1");
      const top = result.document.anchors.find((a) => a.id === "anchor-top-1");
      expect(base!.positionMm).toEqual({ x: 5000, y: 6000, z: 0 });
      expect(top!.positionMm).toEqual({ x: 5000, y: 6000, z: 2400 });
    }
  });

  it("moving a post also moves a beam that references its top anchor (reference-aware, not copied coordinates)", () => {
    const withBeam = applyCommand(withPost(), {
      type: "add-post",
      postId: "post-2",
      baseAnchorId: "anchor-base-2",
      topAnchorId: "anchor-top-2",
      sectionId: "sec-post",
      heightMm: 2400,
      position: { x: 9000, y: 2000, z: 0 },
    });
    if (!withBeam.ok) throw new Error("setup failed");
    const doc2 = withBeam.document;
    doc2.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    const beamResult = applyCommand(doc2, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-top-1",
      endAnchorId: "anchor-top-2",
      sectionId: "sec-beam",
    });
    if (!beamResult.ok) throw new Error("setup failed");

    const moved = applyCommand(beamResult.document, {
      type: "move-post",
      postId: "post-1",
      position: { x: 5000, y: 6000, z: 0 },
    });
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      const member = moved.document.members.find((m) => m.id === "member-1")!;
      const startAnchor = moved.document.anchors.find((a) => a.id === member.startAnchorId)!;
      expect(startAnchor.positionMm).toEqual({ x: 5000, y: 6000, z: 2400 });
    }
  });

  it("rejects moving an unknown post", () => {
    const doc = withPost();
    const result = applyCommand(doc, { type: "move-post", postId: "missing", position: { x: 0, y: 0, z: 0 } });
    expect(result.ok).toBe(false);
  });

  it("updates a post's height, recomputing the top anchor elevation", () => {
    const doc = withPost();
    const result = applyCommand(doc, {
      type: "update-post",
      postId: "post-1",
      patch: { heightMm: 3000 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.posts[0]!.heightMm).toBe(3000);
      const top = result.document.anchors.find((a) => a.id === "anchor-top-1");
      expect(top!.positionMm.z).toBe(3000);
    }
  });

  it("updates a post's section", () => {
    const doc = withPost();
    doc.sections.push({ id: "sec-post-2", name: "Post 2", widthMm: 90, heightMm: 90 });
    const result = applyCommand(doc, {
      type: "update-post",
      postId: "post-1",
      patch: { sectionId: "sec-post-2" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.posts[0]!.sectionId).toBe("sec-post-2");
    }
  });

  it("rejects updating an unknown post", () => {
    const doc = withPost();
    const result = applyCommand(doc, { type: "update-post", postId: "missing", patch: { heightMm: 1000 } });
    expect(result.ok).toBe(false);
  });

  it("deletes a post along with its base/top anchors", () => {
    const doc = withPost();
    const result = applyCommand(doc, { type: "delete-post", postId: "post-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.posts).toHaveLength(0);
      expect(result.document.anchors.find((a) => a.id === "anchor-base-1")).toBeUndefined();
      expect(result.document.anchors.find((a) => a.id === "anchor-top-1")).toBeUndefined();
    }
  });

  it("deleting a post cascades to delete beams connected to its anchors, never leaving a dangling reference", () => {
    const withBeam = applyCommand(withPost(), {
      type: "add-post",
      postId: "post-2",
      baseAnchorId: "anchor-base-2",
      topAnchorId: "anchor-top-2",
      sectionId: "sec-post",
      heightMm: 2400,
      position: { x: 9000, y: 2000, z: 0 },
    });
    if (!withBeam.ok) throw new Error("setup failed");
    const doc2 = withBeam.document;
    doc2.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    const beamResult = applyCommand(doc2, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-top-1",
      endAnchorId: "anchor-top-2",
      sectionId: "sec-beam",
    });
    if (!beamResult.ok) throw new Error("setup failed");

    const result = applyCommand(beamResult.document, { type: "delete-post", postId: "post-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.members.find((m) => m.id === "member-1")).toBeUndefined();
      expect(result.document.posts).toHaveLength(1);
    }
  });

  it("rejects deleting an unknown post", () => {
    const doc = withPost();
    const result = applyCommand(doc, { type: "delete-post", postId: "missing" });
    expect(result.ok).toBe(false);
  });
});

describe("applyCommand: house anchors", () => {
  it("adds a house-kind anchor at the given position", () => {
    const doc = baseDoc();
    const result = applyCommand(doc, {
      type: "add-house-anchor",
      anchorId: "anchor-house-1",
      position: { x: 100, y: 0, z: 2700 },
      sourceRef: "house-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.anchors).toEqual([
        { id: "anchor-house-1", kind: "house", positionMm: { x: 100, y: 0, z: 2700 }, sourceRef: "house-1" },
      ]);
    }
  });

  it("rejects a duplicate anchor id", () => {
    const added = applyCommand(baseDoc(), {
      type: "add-house-anchor",
      anchorId: "anchor-house-1",
      position: { x: 100, y: 0, z: 2700 },
    });
    if (!added.ok) throw new Error("setup failed");
    const result = applyCommand(added.document, {
      type: "add-house-anchor",
      anchorId: "anchor-house-1",
      position: { x: 200, y: 0, z: 2700 },
    });
    expect(result.ok).toBe(false);
  });
});

describe("applyCommand: beams", () => {
  function withTwoAnchors(): ProjectDocument {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    doc.anchors.push(
      { id: "anchor-1", kind: "free", positionMm: { x: 0, y: 0, z: 2400 } },
      { id: "anchor-2", kind: "free", positionMm: { x: 1000, y: 0, z: 2400 } },
    );
    return doc;
  }

  it("adds a beam referencing two distinct anchors", () => {
    const doc = withTwoAnchors();
    const result = applyCommand(doc, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-1",
      endAnchorId: "anchor-2",
      sectionId: "sec-beam",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.members[0]).toEqual({
        id: "member-1",
        role: "perimeter-beam",
        startAnchorId: "anchor-1",
        endAnchorId: "anchor-2",
        sectionId: "sec-beam",
        rollRad: 0,
      });
    }
  });

  it("rejects a beam whose start and end anchor are the same", () => {
    const doc = withTwoAnchors();
    const result = applyCommand(doc, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-1",
      endAnchorId: "anchor-1",
      sectionId: "sec-beam",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/different anchors/i);
    }
  });

  it("rejects a beam referencing an unknown anchor", () => {
    const doc = withTwoAnchors();
    const result = applyCommand(doc, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-1",
      endAnchorId: "missing",
      sectionId: "sec-beam",
    });
    expect(result.ok).toBe(false);
  });

  function withBeam(): ProjectDocument {
    const result = applyCommand(withTwoAnchors(), {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-1",
      endAnchorId: "anchor-2",
      sectionId: "sec-beam",
    });
    if (!result.ok) throw new Error("setup failed");
    return result.document;
  }

  it("updates a beam's section and roll", () => {
    const doc = withBeam();
    doc.sections.push({ id: "sec-beam-2", name: "Beam 2", widthMm: 89, heightMm: 38 });
    const result = applyCommand(doc, {
      type: "update-beam",
      memberId: "member-1",
      patch: { sectionId: "sec-beam-2", rollRad: 0.2 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.members[0]!.sectionId).toBe("sec-beam-2");
      expect(result.document.members[0]!.rollRad).toBeCloseTo(0.2, 10);
    }
  });

  it("rejects updating an unknown beam", () => {
    const doc = withBeam();
    const result = applyCommand(doc, { type: "update-beam", memberId: "missing", patch: { rollRad: 0.1 } });
    expect(result.ok).toBe(false);
  });

  it("deletes a beam", () => {
    const doc = withBeam();
    const result = applyCommand(doc, { type: "delete-beam", memberId: "member-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.members).toHaveLength(0);
    }
  });

  it("rejects deleting an unknown beam", () => {
    const doc = withBeam();
    const result = applyCommand(doc, { type: "delete-beam", memberId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("blocks deleting a beam that is still referenced by a joint, rather than leaving it dangling", () => {
    const doc = withBeam();
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["member-1"],
      positionMm: { x: 500, y: 0, z: 2400 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const result = applyCommand(doc, { type: "delete-beam", memberId: "member-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/joint-1/);
      expect(result.error).not.toMatch(/unknown member id/i);
    }
  });
});

describe("applyCommand: delete-post friendly joint block", () => {
  function withPostAndBeam(): ProjectDocument {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-post", name: "Post", widthMm: 140, heightMm: 140 });
    doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    const withPost = applyCommand(doc, {
      type: "add-post",
      postId: "post-1",
      baseAnchorId: "anchor-base-1",
      topAnchorId: "anchor-top-1",
      sectionId: "sec-post",
      heightMm: 2400,
      position: { x: 0, y: 0, z: 0 },
    });
    if (!withPost.ok) throw new Error("setup failed");
    const withOtherAnchor = applyCommand(withPost.document, {
      type: "add-house-anchor",
      anchorId: "anchor-other",
      position: { x: 1000, y: 0, z: 2400 },
    });
    if (!withOtherAnchor.ok) throw new Error("setup failed");
    const withBeam = applyCommand(withOtherAnchor.document, {
      type: "add-beam",
      memberId: "member-1",
      startAnchorId: "anchor-top-1",
      endAnchorId: "anchor-other",
      sectionId: "sec-beam",
    });
    if (!withBeam.ok) throw new Error("setup failed");
    return withBeam.document;
  }

  it("blocks deleting a post whose beam is still referenced by a joint, with a clear reason", () => {
    const doc = withPostAndBeam();
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["member-1"],
      positionMm: { x: 500, y: 0, z: 2400 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const snapshot = JSON.parse(JSON.stringify(doc));
    const result = applyCommand(doc, { type: "delete-post", postId: "post-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/joint-1/);
      expect(result.error).not.toMatch(/unknown/i);
    }
    expect(doc).toEqual(snapshot);
  });

  it("still deletes a post whose beam is not referenced by any joint", () => {
    const doc = withPostAndBeam();
    const result = applyCommand(doc, { type: "delete-post", postId: "post-1" });
    expect(result.ok).toBe(true);
  });
});

describe("applyCommand: delete-joint", () => {
  function withBeamAndJoint(): ProjectDocument {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 2400 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 2400 } },
    );
    doc.members.push({
      id: "member-1",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-beam",
      rollRad: 0,
    });
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["member-1"],
      positionMm: { x: 500, y: 0, z: 2400 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    return doc;
  }

  it("deletes a joint that connects ordinary beams", () => {
    const doc = withBeamAndJoint();
    const result = applyCommand(doc, { type: "delete-joint", jointId: "joint-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.joints).toHaveLength(0);
      expect(result.document.members).toHaveLength(1);
    }
  });

  it("rejects deleting an unknown joint", () => {
    const doc = withBeamAndJoint();
    const result = applyCommand(doc, { type: "delete-joint", jointId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("protects a joint that connects a fan field's derived rafter", () => {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
    doc.anchors.push(
      { id: "source-1", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
      { id: "edge-start", kind: "post-top", positionMm: { x: 0, y: 4000, z: 2300 } },
      { id: "edge-end", kind: "post-top", positionMm: { x: 4000, y: 4000, z: 2300 } },
    );
    const withField = applyCommand(doc, {
      type: "add-fan-field",
      fanFieldId: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter" },
    });
    if (!withField.ok) throw new Error("setup failed");
    const fieldDoc = withField.document;
    fieldDoc.joints.push({
      id: "joint-1",
      connectedMemberIds: [fieldDoc.fanFields[0]!.memberIds[0]!],
      positionMm: { x: 0, y: 4000, z: 2300 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const result = applyCommand(fieldDoc, { type: "delete-joint", jointId: "joint-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/fan field/i);
    }
  });
});

describe("applyCommand: fan fields", () => {
  function withSourceAndTarget(): ProjectDocument {
    const doc = baseDoc();
    doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
    doc.anchors.push(
      { id: "source-1", kind: "house", positionMm: { x: 0, y: 0, z: 2700 } },
      { id: "edge-start", kind: "post-top", positionMm: { x: 0, y: 4000, z: 2300 } },
      { id: "edge-end", kind: "post-top", positionMm: { x: 4000, y: 4000, z: 2300 } },
    );
    return doc;
  }

  function addField(doc: ProjectDocument, overrides: Partial<Record<string, unknown>> = {}) {
    return applyCommand(doc, {
      type: "add-fan-field",
      fanFieldId: "fan-1",
      sourceAnchorId: "source-1",
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" },
      distribution: { mode: "count", count: 3 },
      reversed: false,
      elevationRule: { kind: "linear" },
      memberTemplate: { sectionId: "sec-rafter" },
      ...overrides,
    } as never);
  }

  it("adds a fan field, generating deterministic target anchors and rafter members", () => {
    const doc = withSourceAndTarget();
    const result = addField(doc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.fanFields).toHaveLength(1);
      const field = result.document.fanFields[0]!;
      expect(field.memberIds).toEqual(["fan-1::rafter::0", "fan-1::rafter::1", "fan-1::rafter::2"]);
      expect(result.document.members).toHaveLength(3);
      expect(result.document.members.every((m) => m.role === "fan-rafter")).toBe(true);
      expect(result.document.members.every((m) => m.startAnchorId === "source-1")).toBe(true);
      const targetAnchors = result.document.anchors.filter((a) => a.kind === "fan-target");
      expect(targetAnchors).toHaveLength(3);
      expect(targetAnchors[0]!.positionMm).toEqual({ x: 0, y: 4000, z: 2300 });
      expect(targetAnchors[2]!.positionMm).toEqual({ x: 4000, y: 4000, z: 2300 });
    }
  });

  it("supports a member target", () => {
    const doc = withSourceAndTarget();
    doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 184, heightMm: 38 });
    const withBeam = applyCommand(doc, {
      type: "add-beam",
      memberId: "target-beam",
      startAnchorId: "edge-start",
      endAnchorId: "edge-end",
      sectionId: "sec-beam",
    });
    if (!withBeam.ok) throw new Error("setup failed");
    const result = addField(withBeam.document, { target: { kind: "member", memberId: "target-beam" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.fanFields[0]!.memberIds).toHaveLength(3);
    }
  });

  it("rejects a degenerate fan field and never mutates the original document", () => {
    const doc = withSourceAndTarget();
    const snapshot = JSON.parse(JSON.stringify(doc));
    const result = addField(doc, {
      target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-start" },
    });
    expect(result.ok).toBe(false);
    expect(doc).toEqual(snapshot);
  });

  it("rejects a fan field referencing an unreachable source anchor", () => {
    const doc = withSourceAndTarget();
    const result = addField(doc, { sourceAnchorId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("rejects a fan field referencing an unreachable target member", () => {
    const doc = withSourceAndTarget();
    const result = addField(doc, { target: { kind: "member", memberId: "missing" } });
    expect(result.ok).toBe(false);
  });

  function withField(): ProjectDocument {
    const result = addField(withSourceAndTarget());
    if (!result.ok) throw new Error("setup failed");
    return result.document;
  }

  it("regenerates members deterministically when the target is edited", () => {
    const doc = withField();
    const originalMemberIds = doc.fanFields[0]!.memberIds;
    const result = applyCommand(doc, {
      type: "update-fan-field",
      fanFieldId: "fan-1",
      patch: { target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-end" }, reversed: true },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const field = result.document.fanFields[0]!;
      expect(field.memberIds).toEqual(originalMemberIds);
      expect(field.reversed).toBe(true);
      const rafter0 = result.document.members.find((m) => m.id === field.memberIds[0])!;
      const targetAnchor = result.document.anchors.find((a) => a.id === rafter0.endAnchorId)!;
      // Reversed, so rafter 0 now lands on the far end of the target edge.
      expect(targetAnchor.positionMm).toEqual({ x: 4000, y: 4000, z: 2300 });
    }
  });

  it("changing the count regenerates the exact number of derived members", () => {
    const doc = withField();
    const result = applyCommand(doc, {
      type: "update-fan-field",
      fanFieldId: "fan-1",
      patch: { distribution: { mode: "count", count: 5 } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.fanFields[0]!.memberIds).toHaveLength(5);
      expect(result.document.members).toHaveLength(5);
      expect(result.document.anchors.filter((a) => a.kind === "fan-target")).toHaveLength(5);
    }
  });

  it("rejects an update that would make the field degenerate, leaving the document unchanged", () => {
    const doc = withField();
    const snapshot = JSON.parse(JSON.stringify(doc));
    const result = applyCommand(doc, {
      type: "update-fan-field",
      fanFieldId: "fan-1",
      patch: { target: { kind: "edge", startAnchorId: "edge-start", endAnchorId: "edge-start" } },
    });
    expect(result.ok).toBe(false);
    expect(doc).toEqual(snapshot);
  });

  it("blocks regeneration that would orphan a joint referencing a derived rafter, with an explicit recoverable reason instead of a raw schema error", () => {
    const doc = withField();
    // Regenerating with fewer members drops the highest-index derived rafter
    // (ids are stable by index, so shrinking the count is what orphans it).
    const droppedMemberId = doc.fanFields[0]!.memberIds[2]!;
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: [droppedMemberId],
      positionMm: { x: 0, y: 4000, z: 2300 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const snapshot = JSON.parse(JSON.stringify(doc));
    const result = applyCommand(doc, {
      type: "update-fan-field",
      fanFieldId: "fan-1",
      patch: { distribution: { mode: "count", count: 2 } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/joint-1/);
      expect(result.error).toContain(droppedMemberId);
      expect(result.error).not.toMatch(/unknown member id/i);
    }
    expect(doc).toEqual(snapshot);
  });

  it("does not block growing a fan field's count, and surviving indices keep their stable ids", () => {
    const doc = withField();
    const originalMemberIds = doc.fanFields[0]!.memberIds;
    const result = applyCommand(doc, {
      type: "update-fan-field",
      fanFieldId: "fan-1",
      patch: { distribution: { mode: "count", count: 5 } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.fanFields[0]!.memberIds.slice(0, 3)).toEqual(originalMemberIds);
    }
  });

  it("rejects updating an unknown fan field", () => {
    const doc = withSourceAndTarget();
    const result = applyCommand(doc, { type: "update-fan-field", fanFieldId: "missing", patch: { reversed: true } });
    expect(result.ok).toBe(false);
  });

  it("deletes a fan field along with its derived anchors and members", () => {
    const doc = withField();
    const result = applyCommand(doc, { type: "delete-fan-field", fanFieldId: "fan-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.fanFields).toHaveLength(0);
      expect(result.document.members).toHaveLength(0);
      expect(result.document.anchors.filter((a) => a.kind === "fan-target")).toHaveLength(0);
    }
  });

  it("blocks deleting a fan field whose derived rafter is referenced by a joint", () => {
    const doc = withField();
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: [doc.fanFields[0]!.memberIds[0]!],
      positionMm: { x: 0, y: 4000, z: 2300 },
      crossingBehavior: "unresolved",
      engineeringStatus: "engineer-review-required",
    });
    const result = applyCommand(doc, { type: "delete-fan-field", fanFieldId: "fan-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/joint-1/);
      expect(result.error).not.toMatch(/unknown member id/i);
    }
  });

  it("rejects deleting an unknown fan field", () => {
    const doc = withSourceAndTarget();
    const result = applyCommand(doc, { type: "delete-fan-field", fanFieldId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("blocks deleting an individual derived rafter member directly, protecting fan field referential integrity", () => {
    const doc = withField();
    const memberId = doc.fanFields[0]!.memberIds[0]!;
    const result = applyCommand(doc, { type: "delete-beam", memberId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/fan field/i);
      expect(result.error).not.toMatch(/unknown member id/i);
    }
  });

  it("blocks a direct update-beam on a derived rafter with a clear, recoverable reason", () => {
    const doc = withField();
    const memberId = doc.fanFields[0]!.memberIds[0]!;
    const snapshot = JSON.parse(JSON.stringify(doc));
    const result = applyCommand(doc, { type: "update-beam", memberId, patch: { rollRad: 0.3 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/fan field/i);
    }
    expect(doc).toEqual(snapshot);
  });

});

describe("applyCommand: update-gutter", () => {
  function withRoofedOutline(): ProjectDocument {
    const withOutlineResult = applyCommand(baseDoc(), {
      type: "create-house-outline",
      outlineId: "house-1",
      points: rectanglePoints(),
    });
    if (!withOutlineResult.ok) throw new Error("setup failed");
    const withRoof = applyCommand(withOutlineResult.document, {
      type: "add-roof-plane",
      roofPlaneId: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (10 * Math.PI) / 180,
      directionRad: Math.PI / 2,
      gutterId: "gutter-1",
      gutterWidthMm: 100,
      gutterDropMm: 50,
    });
    if (!withRoof.ok) throw new Error("setup failed");
    return withRoof.document;
  }

  it("updates gutter width and drop", () => {
    const doc = withRoofedOutline();
    const result = applyCommand(doc, {
      type: "update-gutter",
      gutterId: "gutter-1",
      patch: { widthMm: 150, dropMm: 75 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const gutter = result.document.site.gutters[0]!;
      expect(gutter.widthMm).toBe(150);
      expect(gutter.dropMm).toBe(75);
    }
  });

  it("rejects updating an unknown gutter", () => {
    const doc = withRoofedOutline();
    const result = applyCommand(doc, {
      type: "update-gutter",
      gutterId: "missing",
      patch: { widthMm: 150 },
    });
    expect(result.ok).toBe(false);
  });
});
