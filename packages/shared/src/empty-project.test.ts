import { describe, expect, it } from "vitest";
import { parseProjectDocument } from "./design-schema.js";
import { createEmptyProjectDocument } from "./empty-project.js";

describe("createEmptyProjectDocument", () => {
  it("creates a schema-valid empty project with the given name and timestamp", () => {
    const doc = createEmptyProjectDocument({ name: "Untitled project", createdAt: "2026-08-16T00:00:00.000Z" });
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
    expect(doc.metadata.name).toBe("Untitled project");
    expect(doc.metadata.createdAt).toBe("2026-08-16T00:00:00.000Z");
    expect(doc.site.houseOutlines).toEqual([]);
    expect(doc.revision).toBe(0);
  });

  it("includes default post and beam sections so authoring tools have something to reference", () => {
    const doc = createEmptyProjectDocument({ name: "Untitled project", createdAt: "2026-08-16T00:00:00.000Z" });
    expect(doc.posts).toEqual([]);
    expect(doc.sections.length).toBeGreaterThanOrEqual(2);
    expect(doc.sections.every((s) => s.widthMm > 0 && s.heightMm > 0)).toBe(true);
    const result = parseProjectDocument(doc);
    expect(result.success).toBe(true);
  });
});
