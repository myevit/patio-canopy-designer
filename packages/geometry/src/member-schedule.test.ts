import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { buildMemberSchedule } from "./member-schedule.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Test", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-rafter", name: "Rafter", widthMm: 89, heightMm: 38 });
  doc.materials.push({ id: "mat-cedar", name: "Cedar" });
  return doc;
}

function addMember(doc: ProjectDocument, id: string, lengthMm: number, sectionId = "sec-rafter", materialId?: string) {
  doc.anchors.push(
    { id: `${id}-a`, kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
    { id: `${id}-b`, kind: "free", positionMm: { x: lengthMm, y: 0, z: 0 } },
  );
  doc.members.push({
    id,
    role: "perimeter-beam",
    startAnchorId: `${id}-a`,
    endAnchorId: `${id}-b`,
    sectionId,
    materialId,
    rollRad: 0,
  });
}

describe("buildMemberSchedule", () => {
  it("includes every physical member exactly once across rows and the near-zero list", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3000, "sec-rafter", "mat-cedar");
    addMember(doc, "m-2", 3000, "sec-rafter", "mat-cedar");
    addMember(doc, "m-3", 4500, "sec-rafter", "mat-cedar");
    doc.anchors.push(
      { id: "post-a", kind: "free", positionMm: { x: 0, y: 1000, z: 0 } },
      { id: "post-b", kind: "free", positionMm: { x: 0, y: 1000, z: 2400 } },
    );
    doc.posts.push({ id: "post-1", baseAnchorId: "post-a", topAnchorId: "post-b", sectionId: "sec-rafter", heightMm: 2400 });

    const schedule = buildMemberSchedule(doc);
    const allIds = schedule.rows.flatMap((row) => row.memberIds).sort();
    expect(allIds).toEqual(["m-1", "m-2", "m-3", "post-1"]);
    // No id appears twice.
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(schedule.nearZeroMemberIds).toEqual([]);
  });

  it("groups members by section, material, and finished length into one row with an accurate quantity", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3000, "sec-rafter", "mat-cedar");
    addMember(doc, "m-2", 3000, "sec-rafter", "mat-cedar");

    const schedule = buildMemberSchedule(doc);
    expect(schedule.rows).toHaveLength(1);
    expect(schedule.rows[0]!.quantity).toBe(2);
    expect(schedule.rows[0]!.memberIds.sort()).toEqual(["m-1", "m-2"]);
  });

  it("keeps members with different finished lengths in separate rows", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3000, "sec-rafter", "mat-cedar");
    addMember(doc, "m-2", 4500, "sec-rafter", "mat-cedar");

    const schedule = buildMemberSchedule(doc);
    expect(schedule.rows).toHaveLength(2);
    expect(schedule.rows.map((r) => r.quantity)).toEqual([1, 1]);
  });

  it("keeps the stock allowance explicit and separate from the exact finished length", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3550, "sec-rafter", "mat-cedar");

    const schedule = buildMemberSchedule(doc, 50);
    const row = schedule.rows[0]!;
    expect(row.finishedLengthMm).toBe(3550);
    expect(row.stockAllowanceMm).toBe(50);
    expect(row.stockLengthMm).toBeGreaterThanOrEqual(row.finishedLengthMm + row.stockAllowanceMm);
    expect(row.stockLengthMm).not.toBe(row.finishedLengthMm);
  });

  it("excludes near-zero-length members from rows but still reports them for review", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3000, "sec-rafter", "mat-cedar");
    addMember(doc, "tiny", 0.5, "sec-rafter", "mat-cedar");

    const schedule = buildMemberSchedule(doc);
    const rowIds = schedule.rows.flatMap((row) => row.memberIds);
    expect(rowIds).not.toContain("tiny");
    expect(schedule.nearZeroMemberIds).toEqual(["tiny"]);
  });

  it("traces every row back to stable model ids that exist in the document", () => {
    const doc = baseDoc();
    addMember(doc, "m-1", 3000, "sec-rafter", "mat-cedar");
    const schedule = buildMemberSchedule(doc);
    const memberIds = new Set(doc.members.map((m) => m.id));
    schedule.rows.forEach((row) => {
      row.memberIds.forEach((id) => expect(memberIds.has(id)).toBe(true));
    });
  });
});
