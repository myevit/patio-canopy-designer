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
    site: { houseOutlines: [], roofPlanes: [], patioOutlines: [] },
    anchors: [],
    sections: [],
    materials: [],
    posts: [],
    members: [],
    fanFields: [],
    joints: [],
  };
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
