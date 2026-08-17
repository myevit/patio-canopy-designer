import { describe, expect, it } from "vitest";
import { createEmptyProjectDocument } from "./empty-project.js";
import type { ProjectDocument } from "./design-schema.js";
import { findTopologyIssues } from "./topology-diagnostics.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Untitled", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 89, heightMm: 38 });
  return doc;
}

describe("findTopologyIssues", () => {
  it("flags an unresolved connection for a shared-endpoint candidate with no joint", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1000, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-3", sectionId: "sec-beam", rollRad: 0 },
    );
    const issues = findTopologyIssues(doc);
    expect(issues.some((issue) => issue.kind === "unresolved-connection" && issue.memberIds.includes("m-1"))).toBe(
      true,
    );
  });

  it("does not flag a connection once it has a confirmed joint", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1000, y: 1000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-3", sectionId: "sec-beam", rollRad: 0 },
    );
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["m-1", "m-2"],
      positionMm: { x: 1000, y: 0, z: 0 },
      crossingBehavior: "structural-joint",
      engineeringStatus: "engineer-review-required",
    });
    const issues = findTopologyIssues(doc);
    expect(issues.some((issue) => issue.kind === "unresolved-connection")).toBe(false);
  });

  it("flags a near-zero-length member", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 0.2, y: 0, z: 0 } },
    );
    doc.members.push({
      id: "m-1",
      role: "perimeter-beam",
      startAnchorId: "a-1",
      endAnchorId: "a-2",
      sectionId: "sec-beam",
      rollRad: 0,
    });
    const issues = findTopologyIssues(doc);
    expect(issues.some((issue) => issue.kind === "near-zero-length-member" && issue.memberIds[0] === "m-1")).toBe(
      true,
    );
  });

  it("flags two members that share both anchors as duplicates", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-2", endAnchorId: "a-1", sectionId: "sec-beam", rollRad: 0 },
    );
    const issues = findTopologyIssues(doc);
    const duplicate = issues.find((issue) => issue.kind === "duplicate-member");
    expect(duplicate).toBeDefined();
    expect(duplicate!.memberIds.sort()).toEqual(["m-1", "m-2"]);
  });

  it("flags two collinear members whose segments overlap without sharing an anchor", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 2000, y: 0, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 3000, y: 0, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
    );
    const issues = findTopologyIssues(doc);
    const overlap = issues.find((issue) => issue.kind === "overlapping-members");
    expect(overlap).toBeDefined();
    expect(overlap!.memberIds.sort()).toEqual(["m-1", "m-2"]);
  });

  it("flags three members crossing at the same point as an ambiguous intersection", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 500, y: 0, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 500, y: 1000, z: 0 } },
      { id: "a-5", kind: "free", positionMm: { x: 0, y: 1000, z: 0 } },
      { id: "a-6", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-3", role: "perimeter-beam", startAnchorId: "a-5", endAnchorId: "a-6", sectionId: "sec-beam", rollRad: 0 },
    );
    const issues = findTopologyIssues(doc);
    const ambiguous = issues.find((issue) => issue.kind === "ambiguous-intersection");
    expect(ambiguous).toBeDefined();
    expect(ambiguous!.memberIds.sort()).toEqual(["m-1", "m-2", "m-3"]);
  });

  it("flags an existing joint that no longer matches its members' current geometry", () => {
    const doc = baseDoc();
    doc.anchors.push(
      { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 0 } },
      { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 0 } },
      { id: "a-3", kind: "free", positionMm: { x: 500, y: 5000, z: 0 } },
      { id: "a-4", kind: "free", positionMm: { x: 500, y: 6000, z: 0 } },
    );
    doc.members.push(
      { id: "m-1", role: "perimeter-beam", startAnchorId: "a-1", endAnchorId: "a-2", sectionId: "sec-beam", rollRad: 0 },
      { id: "m-2", role: "perimeter-beam", startAnchorId: "a-3", endAnchorId: "a-4", sectionId: "sec-beam", rollRad: 0 },
    );
    doc.joints.push({
      id: "joint-1",
      connectedMemberIds: ["m-1", "m-2"],
      positionMm: { x: 500, y: 500, z: 0 },
      crossingBehavior: "structural-joint",
      engineeringStatus: "engineer-review-required",
    });
    const issues = findTopologyIssues(doc);
    const needsResolution = issues.find((issue) => issue.kind === "joint-needs-resolution");
    expect(needsResolution).toBeDefined();
    expect(needsResolution!.memberIds.sort()).toEqual(["m-1", "m-2"]);
  });
});
