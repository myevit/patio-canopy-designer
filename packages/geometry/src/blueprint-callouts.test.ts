import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { assignJointMarks, assignMemberMarks, resolveJointMark, resolveMemberMark } from "./blueprint-callouts.js";
import { derivePhysicalMembers } from "./resolve-physical-members.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Test", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-post", name: "Post", widthMm: 89, heightMm: 89 });
  doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 89, heightMm: 38 });
  doc.anchors.push(
    { id: "a-post-1-base", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
    { id: "a-post-1-top", kind: "free", positionMm: { x: 0, y: 0, z: 2400 } },
    { id: "a-post-2-base", kind: "free", positionMm: { x: 1000, y: 0, z: 0 } },
    { id: "a-post-2-top", kind: "free", positionMm: { x: 1000, y: 0, z: 2400 } },
    { id: "a-beam-1", kind: "free", positionMm: { x: 0, y: 0, z: 2400 } },
    { id: "a-beam-2", kind: "free", positionMm: { x: 1000, y: 0, z: 2400 } },
  );
  doc.posts.push(
    { id: "post-b", baseAnchorId: "a-post-2-base", topAnchorId: "a-post-2-top", sectionId: "sec-post", heightMm: 2400 },
    { id: "post-a", baseAnchorId: "a-post-1-base", topAnchorId: "a-post-1-top", sectionId: "sec-post", heightMm: 2400 },
  );
  doc.members.push({
    id: "member-a",
    role: "perimeter-beam",
    startAnchorId: "a-beam-1",
    endAnchorId: "a-beam-2",
    sectionId: "sec-beam",
    rollRad: 0,
  });
  doc.joints.push(
    { id: "joint-b", connectedMemberIds: ["member-a"], positionMm: { x: 1000, y: 0, z: 2400 }, crossingBehavior: "structural-joint", engineeringStatus: "check-not-implemented" },
    { id: "joint-a", connectedMemberIds: ["member-a"], positionMm: { x: 0, y: 0, z: 2400 }, crossingBehavior: "structural-joint", engineeringStatus: "check-not-implemented" },
  );
  return doc;
}

describe("assignMemberMarks", () => {
  it("assigns posts P1..Pn and beams B1..Bn in sorted-id order, deterministically", () => {
    const doc = baseDoc();
    const marks = assignMemberMarks(derivePhysicalMembers(doc));

    expect(marks).toEqual([
      { memberId: "post-a", mark: "P1" },
      { memberId: "post-b", mark: "P2" },
      { memberId: "member-a", mark: "B1" },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const members = derivePhysicalMembers(baseDoc());
    expect(assignMemberMarks(members)).toEqual(assignMemberMarks(members));
  });
});

describe("assignJointMarks", () => {
  it("assigns J1..Jn in sorted-id order", () => {
    const marks = assignJointMarks(baseDoc().joints);
    expect(marks).toEqual([
      { jointId: "joint-a", mark: "J1" },
      { jointId: "joint-b", mark: "J2" },
    ]);
  });
});

describe("callout resolution", () => {
  it("resolves every generated member mark to a live post or member in the document", () => {
    const doc = baseDoc();
    const marks = assignMemberMarks(derivePhysicalMembers(doc));
    expect(marks.every((mark) => resolveMemberMark(mark, doc))).toBe(true);
  });

  it("resolves every generated joint mark to a live joint in the document", () => {
    const doc = baseDoc();
    const marks = assignJointMarks(doc.joints);
    expect(marks.every((mark) => resolveJointMark(mark, doc))).toBe(true);
  });

  it("fails to resolve a stale mark whose object has since been removed", () => {
    const doc = baseDoc();
    expect(resolveMemberMark({ memberId: "member-deleted", mark: "B9" }, doc)).toBe(false);
    expect(resolveJointMark({ jointId: "joint-deleted", mark: "J9" }, doc)).toBe(false);
  });
});
