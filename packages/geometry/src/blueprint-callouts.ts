import type { Joint, ProjectDocument } from "@canopy/shared";
import type { PhysicalMember } from "./resolve-physical-members.js";

export interface MemberMark {
  memberId: string;
  mark: string;
}

/**
 * Posts get P1..Pn and beams get B1..Bn, each numbered in sorted-id order so
 * regenerating the sheet from the same document always yields the same
 * marks, regardless of array order coming out of derivePhysicalMembers.
 */
export function assignMemberMarks(members: PhysicalMember[]): MemberMark[] {
  const posts = members
    .filter((m) => m.kind === "post")
    .map((m) => m.id)
    .sort();
  const beams = members
    .filter((m) => m.kind === "beam")
    .map((m) => m.id)
    .sort();
  return [
    ...posts.map((memberId, index) => ({ memberId, mark: `P${index + 1}` })),
    ...beams.map((memberId, index) => ({ memberId, mark: `B${index + 1}` })),
  ];
}

export interface JointMark {
  jointId: string;
  mark: string;
}

/** Joints get J1..Jn in sorted-id order, for the same regeneration stability as member marks. */
export function assignJointMarks(joints: Joint[]): JointMark[] {
  return [...joints]
    .map((j) => j.id)
    .sort()
    .map((jointId, index) => ({ jointId, mark: `J${index + 1}` }));
}

/** True only if the mark's referenced id is still a live post or member in the document. */
export function resolveMemberMark(mark: MemberMark, document: ProjectDocument): boolean {
  return document.posts.some((p) => p.id === mark.memberId) || document.members.some((m) => m.id === mark.memberId);
}

/** True only if the mark's referenced id is still a live joint in the document. */
export function resolveJointMark(mark: JointMark, document: ProjectDocument): boolean {
  return document.joints.some((j) => j.id === mark.jointId);
}
