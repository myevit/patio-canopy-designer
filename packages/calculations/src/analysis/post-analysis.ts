import { checkFootingBearingAndUplift, type FootingCheckResult } from "./footing.js";
import type { AppliedLoadKind } from "./loads.js";
import { checkPostAxialAndMoment, type PostAxialCheckResult } from "./post-axial.js";
import type { JurisdictionMetadata, LoadProvenance } from "./provenance.js";
import { postAnalysisScope } from "./scope-guard.js";
import type { AnalysisSnapshot } from "./snapshot.js";
import { worstStatus, type AnalysisStatus } from "./status.js";

export interface PostAnalysisFootingInput {
  widthMm: number;
  lengthMm: number;
  allowableBearingCapacityKPa?: number;
  upliftDemandN?: number;
  upliftResistanceN?: number;
}

/**
 * The axial-load-plus-moment demand applied to a post (typically the beam
 * reaction transferred through its top anchor), tagged with the category
 * and `LoadProvenance` it was actually computed/entered from so the report
 * can attribute it back to its source.
 */
export interface PostAppliedLoad {
  axialLoadN: number;
  endMomentNmm: number;
  kind: AppliedLoadKind;
  provenance: LoadProvenance;
}

export interface PostAnalysisInput {
  postId: string;
  load: PostAppliedLoad;
  unbracedLengthMm?: number;
  allowableCompressionStressMPa?: number;
  allowableBendingStressMPa?: number;
  footing?: PostAnalysisFootingInput;
  /** Purely descriptive; never used to look up a bundled table or equation. */
  jurisdiction?: JurisdictionMetadata;
}

export interface PostAnalysisReport {
  postId: string;
  status: AnalysisStatus;
  reason?: string;
  jurisdiction?: JurisdictionMetadata;
  /** Source category + provenance for the applied load actually analyzed, alongside `jurisdiction`. */
  loadProvenance?: { kind: AppliedLoadKind; provenance: LoadProvenance };
  axial?: PostAxialCheckResult;
  footing?: FootingCheckResult;
}

/** Ties post axial-plus-moment and footing demand to the canonical model's post/section geometry. */
export function analyzePost(snapshot: AnalysisSnapshot, input: PostAnalysisInput): PostAnalysisReport {
  const { document } = snapshot;
  const scope = postAnalysisScope(document, input.postId);
  if (!scope.supported) {
    return {
      postId: input.postId,
      status: "outside-validated-scope",
      reason: scope.reason,
      jurisdiction: input.jurisdiction,
    };
  }

  const post = document.posts.find((p) => p.id === input.postId)!;
  const section = document.sections.find((s) => s.id === post.sectionId)!;
  const loadProvenance = { kind: input.load.kind, provenance: input.load.provenance };

  const axial = checkPostAxialAndMoment({
    axialLoadN: input.load.axialLoadN,
    endMomentNmm: input.load.endMomentNmm,
    unbracedLengthMm: input.unbracedLengthMm,
    sectionWidthMm: section.widthMm,
    sectionHeightMm: section.heightMm,
    allowableCompressionStressMPa: input.allowableCompressionStressMPa,
    allowableBendingStressMPa: input.allowableBendingStressMPa,
  });

  const footing = input.footing
    ? checkFootingBearingAndUplift({
        reactionCompressionN: input.load.axialLoadN,
        footingWidthMm: input.footing.widthMm,
        footingLengthMm: input.footing.lengthMm,
        allowableBearingCapacityKPa: input.footing.allowableBearingCapacityKPa,
        upliftDemandN: input.footing.upliftDemandN,
        upliftResistanceN: input.footing.upliftResistanceN,
      })
    : undefined;

  return {
    postId: input.postId,
    status: worstStatus([axial.status, footing?.status].filter((s): s is AnalysisStatus => s !== undefined)),
    jurisdiction: input.jurisdiction,
    loadProvenance,
    axial,
    footing,
  };
}
