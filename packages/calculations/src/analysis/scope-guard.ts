import type { ProjectDocument } from "@canopy/shared";

export type MemberAnalysisCondition = "simply-supported" | "cantilever";

export type MemberAnalysisScopeResult =
  | { supported: true; condition: MemberAnalysisCondition }
  | { supported: false; reason: string };

export type PostAnalysisScopeResult = { supported: true } | { supported: false; reason: string };

function anchorKind(document: ProjectDocument, anchorId: string) {
  return document.anchors.find((anchor) => anchor.id === anchorId)?.kind;
}

/**
 * Decides whether a member's beam mechanics fall inside the explicitly
 * supported closed-form cases (simply-supported or cantilever, between
 * exactly two unshared endpoints). Anything else - ledgers, fan-rafters,
 * members that participate in a modeled joint, or unrecognized end
 * conditions - is refused rather than approximated.
 */
export function memberAnalysisScope(document: ProjectDocument, memberId: string): MemberAnalysisScopeResult {
  const member = document.members.find((m) => m.id === memberId);
  if (!member) {
    return { supported: false, reason: `Unknown member id: ${memberId}` };
  }
  if (member.role === "ledger") {
    return {
      supported: false,
      reason:
        "Ledger members bear on the house structure; unknown house-ledger stiffness is outside validated scope.",
    };
  }
  if (member.role === "fan-rafter") {
    return {
      supported: false,
      reason:
        "Fan-rafter members share a saddle/fan lattice load path; global saddle/gridshell stability is outside validated scope.",
    };
  }
  const isJointed = document.joints.some((joint) => joint.connectedMemberIds.includes(memberId));
  if (isJointed) {
    return {
      supported: false,
      reason:
        "Member participates in a modeled joint; semi-rigid/eccentric joint load sharing is outside validated scope.",
    };
  }

  const startKind = anchorKind(document, member.startAnchorId);
  const endKind = anchorKind(document, member.endAnchorId);

  if (startKind === "post-top" && endKind === "post-top") {
    return { supported: true, condition: "simply-supported" };
  }
  if ((startKind === "post-top" && endKind === "free") || (startKind === "free" && endKind === "post-top")) {
    return { supported: true, condition: "cantilever" };
  }
  return {
    supported: false,
    reason: "Member end conditions are not an explicitly supported simply-supported or cantilever case.",
  };
}

/**
 * A post is only in scope for the axial-load-plus-moment check when its top
 * anchor carries at most one member. A top anchor shared by multiple members
 * (a fan source, a multi-beam frame node) implies combined/biaxial loading
 * that this fail-closed screening does not attempt to resolve.
 */
export function postAnalysisScope(document: ProjectDocument, postId: string): PostAnalysisScopeResult {
  const post = document.posts.find((p) => p.id === postId);
  if (!post) {
    return { supported: false, reason: `Unknown post id: ${postId}` };
  }
  const memberCount = document.members.filter(
    (m) => m.startAnchorId === post.topAnchorId || m.endAnchorId === post.topAnchorId,
  ).length;
  if (memberCount > 1) {
    return {
      supported: false,
      reason:
        "Post top anchor carries more than one member; biaxial post bending from a multi-member frame is outside validated scope.",
    };
  }
  return { supported: true };
}
