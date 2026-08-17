import type { Member, ProjectDocument } from "./design-schema.js";
import { NEAR_ZERO_LENGTH_MM, deriveJointCandidates, regenerateJointPosition } from "./joint-candidates.js";
import type { Vector3Mm } from "./units.js";

export type TopologyIssueKind =
  | "unresolved-connection"
  | "duplicate-member"
  | "near-zero-length-member"
  | "overlapping-members"
  | "ambiguous-intersection"
  | "joint-needs-resolution";

export interface TopologyIssue {
  kind: TopologyIssueKind;
  memberIds: string[];
  message: string;
}

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function length(a: Vector3Mm): number {
  return Math.sqrt(dot(a, a));
}

function memberSegment(
  member: Member,
  anchorsById: Map<string, { positionMm: Vector3Mm }>,
): [Vector3Mm, Vector3Mm] | null {
  const start = anchorsById.get(member.startAnchorId)?.positionMm;
  const end = anchorsById.get(member.endAnchorId)?.positionMm;
  if (!start || !end) return null;
  return [start, end];
}

function anchorPairKey(member: Member): string {
  return [member.startAnchorId, member.endAnchorId].sort().join("::");
}

const COLLINEAR_TOLERANCE_MM = 1;
const OVERLAP_TOLERANCE_MM = 1;
const AMBIGUOUS_BUCKET_MM = 10;

function findOverlappingMembers(document: ProjectDocument): TopologyIssue[] {
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));
  const issues: TopologyIssue[] = [];

  for (let i = 0; i < document.members.length; i += 1) {
    for (let j = i + 1; j < document.members.length; j += 1) {
      const a = document.members[i]!;
      const b = document.members[j]!;
      if (anchorPairKey(a) === anchorPairKey(b)) continue; // already a duplicate-member issue

      const segA = memberSegment(a, anchorsById);
      const segB = memberSegment(b, anchorsById);
      if (!segA || !segB) continue;
      const [p1, p2] = segA;
      const [p3, p4] = segB;

      const dirA = subtract(p2, p1);
      const lenA = length(dirA);
      if (lenA < NEAR_ZERO_LENGTH_MM) continue;
      const unitA = { x: dirA.x / lenA, y: dirA.y / lenA, z: dirA.z / lenA };

      const toP3 = subtract(p3, p1);
      const toP4 = subtract(p4, p1);
      const collinear =
        length(cross(unitA, toP3)) < COLLINEAR_TOLERANCE_MM && length(cross(unitA, toP4)) < COLLINEAR_TOLERANCE_MM;
      if (!collinear) continue;

      const t1a = 0;
      const t1b = lenA;
      const t2a = dot(toP3, unitA);
      const t2b = dot(toP4, unitA);
      const min2 = Math.min(t2a, t2b);
      const max2 = Math.max(t2a, t2b);
      const overlap = Math.min(t1b, max2) - Math.max(t1a, min2);
      if (overlap > OVERLAP_TOLERANCE_MM) {
        issues.push({
          kind: "overlapping-members",
          memberIds: [a.id, b.id].sort(),
          message: `Members "${a.id}" and "${b.id}" are collinear and overlap by about ${Math.round(overlap)} mm.`,
        });
      }
    }
  }

  return issues;
}

function findAmbiguousIntersections(document: ProjectDocument): TopologyIssue[] {
  const crossings = deriveJointCandidates(document).filter((c) => c.kind === "crossing");
  const buckets = new Map<string, Set<string>>();
  crossings.forEach((candidate) => {
    const key = [
      Math.round(candidate.positionMm.x / AMBIGUOUS_BUCKET_MM),
      Math.round(candidate.positionMm.y / AMBIGUOUS_BUCKET_MM),
      Math.round(candidate.positionMm.z / AMBIGUOUS_BUCKET_MM),
    ].join(",");
    const memberIds = buckets.get(key) ?? new Set<string>();
    candidate.memberIds.forEach((id) => memberIds.add(id));
    buckets.set(key, memberIds);
  });

  const issues: TopologyIssue[] = [];
  buckets.forEach((memberIds) => {
    if (memberIds.size <= 2) return;
    const sorted = [...memberIds].sort();
    issues.push({
      kind: "ambiguous-intersection",
      memberIds: sorted,
      message: `Members ${sorted.map((id) => `"${id}"`).join(", ")} cross at approximately the same point; confirm each connection individually.`,
    });
  });
  return issues;
}

/**
 * Surfaces every geometric problem the user needs to resolve before the
 * connection topology can be trusted: unconfirmed connections, duplicate or
 * near-zero-length members, collinear overlaps, ambiguous multi-member
 * crossings, and joints whose members have since moved apart.
 */
export function findTopologyIssues(document: ProjectDocument): TopologyIssue[] {
  const issues: TopologyIssue[] = [];
  const anchorsById = new Map(document.anchors.map((a) => [a.id, a]));

  deriveJointCandidates(document)
    .filter((candidate) => candidate.existingJointId === null)
    .forEach((candidate) => {
      issues.push({
        kind: "unresolved-connection",
        memberIds: candidate.memberIds,
        message: `${candidate.memberIds.map((id) => `"${id}"`).join(" and ")} meet but have no confirmed joint yet.`,
      });
    });

  document.members.forEach((member) => {
    const segment = memberSegment(member, anchorsById);
    if (!segment) return;
    if (length(subtract(segment[1], segment[0])) < NEAR_ZERO_LENGTH_MM) {
      issues.push({
        kind: "near-zero-length-member",
        memberIds: [member.id],
        message: `Member "${member.id}" is near-zero-length.`,
      });
    }
  });

  const byAnchorPair = new Map<string, string[]>();
  document.members.forEach((member) => {
    const key = anchorPairKey(member);
    const group = byAnchorPair.get(key) ?? [];
    group.push(member.id);
    byAnchorPair.set(key, group);
  });
  byAnchorPair.forEach((memberIds) => {
    if (memberIds.length < 2) return;
    issues.push({
      kind: "duplicate-member",
      memberIds: [...memberIds].sort(),
      message: `Members ${memberIds.map((id) => `"${id}"`).join(", ")} connect the same two anchors.`,
    });
  });

  issues.push(...findOverlappingMembers(document));
  issues.push(...findAmbiguousIntersections(document));

  document.joints.forEach((joint) => {
    const regenerated = regenerateJointPosition(document, joint);
    if (regenerated === null) {
      issues.push({
        kind: "joint-needs-resolution",
        memberIds: [...joint.connectedMemberIds].sort(),
        message: `Joint "${joint.id}" no longer matches its connected members' current geometry.`,
      });
    }
  });

  return issues;
}
