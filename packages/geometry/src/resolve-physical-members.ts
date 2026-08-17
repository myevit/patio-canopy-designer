import type { ProjectDocument, Vector3Mm } from "@canopy/shared";
import { squareCut, type EndCutPlane, type EndSign } from "./end-cuts.js";
import { computeMemberFrame, type MemberFrame } from "./member-frame.js";
import { trimMember, type TrimmedMember } from "./member-trim.js";
import { deriveRoofPlaneGeometry, isPointOnRoofPlane, roofPlaneEndCut, type RoofPlaneGeometry } from "./roof-end-cut.js";

/** How close an endpoint must be to a roof plane's surface to be treated as physically resting on it. */
export const ROOF_PLANE_CONTACT_TOLERANCE_MM = 5;

export interface ResolvedEndCut {
  cut: EndCutPlane;
  /** The roof plane id this cut was derived from, or null for a default square cut. */
  roofPlaneId: string | null;
}

export interface PhysicalMember {
  id: string;
  kind: "post" | "beam";
  sectionId: string;
  materialId: string | undefined;
  startMm: Vector3Mm;
  endMm: Vector3Mm;
  frame: MemberFrame;
  endA: ResolvedEndCut;
  endB: ResolvedEndCut;
  trimmed: TrimmedMember;
}

interface RoofPlaneEntry {
  id: string;
  geometry: RoofPlaneGeometry;
}

function deriveRoofPlaneEntries(document: ProjectDocument): RoofPlaneEntry[] {
  const houseOutlinesById = new Map(document.site.houseOutlines.map((h) => [h.id, h]));
  return document.site.roofPlanes.flatMap((roofPlane) => {
    const houseOutline = houseOutlinesById.get(roofPlane.houseOutlineId);
    if (!houseOutline) return [];
    return [{ id: roofPlane.id, geometry: deriveRoofPlaneGeometry(houseOutline.points, roofPlane) }];
  });
}

function resolveEndCut(
  frame: MemberFrame,
  endSign: EndSign,
  endpointMm: Vector3Mm,
  roofPlanes: RoofPlaneEntry[],
): ResolvedEndCut {
  const axisU = endSign === -1 ? 0 : frame.lengthMm;
  for (const roofPlane of roofPlanes) {
    if (!isPointOnRoofPlane(roofPlane.geometry, endpointMm, ROOF_PLANE_CONTACT_TOLERANCE_MM)) continue;
    const result = roofPlaneEndCut(frame, endSign, roofPlane.geometry);
    if (result.ok) {
      return { cut: result.cut, roofPlaneId: roofPlane.id };
    }
  }
  return { cut: squareCut(axisU, endSign), roofPlaneId: null };
}

/**
 * Every physically fabricated member in the document - posts and beams alike
 * - resolved to its analytic frame and end cuts. A roof-plane cut is derived
 * automatically whenever an endpoint anchor rests on a canonical roof plane;
 * every other endpoint gets a plain square cut. This is the single source of
 * geometry both the BOM (member-schedule) and the Cuts tab (cut-fabrication)
 * build from, so they can never disagree about a member's physical length.
 */
export function derivePhysicalMembers(document: ProjectDocument): PhysicalMember[] {
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const roofPlanes = deriveRoofPlaneEntries(document);

  function build(
    id: string,
    kind: "post" | "beam",
    sectionId: string,
    materialId: string | undefined,
    startAnchorId: string,
    endAnchorId: string,
    rollRad: number,
  ): PhysicalMember | null {
    const start = anchorsById.get(startAnchorId)?.positionMm;
    const end = anchorsById.get(endAnchorId)?.positionMm;
    const section = sectionsById.get(sectionId);
    if (!start || !end || !section) return null;

    const frame = computeMemberFrame({ start, end, rollRad });
    const endA = resolveEndCut(frame, -1, start, roofPlanes);
    const endB = resolveEndCut(frame, 1, end, roofPlanes);
    const trimmed = trimMember(section.widthMm, section.heightMm, endA.cut, endB.cut);

    return { id, kind, sectionId, materialId, startMm: start, endMm: end, frame, endA, endB, trimmed };
  }

  const posts = document.posts.flatMap((post) => {
    const resolved = build(post.id, "post", post.sectionId, undefined, post.baseAnchorId, post.topAnchorId, 0);
    return resolved ? [resolved] : [];
  });

  const members = document.members.flatMap((member) => {
    const resolved = build(
      member.id,
      "beam",
      member.sectionId,
      member.materialId,
      member.startAnchorId,
      member.endAnchorId,
      member.rollRad,
    );
    return resolved ? [resolved] : [];
  });

  return [...posts, ...members];
}
