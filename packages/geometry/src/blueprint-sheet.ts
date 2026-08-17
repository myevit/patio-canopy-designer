import { findTopologyIssues, type DisplayLengthUnit, type ProjectDocument, type TopologyIssue } from "@canopy/shared";
import { assignJointMarks, assignMemberMarks } from "./blueprint-callouts.js";
import type { Point2D } from "./cut-diagram-layout.js";
import {
  buildMemberLengthDimension,
  buildOverallDimension,
  type MemberLengthDimension,
  type OverallDimension,
} from "./blueprint-dimensions.js";
import { projectMemberOutline, projectPoint, type ProjectionPlane } from "./blueprint-projection.js";
import {
  DEFAULT_PAGE_LAYOUT,
  layoutViewports,
  placeInViewport,
  selectScale,
  type PageLayoutConfig,
  type ViewBounds,
  type ViewportLayout,
} from "./blueprint-sheet-layout.js";
import { derivePhysicalMembers, type PhysicalMember } from "./resolve-physical-members.js";

export type BlueprintViewKind = "plan" | "front" | "side" | "section";

/** Fixed schematic offset (world mm) from a view's content to its overall-span dimension line - a drawing convention, not a measurement. */
const OVERALL_DIMENSION_OFFSET_MM = 300;

function memberCrossesX(member: PhysicalMember, x: number): boolean {
  const minX = Math.min(member.startMm.x, member.endMm.x);
  const maxX = Math.max(member.startMm.x, member.endMm.x);
  return x >= minX - 1e-6 && x <= maxX + 1e-6;
}

/** The section cut plane's X coordinate: the median of post base-anchor X positions, so the cut location itself is model-derived, not hand-picked. */
function computeSectionCutX(document: ProjectDocument): number | null {
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));
  const xs = document.posts
    .map((post) => anchorsById.get(post.baseAnchorId)?.positionMm.x)
    .filter((x): x is number => x !== undefined)
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

interface ViewSpec {
  kind: BlueprintViewKind;
  plane: ProjectionPlane;
  title: string;
  members: PhysicalMember[];
}

export interface BlueprintMemberOutline {
  memberId: string;
  mark: string;
  outline: Point2D[];
}

export interface BlueprintJointCallout {
  jointId: string;
  mark: string;
  position: Point2D;
}

export interface BlueprintSheetView {
  key: BlueprintViewKind;
  title: string;
  viewport: ViewportLayout;
  members: BlueprintMemberOutline[];
  joints: BlueprintJointCallout[];
  dimensions: Array<MemberLengthDimension | OverallDimension>;
}

export interface BlueprintTitleBlock {
  projectName: string;
  revision: number;
  date: string;
  scale: string;
  sheetNumber: number;
  sheetCount: number;
}

export interface BlueprintSheet {
  titleBlock: BlueprintTitleBlock;
  views: BlueprintSheetView[];
  unresolvedItems: TopologyIssue[];
}

export interface BlueprintSheetSet {
  sheets: BlueprintSheet[];
}

export interface BuildBlueprintSheetOptions {
  /** ISO timestamp for the title block's "date" field; passed in rather than read from the clock so the sheet builder stays a pure, testable function. */
  generatedAt: string;
  displayUnits?: DisplayLengthUnit;
  pageLayout?: PageLayoutConfig;
}

/**
 * Builds the full printable blueprint package - a plan, front/side
 * elevations, one model-derived section, and a schedule sheet of unresolved
 * topology issues - purely from the canonical document. Every callout traces
 * back to a live post, member, or joint id; every dimension is sourced from
 * already-validated model geometry (finished lengths, projected bounds), so
 * regenerating from the same document and generatedAt always yields the same
 * sheets.
 */
export function buildBlueprintSheetSet(document: ProjectDocument, options: BuildBlueprintSheetOptions): BlueprintSheetSet {
  const displayUnits = options.displayUnits ?? document.displayUnits;
  const pageLayout = options.pageLayout ?? DEFAULT_PAGE_LAYOUT;
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const physicalMembers = derivePhysicalMembers(document);
  const markByMemberId = new Map(assignMemberMarks(physicalMembers).map((m) => [m.memberId, m.mark]));
  const markByJointId = new Map(assignJointMarks(document.joints).map((m) => [m.jointId, m.mark]));

  const viewSpecs: ViewSpec[] = [
    { kind: "plan", plane: "plan", title: "Plan", members: physicalMembers },
    { kind: "front", plane: "front", title: "Front Elevation", members: physicalMembers },
    { kind: "side", plane: "side", title: "Side Elevation", members: physicalMembers },
  ];
  const cutX = computeSectionCutX(document);
  if (cutX !== null) {
    viewSpecs.push({
      kind: "section",
      plane: "side",
      title: `Section at X=${Math.round(cutX)}mm`,
      members: physicalMembers.filter((m) => memberCrossesX(m, cutX)),
    });
  }

  const rawViews = viewSpecs.map((spec) => {
    const memberOutlines = spec.members.map((member) => {
      const section = sectionsById.get(member.sectionId);
      return {
        memberId: member.id,
        mark: markByMemberId.get(member.id) ?? member.id,
        outline: projectMemberOutline(member.frame, spec.plane, section?.widthMm ?? 0, section?.heightMm ?? 0),
      };
    });

    const memberIdsInView = new Set(spec.members.map((m) => m.id));
    const jointCallouts = document.joints
      .filter((joint) => joint.connectedMemberIds.some((id) => memberIdsInView.has(id)))
      .map((joint) => ({
        jointId: joint.id,
        mark: markByJointId.get(joint.id) ?? joint.id,
        position: projectPoint(joint.positionMm, spec.plane),
      }));

    const memberDimensions = spec.members.map((member) => buildMemberLengthDimension(member, spec.plane, displayUnits));

    const contentPoints = [...memberOutlines.flatMap((o) => o.outline), ...jointCallouts.map((j) => j.position)];
    const overallDimension =
      contentPoints.length > 0
        ? buildOverallDimension(
            contentPoints,
            "x",
            Math.min(...contentPoints.map((p) => p.y)) - OVERALL_DIMENSION_OFFSET_MM,
            displayUnits,
          )
        : null;

    const dimensions: Array<MemberLengthDimension | OverallDimension> = [
      ...memberDimensions,
      ...(overallDimension ? [overallDimension] : []),
    ];

    const boundsPoints = [...contentPoints, ...dimensions.flatMap((d) => [d.a, d.b])];
    const bounds: ViewBounds =
      boundsPoints.length > 0
        ? {
            key: spec.kind,
            minX: Math.min(...boundsPoints.map((p) => p.x)),
            maxX: Math.max(...boundsPoints.map((p) => p.x)),
            minY: Math.min(...boundsPoints.map((p) => p.y)),
            maxY: Math.max(...boundsPoints.map((p) => p.y)),
          }
        : { key: spec.kind, minX: 0, maxX: 1, minY: 0, maxY: 1 };

    return { spec, memberOutlines, jointCallouts, dimensions, bounds };
  });

  const secondaryKinds = rawViews.slice(1).map((v) => v.spec.kind);
  const viewports = layoutViewports(pageLayout, "plan", secondaryKinds);
  const viewportByKey = new Map(viewports.map((v) => [v.key, v]));
  const scaleResult = selectScale(
    viewports,
    rawViews.map((v) => v.bounds),
  );

  const views: BlueprintSheetView[] = rawViews.map(({ spec, memberOutlines, jointCallouts, dimensions, bounds }) => {
    const viewport = viewportByKey.get(spec.kind)!;
    const place = (p: Point2D) => placeInViewport(p, viewport, bounds, scaleResult.scaleDenominator);
    return {
      key: spec.kind,
      title: spec.title,
      viewport,
      members: memberOutlines.map((o) => ({ ...o, outline: o.outline.map(place) })),
      joints: jointCallouts.map((j) => ({ ...j, position: place(j.position) })),
      dimensions: dimensions.map((d) => ({ ...d, a: place(d.a), b: place(d.b) })),
    };
  });

  const titleBlockBase = {
    projectName: document.metadata.name,
    revision: document.revision,
    date: options.generatedAt,
    scale: scaleResult.isStandardScale
      ? `1:${scaleResult.scaleDenominator}`
      : `1:${Math.ceil(scaleResult.scaleDenominator)} (custom fit)`,
    sheetCount: 2,
  };

  return {
    sheets: [
      { titleBlock: { ...titleBlockBase, sheetNumber: 1 }, views, unresolvedItems: [] },
      { titleBlock: { ...titleBlockBase, sheetNumber: 2 }, views: [], unresolvedItems: findTopologyIssues(document) },
    ],
  };
}
