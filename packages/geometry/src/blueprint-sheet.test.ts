import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { resolveJointMark, resolveMemberMark } from "./blueprint-callouts.js";
import { buildBlueprintSheetSet } from "./blueprint-sheet.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Fixture Canopy", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-post", name: "Post", widthMm: 89, heightMm: 89 });
  doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 89, heightMm: 38 });
  doc.anchors.push(
    { id: "a-post-1-base", kind: "free", positionMm: { x: 0, y: 0, z: 0 } },
    { id: "a-post-1-top", kind: "free", positionMm: { x: 0, y: 0, z: 2400 } },
    { id: "a-post-2-base", kind: "free", positionMm: { x: 3000, y: 0, z: 0 } },
    { id: "a-post-2-top", kind: "free", positionMm: { x: 3000, y: 0, z: 2400 } },
  );
  doc.posts.push(
    { id: "post-1", baseAnchorId: "a-post-1-base", topAnchorId: "a-post-1-top", sectionId: "sec-post", heightMm: 2400 },
    { id: "post-2", baseAnchorId: "a-post-2-base", topAnchorId: "a-post-2-top", sectionId: "sec-post", heightMm: 2400 },
  );
  doc.members.push({
    id: "beam-1",
    role: "perimeter-beam",
    startAnchorId: "a-post-1-top",
    endAnchorId: "a-post-2-top",
    sectionId: "sec-beam",
    rollRad: 0,
  });
  return doc;
}

const GENERATED_AT = "2026-08-17T09:00:00.000Z";

describe("buildBlueprintSheetSet", () => {
  it("is deterministic: regenerating from the same document produces an identical sheet set", () => {
    const doc = baseDoc();
    const a = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT });
    const b = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT });
    expect(a).toEqual(b);
  });

  it("carries revision metadata sourced from the document, plus the supplied generation date", () => {
    const doc = baseDoc();
    doc.revision = 7;
    const sheetSet = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT });
    for (const sheet of sheetSet.sheets) {
      expect(sheet.titleBlock.projectName).toBe("Fixture Canopy");
      expect(sheet.titleBlock.revision).toBe(7);
      expect(sheet.titleBlock.date).toBe(GENERATED_AT);
      expect(sheet.titleBlock.scale).toMatch(/^1:\d/);
    }
  });

  it("produces a drawing sheet whose every member mark and joint mark resolves to a live object", () => {
    const doc = baseDoc();
    const [drawingSheet] = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT }).sheets;
    expect(drawingSheet!.views.length).toBeGreaterThan(0);
    for (const view of drawingSheet!.views) {
      for (const member of view.members) {
        expect(resolveMemberMark({ memberId: member.memberId, mark: member.mark }, doc)).toBe(true);
      }
      for (const joint of view.joints) {
        expect(resolveJointMark({ jointId: joint.jointId, mark: joint.mark }, doc)).toBe(true);
      }
    }
  });

  it("includes a schedule sheet carrying the document's unresolved topology issues", () => {
    // Two members sharing endpoints with no confirmed joint: an unresolved connection.
    const doc = baseDoc();
    doc.anchors.push({ id: "a-3", kind: "free", positionMm: { x: 1500, y: 0, z: 2400 } });
    doc.members.push({
      id: "beam-2",
      role: "perimeter-beam",
      startAnchorId: "a-post-1-top",
      endAnchorId: "a-3",
      sectionId: "sec-beam",
      rollRad: 0,
    });

    const sheetSet = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT });
    const scheduleSheet = sheetSet.sheets[sheetSet.sheets.length - 1]!;
    expect(scheduleSheet.unresolvedItems.length).toBeGreaterThan(0);
  });

  it("keeps every view's projected content within its own viewport (no clipping), for a small structure", () => {
    const doc = baseDoc();
    const [drawingSheet] = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT }).sheets;
    for (const view of drawingSheet!.views) {
      const points = [
        ...view.members.flatMap((m) => m.outline),
        ...view.joints.map((j) => j.position),
        ...view.dimensions.flatMap((d) => [d.a, d.b]),
      ];
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(view.viewport.xMm - 1e-6);
        expect(p.x).toBeLessThanOrEqual(view.viewport.xMm + view.viewport.widthMm + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(view.viewport.yMm - 1e-6);
        expect(p.y).toBeLessThanOrEqual(view.viewport.yMm + view.viewport.heightMm + 1e-6);
      }
    }
  });

  it("keeps every view's projected content within its own viewport for an oversized structure too", () => {
    const doc = baseDoc();
    const hugeAnchor = doc.anchors.find((a) => a.id === "a-post-2-base")!;
    hugeAnchor.positionMm.x = 900_000;
    doc.anchors.find((a) => a.id === "a-post-2-top")!.positionMm.x = 900_000;

    const [drawingSheet] = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT }).sheets;
    for (const view of drawingSheet!.views) {
      const points = [...view.members.flatMap((m) => m.outline), ...view.joints.map((j) => j.position)];
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(view.viewport.xMm - 1e-6);
        expect(p.x).toBeLessThanOrEqual(view.viewport.xMm + view.viewport.widthMm + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(view.viewport.yMm - 1e-6);
        expect(p.y).toBeLessThanOrEqual(view.viewport.yMm + view.viewport.heightMm + 1e-6);
      }
    }
  });

  it("handles an empty project without throwing", () => {
    const doc = createEmptyProjectDocument({ name: "Empty", createdAt: "2026-08-16T00:00:00.000Z" });
    expect(() => buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT })).not.toThrow();
    const sheetSet = buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT });
    expect(sheetSet.sheets.length).toBeGreaterThan(0);
  });
});
