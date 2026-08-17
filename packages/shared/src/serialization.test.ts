import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "./empty-project.js";
import { exportProjectDocument, importProjectDocument } from "./serialization.js";

describe("exportProjectDocument / importProjectDocument", () => {
  it("round-trips a document losslessly, including an exact 2690 mm reference elevation", () => {
    const doc = createEmptyProjectDocument({ name: "Round trip", createdAt: "2026-08-16T00:00:00.000Z" });
    doc.site.houseOutlines.push({
      id: "house-1",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 0, z: 0 },
        { x: 4000, y: 3000, z: 0 },
        { x: 0, y: 3000, z: 0 },
      ],
    });
    doc.site.roofPlanes.push({
      id: "roof-1",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchDeg: 12,
      directionRad: 0,
      gutter: { widthMm: 100, dropMm: 50 },
    });

    const json = exportProjectDocument(doc);
    const imported = importProjectDocument(json);

    expect(imported.success).toBe(true);
    if (imported.success) {
      expect(imported.document).toEqual(doc);
      expect(imported.document.site.roofPlanes[0]!.referenceElevationMm).toBe(2690);
    }
  });

  it("rejects text that is not valid JSON with a recoverable error", () => {
    const result = importProjectDocument("{not json");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not valid json/i);
    }
  });

  it("rejects JSON that does not match the schema with a recoverable error", () => {
    const result = importProjectDocument(JSON.stringify({ hello: "world" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
