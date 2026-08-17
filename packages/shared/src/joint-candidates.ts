import type { Joint, Member, ProjectDocument, Section } from "./design-schema.js";
import { closestPointsBetweenSegments } from "./segment-geometry.js";
import type { Vector3Mm } from "./units.js";

/** Below this length (mm), a member is treated as a degenerate, zero-length member. */
export const NEAR_ZERO_LENGTH_MM = 1;

/** Minimum tolerance used when no section dimensions are available to derive one. */
const DEFAULT_CROSSING_TOLERANCE_MM = 30;

export type JointCandidateKind = "shared-endpoint" | "crossing";

export interface JointCandidate {
  id: string;
  kind: JointCandidateKind;
  memberIds: string[];
  positionMm: Vector3Mm;
  existingJointId: string | null;
}

function midpoint(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function memberEndpoints(member: Member, anchorsById: Map<string, { positionMm: Vector3Mm }>): [Vector3Mm, Vector3Mm] | null {
  const start = anchorsById.get(member.startAnchorId)?.positionMm;
  const end = anchorsById.get(member.endAnchorId)?.positionMm;
  if (!start || !end) return null;
  return [start, end];
}

function halfThicknessMm(sections: Map<string, Section>, sectionId: string): number {
  const section = sections.get(sectionId);
  if (!section) return DEFAULT_CROSSING_TOLERANCE_MM / 2;
  return Math.max(section.widthMm, section.heightMm) / 2;
}

/** Two members' centrelines are treated as touching when closer than the sum of their half-thicknesses. */
function crossingToleranceMm(sections: Map<string, Section>, a: Member, b: Member): number {
  return halfThicknessMm(sections, a.sectionId) + halfThicknessMm(sections, b.sectionId);
}

function existingJointFor(joints: Joint[], memberIds: string[]): string | null {
  const key = [...memberIds].sort().join("::");
  const match = joints.find((joint) => [...joint.connectedMemberIds].sort().join("::") === key);
  return match?.id ?? null;
}

function sharedAnchorId(a: Member, b: Member): string | null {
  const aIds = [a.startAnchorId, a.endAnchorId];
  const bIds = [b.startAnchorId, b.endAnchorId];
  return aIds.find((id) => bIds.includes(id)) ?? null;
}

/**
 * Derives every geometric place where two or more members meet: at a shared
 * anchor (endpoint-to-endpoint) or at an interior crossing (centrelines pass
 * within their combined half-thickness without sharing an anchor). Each
 * candidate carries `existingJointId` so callers can tell which ones the user
 * has already confirmed, changed, or suppressed as an explicit Joint.
 */
export function deriveJointCandidates(document: ProjectDocument): JointCandidate[] {
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));
  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));

  const endpointGroups = new Map<string, string[]>();
  document.members.forEach((member) => {
    [member.startAnchorId, member.endAnchorId].forEach((anchorId) => {
      const group = endpointGroups.get(anchorId) ?? [];
      if (!group.includes(member.id)) group.push(member.id);
      endpointGroups.set(anchorId, group);
    });
  });

  const candidates: JointCandidate[] = [];

  endpointGroups.forEach((memberIds, anchorId) => {
    if (memberIds.length < 2) return;
    const position = anchorsById.get(anchorId)?.positionMm;
    if (!position) return;
    const sortedIds = [...memberIds].sort();
    candidates.push({
      id: `candidate::endpoint::${anchorId}`,
      kind: "shared-endpoint",
      memberIds: sortedIds,
      positionMm: position,
      existingJointId: existingJointFor(document.joints, sortedIds),
    });
  });

  for (let i = 0; i < document.members.length; i += 1) {
    for (let j = i + 1; j < document.members.length; j += 1) {
      const a = document.members[i]!;
      const b = document.members[j]!;
      if (sharedAnchorId(a, b)) continue;

      const aPoints = memberEndpoints(a, anchorsById);
      const bPoints = memberEndpoints(b, anchorsById);
      if (!aPoints || !bPoints) continue;

      const closest = closestPointsBetweenSegments(aPoints[0], aPoints[1], bPoints[0], bPoints[1]);
      const tolerance = crossingToleranceMm(sectionsById, a, b);
      if (closest.distanceMm > tolerance) continue;

      const sortedIds = [a.id, b.id].sort();
      candidates.push({
        id: `candidate::crossing::${sortedIds[0]}::${sortedIds[1]}`,
        kind: "crossing",
        memberIds: sortedIds,
        positionMm: midpoint(closest.pointA, closest.pointB),
        existingJointId: existingJointFor(document.joints, sortedIds),
      });
    }
  }

  return candidates;
}

/** Candidates the user has not yet confirmed, changed, or suppressed as an explicit Joint. */
export function findUnresolvedJointCandidates(document: ProjectDocument): JointCandidate[] {
  return deriveJointCandidates(document).filter((candidate) => candidate.existingJointId === null);
}

/**
 * Recomputes where a joint's connected members currently meet. Returns
 * `null` when the members no longer meet within tolerance (or the joint's
 * shape isn't a supported case), signalling that the joint needs resolution
 * rather than silent, stale geometry.
 */
export function regenerateJointPosition(
  document: ProjectDocument,
  joint: Pick<Joint, "connectedMemberIds">,
): Vector3Mm | null {
  const membersById = new Map(document.members.map((m) => [m.id, m]));
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));
  const members = joint.connectedMemberIds.map((id) => membersById.get(id));
  if (members.some((m) => !m)) return null;
  const resolvedMembers = members as Member[];

  const commonAnchorId = [resolvedMembers[0]!.startAnchorId, resolvedMembers[0]!.endAnchorId].find((anchorId) =>
    resolvedMembers.every((m) => m.startAnchorId === anchorId || m.endAnchorId === anchorId),
  );
  if (commonAnchorId) {
    return anchorsById.get(commonAnchorId)?.positionMm ?? null;
  }

  if (resolvedMembers.length !== 2) return null;
  const [a, b] = resolvedMembers as [Member, Member];
  const aPoints = memberEndpoints(a, anchorsById);
  const bPoints = memberEndpoints(b, anchorsById);
  if (!aPoints || !bPoints) return null;

  const sectionsById = new Map(document.sections.map((s) => [s.id, s]));
  const closest = closestPointsBetweenSegments(aPoints[0], aPoints[1], bPoints[0], bPoints[1]);
  if (closest.distanceMm > crossingToleranceMm(sectionsById, a, b)) return null;
  return midpoint(closest.pointA, closest.pointB);
}
