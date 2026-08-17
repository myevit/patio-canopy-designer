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
