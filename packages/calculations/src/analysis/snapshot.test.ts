import { describe, expect, it } from "vitest";
import { freezeAnalysisSnapshot } from "./snapshot.js";
import { twoPostFrame } from "./test-fixtures.js";

describe("freezeAnalysisSnapshot", () => {
  it("captures the document's revision and content", () => {
    const document = twoPostFrame();
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    expect(snapshot.revision).toBe(document.revision);
    expect(snapshot.frozenAtIso).toBe("2026-08-17T00:00:00.000Z");
    expect(snapshot.document.members).toEqual(document.members);
  });

  it("is unaffected by later mutation of the original document (deep clone, not a reference)", () => {
    const document = twoPostFrame();
    const snapshot = freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
    document.members.push({
      id: "beam-mutated-in",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-a-top",
      endAnchorId: "anchor-post-b-top",
      sectionId: "section-beam",
      rollRad: 0,
    });
    document.metadata.name = "mutated";
    expect(snapshot.document.members).toHaveLength(1);
    expect(snapshot.document.metadata.name).toBe("fixture");
  });

  it("cannot itself be mutated - analysis must never write back to the authoring document", () => {
    const snapshot = freezeAnalysisSnapshot(twoPostFrame(), "2026-08-17T00:00:00.000Z");
    expect(() => {
      // @ts-expect-error -- intentionally attempting a disallowed mutation
      snapshot.document.members.push({});
    }).toThrow();
    expect(() => {
      snapshot.document.metadata.name = "mutated";
    }).toThrow();
  });
});
