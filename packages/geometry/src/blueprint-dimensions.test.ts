import { createEmptyProjectDocument, formatLengthMm, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { buildMemberLengthDimension, buildOverallDimension } from "./blueprint-dimensions.js";
import { projectPoint } from "./blueprint-projection.js";
import { derivePhysicalMembers } from "./resolve-physical-members.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Test", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
  doc.anchors.push(
    { id: "a-1", kind: "free", positionMm: { x: 0, y: 500, z: 3000 } },
    { id: "a-2", kind: "free", positionMm: { x: 1000, y: 500, z: 3000 } },
  );
  doc.members.push({
    id: "member-1",
    role: "perimeter-beam",
    startAnchorId: "a-1",
    endAnchorId: "a-2",
    sectionId: "sec-rafter",
    rollRad: 0,
  });
  return doc;
}

describe("buildMemberLengthDimension", () => {
  it("sources its value from the member's own trimmed finished length, not a re-derived measurement", () => {
    const [member] = derivePhysicalMembers(baseDoc());
    const dimension = buildMemberLengthDimension(member!, "plan", "mm");

    expect(dimension.valueMm).toBe(member!.trimmed.finishedLengthMm);
    expect(dimension.label).toBe(formatLengthMm(member!.trimmed.finishedLengthMm, "mm"));
    expect(dimension.memberId).toBe("member-1");
  });

  it("places its endpoints at the member's projected start/end, per view plane", () => {
    const [member] = derivePhysicalMembers(baseDoc());
    const dimension = buildMemberLengthDimension(member!, "front", "mm");

    expect(dimension.a).toEqual(projectPoint(member!.startMm, "front"));
    expect(dimension.b).toEqual(projectPoint(member!.endMm, "front"));
  });

  it("is deterministic across repeated calls with the same member", () => {
    const [member] = derivePhysicalMembers(baseDoc());
    expect(buildMemberLengthDimension(member!, "side", "m")).toEqual(buildMemberLengthDimension(member!, "side", "m"));
  });
});

describe("buildOverallDimension", () => {
  it("computes an analytic bounding-box span from the given projected points", () => {
    const points = [
      { x: -50, y: 500 },
      { x: 1050, y: 500 },
      { x: 500, y: 500 },
    ];
    const dimension = buildOverallDimension(points, "x", 600, "mm");

    expect(dimension.valueMm).toBe(1100);
    expect(dimension.label).toBe(formatLengthMm(1100, "mm"));
    expect(dimension.a).toEqual({ x: -50, y: 600 });
    expect(dimension.b).toEqual({ x: 1050, y: 600 });
  });

  it("supports the y axis with the fixed coordinate held on x", () => {
    const points = [
      { x: 0, y: -200 },
      { x: 0, y: 300 },
    ];
    const dimension = buildOverallDimension(points, "y", 42, "mm");

    expect(dimension.valueMm).toBe(500);
    expect(dimension.a).toEqual({ x: 42, y: -200 });
    expect(dimension.b).toEqual({ x: 42, y: 300 });
  });
});
