import type { ProjectDocument, Vector3Mm } from "@canopy/shared";

export type MemberAnalysisCondition = "simply-supported" | "cantilever";

export type MemberAnalysisScopeResult =
  | { supported: true; condition: MemberAnalysisCondition }
  | { supported: false; reason: string };

export type PostAnalysisScopeResult = { supported: true } | { supported: false; reason: string };

/** Documented tolerance: endpoints within this elevation difference are treated as coplanar regardless of span. */
const ELEVATION_TOLERANCE_MM = 15;

/**
 * Documented tolerance: beyond this inclination from horizontal, gravity load
 * no longer acts predominantly transverse to the member axis, so the
 * through-gravity simple-beam/cantilever model this package implements is no
 * longer valid. ~5 degrees.
 */
const MAX_INCLINATION_RAD = 0.0875;

function anchorById(document: ProjectDocument, anchorId: string) {
  return document.anchors.find((anchor) => anchor.id === anchorId);
}

function anchorKind(document: ProjectDocument, anchorId: string) {
  return anchorById(document, anchorId)?.kind;
}

/**
 * Refuses a member whose endpoints are skewed/non-coplanar enough that a
 * horizontal through-gravity simple-beam or cantilever model would not
 * apply - e.g. a strongly-sloped span between unequal-height posts, or a
 * near-vertical member. See the plan's "arbitrary skew / non-coplanar load
 * sharing" must-refuse item.
 */
function coplanarityGuard(start: Vector3Mm, end: Vector3Mm): { ok: true } | { ok: false; reason: string } {
  const riseMm = Math.abs(end.z - start.z);
  if (riseMm <= ELEVATION_TOLERANCE_MM) {
    return { ok: true };
  }
  const runMm = Math.hypot(end.x - start.x, end.y - start.y);
  const inclinationRad = Math.atan2(riseMm, runMm);
  if (inclinationRad <= MAX_INCLINATION_RAD) {
    return { ok: true };
  }
  const inclinationDeg = (inclinationRad * 180) / Math.PI;
  return {
    ok: false,
    reason:
      `Member endpoints differ in elevation by ${riseMm.toFixed(0)} mm over a ${runMm.toFixed(0)} mm run ` +
      `(${inclinationDeg.toFixed(1)} deg from horizontal), beyond the documented near-horizontal/coplanar ` +
      "tolerance; a skewed or non-coplanar member is outside the validated through-gravity beam model.",
  };
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

  const startAnchor = anchorById(document, member.startAnchorId);
  const endAnchor = anchorById(document, member.endAnchorId);
  const startKind = startAnchor?.kind;
  const endKind = endAnchor?.kind;

  if (
    (startKind === "post-top" && endKind === "post-top") ||
    (startKind === "post-top" && endKind === "free") ||
    (startKind === "free" && endKind === "post-top")
  ) {
    const coplanarity = coplanarityGuard(startAnchor!.positionMm, endAnchor!.positionMm);
    if (!coplanarity.ok) {
      return { supported: false, reason: coplanarity.reason };
    }
    return {
      supported: true,
      condition: startKind === "post-top" && endKind === "post-top" ? "simply-supported" : "cantilever",
    };
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
