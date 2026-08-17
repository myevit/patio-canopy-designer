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
});
