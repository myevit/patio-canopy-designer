import { createEmptyProjectDocument, type ProjectDocument } from "@canopy/shared";
import { describe, expect, it } from "vitest";
import { findTopologyIssues } from "@canopy/shared";
import { buildBlueprintSheetSet } from "./blueprint-sheet.js";
import { buildMemberSchedule } from "./member-schedule.js";
import {
  PERMIT_PACKAGE_DISCLAIMER,
  PERMIT_PACKAGE_SHEET_DISCLAIMER,
  SADDLE_ENGINEER_REVIEW_BANNER,
  buildPermitPackage,
} from "./permit-package.js";

function baseDoc(): ProjectDocument {
  const doc = createEmptyProjectDocument({ name: "Fixture Canopy", createdAt: "2026-08-16T00:00:00.000Z" });
  doc.sections.push({ id: "sec-post", name: "Post", widthMm: 89, heightMm: 89 });
  doc.sections.push({ id: "sec-beam", name: "Beam", widthMm: 89, heightMm: 38 });
  doc.anchors.push(
    { id: "a-post-1-base", kind: "post-base", positionMm: { x: 0, y: 0, z: 0 } },
    { id: "a-post-1-top", kind: "post-top", positionMm: { x: 0, y: 0, z: 2400 } },
    { id: "a-post-2-base", kind: "post-base", positionMm: { x: 3000, y: 0, z: 0 } },
    { id: "a-post-2-top", kind: "post-top", positionMm: { x: 3000, y: 0, z: 2400 } },
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

function docWithSaddle(): ProjectDocument {
  const doc = baseDoc();
  doc.site.houseOutlines.push({
    id: "house-1",
    points: [
      { x: -1000, y: -3000, z: 0 },
      { x: 4000, y: -3000, z: 0 },
      { x: 4000, y: 0, z: 0 },
      { x: -1000, y: 0, z: 0 },
    ],
  });
  doc.site.patioOutlines.push({
    id: "patio-1",
    points: [
      { x: -200, y: 0, z: 0 },
      { x: 3200, y: 0, z: 0 },
      { x: 3200, y: 3000, z: 0 },
      { x: -200, y: 3000, z: 0 },
    ],
  });
  doc.anchors.push({ id: "a-fan-target", kind: "free", positionMm: { x: 1500, y: 3000, z: 2000 } });
  doc.members.push({
    id: "fan-1",
    role: "fan-rafter",
    startAnchorId: "a-post-1-top",
    endAnchorId: "a-fan-target",
    sectionId: "sec-beam",
    rollRad: 0,
  });
  return doc;
}

const GENERATED_AT = "2026-08-17T09:00:00.000Z";

describe("buildPermitPackage", () => {
  it("is deterministic: regenerating from the same document and options produces an identical package", () => {
    const doc = docWithSaddle();
    const options = { generatedAt: GENERATED_AT, address: "123 Sample St", zoning: "RF1" };
    const a = buildPermitPackage(doc, options);
    const b = buildPermitPackage(doc, options);
    expect(a).toEqual(b);
  });

  it("carries revision and generation metadata sourced from the document and options", () => {
    const doc = baseDoc();
    doc.revision = 4;
    const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
    expect(pkg.titleBlock.projectName).toBe("Fixture Canopy");
    expect(pkg.titleBlock.revision).toBe(4);
    expect(pkg.titleBlock.date).toBe(GENERATED_AT);
    expect(pkg.assumptions.modelSource).toEqual({
      projectName: "Fixture Canopy",
      revision: 4,
      generatedAt: GENERATED_AT,
    });
  });

  describe("no-stamp / no-approval disclaimer", () => {
    it("always includes the fixed permit-package disclaimer verbatim", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.disclaimer).toBe(PERMIT_PACKAGE_DISCLAIMER);
    });

    it("never claims code compliance, approval, or a professional stamp", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.disclaimer).toMatch(/not a permit approval/i);
      expect(pkg.disclaimer).toMatch(/does not claim code compliance/i);
      expect(pkg.disclaimer).toMatch(/never applies.*stamp/i);
      expect(pkg.disclaimer).not.toMatch(/\bis approved\b/i);
      expect(pkg.disclaimer).not.toMatch(/\bpermit ready\b/i);
      expect(pkg.disclaimer).not.toMatch(/\bcertified\b/i);
    });

    it("always includes the engineer-review-required banner for the attached saddle, even with no fan-rafter members present", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.structuralSummary.saddleEngineerReviewBanner).toBe(SADDLE_ENGINEER_REVIEW_BANNER);
      expect(pkg.structuralSummary.saddleEngineerReviewBanner).toMatch(/engineer review/i);
      expect(pkg.structuralSummary.saddleEngineerReviewBanner).not.toMatch(/\bis approved\b/i);
    });

    it("also carries a compact single-line form of the disclaimer, for print contexts that can't fit the full paragraph on every sheet", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.sheetFooterDisclaimer).toBe(PERMIT_PACKAGE_SHEET_DISCLAIMER);
      expect(pkg.sheetFooterDisclaimer).toMatch(/not a permit approval/i);
      expect(pkg.sheetFooterDisclaimer.length).toBeLessThan(PERMIT_PACKAGE_DISCLAIMER.length);
    });
  });

  describe("cross-sheet consistency", () => {
    it("member schedule matches buildMemberSchedule's output for the same document verbatim", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      expect(pkg.memberSchedule).toEqual(buildMemberSchedule(doc));
    });

    it("drawing sheets match buildBlueprintSheetSet's output for the same document and generation date", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      expect(pkg.drawingSheets).toEqual(buildBlueprintSheetSet(doc, { generatedAt: GENERATED_AT }));
    });

    it("unresolved-items schedule matches the document's topology issues and the blueprint schedule sheet", () => {
      const doc = docWithSaddle();
      // Add an unconfirmed connection so there is something to resolve.
      doc.anchors.push({ id: "a-3", kind: "free", positionMm: { x: 1500, y: 0, z: 2400 } });
      doc.members.push({
        id: "beam-2",
        role: "perimeter-beam",
        startAnchorId: "a-post-1-top",
        endAnchorId: "a-3",
        sectionId: "sec-beam",
        rollRad: 0,
      });
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      expect(pkg.unresolvedItems).toEqual(findTopologyIssues(doc));
      expect(pkg.unresolvedItems.length).toBeGreaterThan(0);
      const blueprintSchedule = pkg.drawingSheets.sheets[pkg.drawingSheets.sheets.length - 1]!;
      expect(pkg.unresolvedItems).toEqual(blueprintSchedule.unresolvedItems);
    });

    it("every footing callout resolves to a live post in the document", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      const postIds = new Set(doc.posts.map((p) => p.id));
      expect(pkg.footingLayout.callouts.length).toBe(doc.posts.length);
      for (const callout of pkg.footingLayout.callouts) {
        expect(postIds.has(callout.postId)).toBe(true);
      }
    });

    it("structural summary includes every member and post exactly once, never silently dropped", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      expect(pkg.structuralSummary.members.map((m) => m.memberId).sort()).toEqual(
        doc.members.map((m) => m.id).sort(),
      );
      expect(pkg.structuralSummary.posts.map((p) => p.postId).sort()).toEqual(doc.posts.map((p) => p.id).sort());
    });

    it("site-plan canopy footprint sources trace back to live posts/members in the document", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      const canopy = pkg.sitePlan.footprints.find((f) => f.kind === "canopy")!;
      const liveIds = new Set([...doc.posts.map((p) => p.id), ...doc.members.map((m) => m.id)]);
      for (const id of canopy.sourceIds) {
        expect(liveIds.has(id)).toBe(true);
      }
    });
  });

  describe("structural summary fail-closed statuses", () => {
    it("flags a fan-rafter member (the saddle) as outside validated scope even without a run report", () => {
      const doc = docWithSaddle();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      const fanEntry = pkg.structuralSummary.members.find((m) => m.memberId === "fan-1")!;
      expect(fanEntry.status).toBe("outside-validated-scope");
      expect(fanEntry.reason).toMatch(/saddle|fan lattice/i);
    });

    it("marks an eligible member with no run report as not-yet-analyzed rather than silently omitting it", () => {
      const doc = baseDoc();
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      const entry = pkg.structuralSummary.members.find((m) => m.memberId === "beam-1")!;
      expect(entry.status).toBe("not-yet-analyzed");
    });

    it("reproduces a supplied member analysis report's status, reason, and provenance verbatim", () => {
      const doc = baseDoc();
      const report = {
        memberId: "beam-1",
        status: "calculated-within-stated-assumptions" as const,
        condition: "simply-supported" as const,
        spanMm: 3000,
        loadProvenance: [
          { kind: "user-defined" as const, provenance: { source: "user-entered" as const, label: "User load" } },
        ],
      };
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT, memberAnalysisReports: [report] });
      const entry = pkg.structuralSummary.members.find((m) => m.memberId === "beam-1")!;
      expect(entry.status).toBe(report.status);
      expect(entry.loadProvenance).toEqual(report.loadProvenance);
    });

    it("reproduces a supplied post analysis report's status verbatim", () => {
      const doc = baseDoc();
      const report = {
        postId: "post-1",
        status: "input-requires-verification" as const,
        reason: "No loads supplied for this post.",
      };
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT, postAnalysisReports: [report] });
      const entry = pkg.structuralSummary.posts.find((p) => p.postId === "post-1")!;
      expect(entry.status).toBe(report.status);
      expect(entry.reason).toBe(report.reason);
    });
  });

  describe("assumptions and provenance", () => {
    it("marks address, zoning, and jurisdiction as not provided when omitted, never silently blank", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.sitePlan.address).toEqual({ value: undefined, provenance: "not provided" });
      expect(pkg.sitePlan.zoning).toEqual({ value: undefined, provenance: "not provided" });
      expect(pkg.assumptions.jurisdiction).toEqual({ value: undefined, provenance: "not provided" });
    });

    it("marks address, zoning, and jurisdiction as user-entered with their values when supplied", () => {
      const jurisdiction = { provider: "City of Edmonton", edition: "2023 NBC Alberta Edition", effectiveDate: "2023-01-01" };
      const pkg = buildPermitPackage(baseDoc(), {
        generatedAt: GENERATED_AT,
        address: "123 Sample St",
        zoning: "RF1",
        jurisdiction,
      });
      expect(pkg.sitePlan.address).toEqual({ value: "123 Sample St", provenance: "user-entered" });
      expect(pkg.sitePlan.zoning).toEqual({ value: "RF1", provenance: "user-entered" });
      expect(pkg.assumptions.jurisdiction).toEqual({ value: jurisdiction, provenance: "user-entered" });
    });

    it("states the model source revision and generation date in the assumptions sheet", () => {
      const doc = baseDoc();
      doc.revision = 9;
      const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
      expect(pkg.assumptions.modelSource).toEqual({
        projectName: "Fixture Canopy",
        revision: 9,
        generatedAt: GENERATED_AT,
      });
    });

    it("states canonical units and tolerance limitations", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.assumptions.unitsNote).toMatch(/millimetre|mm/i);
      expect(pkg.assumptions.unitsNote).toMatch(/radian/i);
      expect(pkg.assumptions.toleranceNote.length).toBeGreaterThan(0);
      expect(pkg.assumptions.limitations.length).toBeGreaterThan(0);
    });

    it("notes that property lines and setbacks are not part of the canonical model", () => {
      const pkg = buildPermitPackage(baseDoc(), { generatedAt: GENERATED_AT });
      expect(pkg.sitePlan.propertyLineNote).toMatch(/property line|setback/i);
    });
  });

  it("handles an empty project without throwing", () => {
    const doc = createEmptyProjectDocument({ name: "Empty", createdAt: "2026-08-16T00:00:00.000Z" });
    expect(() => buildPermitPackage(doc, { generatedAt: GENERATED_AT })).not.toThrow();
    const pkg = buildPermitPackage(doc, { generatedAt: GENERATED_AT });
    expect(pkg.structuralSummary.members).toEqual([]);
    expect(pkg.structuralSummary.posts).toEqual([]);
    expect(pkg.footingLayout.callouts).toEqual([]);
  });
});
