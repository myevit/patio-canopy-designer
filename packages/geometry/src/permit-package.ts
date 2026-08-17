import {
  memberAnalysisScope,
  postAnalysisScope,
  type AnalyzedLoadProvenance,
  type AppliedLoadKind,
  type JurisdictionMetadata,
  type LoadProvenance,
  type MemberAnalysisReport,
  type PostAnalysisReport,
} from "@canopy/calculations";
import {
  findTopologyIssues,
  type DisplayLengthUnit,
  type MemberRole,
  type ProjectDocument,
  type TopologyIssue,
  type Vector3Mm,
} from "@canopy/shared";
import { buildBlueprintSheetSet, type BlueprintSheetSet } from "./blueprint-sheet.js";
import { convexHull, projectMemberOutline, projectPoint } from "./blueprint-projection.js";
import type { Point2D } from "./cut-diagram-layout.js";
import { buildMemberSchedule, type MemberSchedule } from "./member-schedule.js";
import { derivePhysicalMembers } from "./resolve-physical-members.js";

/**
 * Fixed, always-present copy. This is data - part of the assembled package,
 * not just UI decoration - so no consumer of `buildPermitPackage` can ever
 * omit or reword it.
 */
export const PERMIT_PACKAGE_DISCLAIMER =
  "This permit-assist package is preliminary planning material only. It is not a permit approval and does not " +
  "claim code compliance. This application never applies, renders, or imitates a professional engineering " +
  "(APEGA) stamp. Independent professional engineering review and municipal permit approval are required " +
  "before construction.";

/**
 * Reflects the delivery plan's invariant that the actual attached irregular
 * saddle structure stays engineer-review-required even when every component
 * screening passes - this banner is unconditional, not derived from any
 * per-member status.
 */
/**
 * Compact single-line form of `PERMIT_PACKAGE_DISCLAIMER` for print contexts
 * - a footer on every drawing sheet - where the full paragraph would not fit.
 * Fixed and unconditional for the same reason as the full disclaimer: no
 * consumer can omit or reword it.
 */
export const PERMIT_PACKAGE_SHEET_DISCLAIMER =
  "Not a permit approval - no code-compliance claim - no professional (APEGA) stamp applied or implied.";

export const SADDLE_ENGINEER_REVIEW_BANNER =
  "The attached irregular saddle (the fan-rafter lattice attached to the house) always requires engineer " +
  "review before construction, regardless of any component screening status below. Component screening never " +
  "certifies the assembled saddle structure as safe, approved, or permit ready.";

export const PERMIT_PACKAGE_LIMITATIONS: readonly string[] = [
  "This package is preliminary planning material; it does not claim code compliance or permit readiness.",
  "No professional engineering stamp is applied, rendered, or imitated by this application.",
  "The attached irregular saddle structure always requires engineer review, regardless of component screening results.",
  "Property lines, setbacks, and surveyed site data are not part of the canonical model and must be confirmed before submission.",
  "Footing sizing, frost depth, and geotechnical capacity are not calculated here; footing callouts are crude location markers only.",
];

const NORTH_ARROW_NOTE =
  "North arrow is drawn against the model's plan +Y axis as drawn; true north is not encoded in the canonical " +
  "model and must be confirmed against a survey before permit submission.";

const PROPERTY_LINE_NOTE =
  "Property lines and setbacks are not part of the canonical model. Add surveyed property lines and confirm " +
  "setbacks before permit submission.";

const FOOTING_SHEET_NOTE =
  "Independent frost-depth footings are required outside the patio footprint (design, sizing, and frost depth " +
  "by others). Callout positions are crude location markers only; no engineering approval is implied.";

const FOOTING_CALLOUT_NOTE = "Independent frost-depth footing (design by others).";

const PERMIT_SHEET_COUNT = 6;

export type PermitProvenanceField<T> =
  | { value: T; provenance: "user-entered" }
  | { value: undefined; provenance: "not provided" };

function provenanceField<T>(value: T | undefined): PermitProvenanceField<T> {
  return value === undefined ? { value: undefined, provenance: "not provided" } : { value, provenance: "user-entered" };
}

export interface PermitPackageFootprint {
  kind: "house" | "patio" | "canopy";
  sourceIds: string[];
  outlineMm: Point2D[];
}

export interface PermitSitePlanSheet {
  footprints: PermitPackageFootprint[];
  northArrowNote: string;
  address: PermitProvenanceField<string>;
  zoning: PermitProvenanceField<string>;
  propertyLineNote: string;
}

export interface PermitFootingCallout {
  postId: string;
  positionMm: Vector3Mm;
  note: string;
}

export interface PermitFootingLayoutSheet {
  callouts: PermitFootingCallout[];
  note: string;
}

/** Every fail-closed `AnalysisStatus` from Milestone 7, plus a package-level state for members/posts no check has been run for yet. */
export type StructuralSummaryStatus = MemberAnalysisReport["status"] | "not-yet-analyzed";

export interface StructuralSummaryMemberEntry {
  memberId: string;
  role: MemberRole;
  status: StructuralSummaryStatus;
  reason?: string;
  jurisdiction?: JurisdictionMetadata;
  loadProvenance?: AnalyzedLoadProvenance[];
}

export interface StructuralSummaryPostEntry {
  postId: string;
  status: StructuralSummaryStatus;
  reason?: string;
  jurisdiction?: JurisdictionMetadata;
  loadProvenance?: { kind: AppliedLoadKind; provenance: LoadProvenance };
}

export interface PermitStructuralSummarySheet {
  members: StructuralSummaryMemberEntry[];
  posts: StructuralSummaryPostEntry[];
  saddleEngineerReviewBanner: string;
}

export interface PermitAssumptionsSheet {
  unitsNote: string;
  toleranceNote: string;
  modelSource: { projectName: string; revision: number; generatedAt: string };
  jurisdiction: PermitProvenanceField<JurisdictionMetadata>;
  limitations: readonly string[];
}

export interface PermitPackageTitleBlock {
  projectName: string;
  revision: number;
  date: string;
  sheetCount: number;
}

export interface PermitPackage {
  titleBlock: PermitPackageTitleBlock;
  disclaimer: string;
  /** Compact single-line form of `disclaimer`, meant to be printed as a footer on every drawing sheet. */
  sheetFooterDisclaimer: string;
  sitePlan: PermitSitePlanSheet;
  drawingSheets: BlueprintSheetSet;
  footingLayout: PermitFootingLayoutSheet;
  memberSchedule: MemberSchedule;
  structuralSummary: PermitStructuralSummarySheet;
  assumptions: PermitAssumptionsSheet;
  unresolvedItems: TopologyIssue[];
}

export interface PermitPackageOptions {
  /** ISO timestamp for title-block/assumptions dates; passed in rather than read from the clock so assembly stays pure and deterministic. */
  generatedAt: string;
  displayUnits?: DisplayLengthUnit;
  address?: string;
  zoning?: string;
  /** Purely descriptive; never used to look up a bundled table or equation. */
  jurisdiction?: JurisdictionMetadata;
  /** Already-computed Milestone 7 reports to reproduce verbatim; members/posts with no matching report are reported as not-yet-analyzed or refused by scope, never silently omitted. */
  memberAnalysisReports?: MemberAnalysisReport[];
  postAnalysisReports?: PostAnalysisReport[];
}

function buildSitePlan(document: ProjectDocument, options: PermitPackageOptions): PermitSitePlanSheet {
  const physicalMembers = derivePhysicalMembers(document);
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const canopyPoints = physicalMembers.flatMap((member) => {
    const section = sectionsById.get(member.sectionId);
    return projectMemberOutline(member.frame, "plan", section?.widthMm ?? 0, section?.heightMm ?? 0);
  });

  const footprints: PermitPackageFootprint[] = [
    ...document.site.houseOutlines.map((houseOutline) => ({
      kind: "house" as const,
      sourceIds: [houseOutline.id],
      outlineMm: houseOutline.points.map((p) => projectPoint(p, "plan")),
    })),
    ...document.site.patioOutlines.map((patioOutline) => ({
      kind: "patio" as const,
      sourceIds: [patioOutline.id],
      outlineMm: patioOutline.points.map((p) => projectPoint(p, "plan")),
    })),
    {
      kind: "canopy" as const,
      sourceIds: physicalMembers.map((m) => m.id).sort(),
      outlineMm: convexHull(canopyPoints),
    },
  ];

  return {
    footprints,
    northArrowNote: NORTH_ARROW_NOTE,
    address: provenanceField(options.address),
    zoning: provenanceField(options.zoning),
    propertyLineNote: PROPERTY_LINE_NOTE,
  };
}

function buildFootingLayout(document: ProjectDocument): PermitFootingLayoutSheet {
  const physicalPosts = derivePhysicalMembers(document).filter((m) => m.kind === "post");
  return {
    callouts: physicalPosts.map((post) => ({
      postId: post.id,
      positionMm: post.startMm,
      note: FOOTING_CALLOUT_NOTE,
    })),
    note: FOOTING_SHEET_NOTE,
  };
}

function latestByKey<TReport>(reports: TReport[] | undefined, idOf: (r: TReport) => string): Map<string, TReport> {
  const map = new Map<string, TReport>();
  (reports ?? []).forEach((report) => map.set(idOf(report), report));
  return map;
}

function buildStructuralSummary(
  document: ProjectDocument,
  options: PermitPackageOptions,
): PermitStructuralSummarySheet {
  const memberReportById = latestByKey(options.memberAnalysisReports, (r) => r.memberId);
  const postReportById = latestByKey(options.postAnalysisReports, (r) => r.postId);

  const members: StructuralSummaryMemberEntry[] = document.members.map((member) => {
    const report = memberReportById.get(member.id);
    if (report) {
      return {
        memberId: member.id,
        role: member.role,
        status: report.status,
        reason: report.reason,
        jurisdiction: report.jurisdiction,
        loadProvenance: report.loadProvenance,
      };
    }
    const scope = memberAnalysisScope(document, member.id);
    return scope.supported
      ? {
          memberId: member.id,
          role: member.role,
          status: "not-yet-analyzed",
          reason: "Component check not yet run for this member.",
        }
      : { memberId: member.id, role: member.role, status: "outside-validated-scope", reason: scope.reason };
  });

  const posts: StructuralSummaryPostEntry[] = document.posts.map((post) => {
    const report = postReportById.get(post.id);
    if (report) {
      return {
        postId: post.id,
        status: report.status,
        reason: report.reason,
        jurisdiction: report.jurisdiction,
        loadProvenance: report.loadProvenance,
      };
    }
    const scope = postAnalysisScope(document, post.id);
    return scope.supported
      ? { postId: post.id, status: "not-yet-analyzed", reason: "Component check not yet run for this post." }
      : { postId: post.id, status: "outside-validated-scope", reason: scope.reason };
  });

  return { members, posts, saddleEngineerReviewBanner: SADDLE_ENGINEER_REVIEW_BANNER };
}

function buildAssumptions(document: ProjectDocument, options: PermitPackageOptions): PermitAssumptionsSheet {
  const displayUnits = options.displayUnits ?? document.displayUnits;
  return {
    unitsNote:
      `Canonical lengths are millimetres (mm) and canonical angles are radians; this package displays lengths ` +
      `in "${displayUnits}" units at its boundary only.`,
    toleranceNote:
      "Geometry reflects nominal drafted dimensions; construction tolerances, material shrinkage, and " +
      "fabrication allowances beyond the stated stock allowance are not modeled.",
    modelSource: {
      projectName: document.metadata.name,
      revision: document.revision,
      generatedAt: options.generatedAt,
    },
    jurisdiction: provenanceField(options.jurisdiction),
    limitations: PERMIT_PACKAGE_LIMITATIONS,
  };
}

/**
 * Assembles the permit-assist package purely by combining outputs already
 * produced by Milestones 5-7 (BOM, blueprint sheets, topology diagnostics)
 * plus caller-supplied analysis reports and descriptive site/jurisdiction
 * metadata. Nothing here re-derives a number that those milestones already
 * own, so the package can never disagree with the sheets it reuses.
 */
export function buildPermitPackage(document: ProjectDocument, options: PermitPackageOptions): PermitPackage {
  const displayUnits = options.displayUnits ?? document.displayUnits;
  return {
    titleBlock: {
      projectName: document.metadata.name,
      revision: document.revision,
      date: options.generatedAt,
      sheetCount: PERMIT_SHEET_COUNT,
    },
    disclaimer: PERMIT_PACKAGE_DISCLAIMER,
    sheetFooterDisclaimer: PERMIT_PACKAGE_SHEET_DISCLAIMER,
    sitePlan: buildSitePlan(document, options),
    drawingSheets: buildBlueprintSheetSet(document, { generatedAt: options.generatedAt, displayUnits }),
    footingLayout: buildFootingLayout(document),
    memberSchedule: buildMemberSchedule(document),
    structuralSummary: buildStructuralSummary(document, options),
    assumptions: buildAssumptions(document, options),
    unresolvedItems: findTopologyIssues(document),
  };
}
