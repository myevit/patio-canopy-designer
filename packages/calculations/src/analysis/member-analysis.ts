import type { Vector3Mm } from "@canopy/shared";
import { analyzeBeam, type BeamMechanicsResult, type MemberLoadCase } from "./beam-mechanics.js";
import { checkBearingDemand, type BearingCheckResult } from "./bearing.js";
import type { JurisdictionMetadata } from "./provenance.js";
import { memberAnalysisScope, type MemberAnalysisCondition } from "./scope-guard.js";
import type { AnalysisSnapshot } from "./snapshot.js";
import { worstStatus, type AnalysisStatus } from "./status.js";

export interface MemberAnalysisBearingInput {
  widthMm: number;
  lengthMm: number;
  allowableStressMPa?: number;
}

export interface MemberAnalysisInput {
  memberId: string;
  loads: MemberLoadCase[];
  elasticModulusMPa?: number;
  momentOfInertiaMm4?: number;
  bearing?: MemberAnalysisBearingInput;
  /** Purely descriptive; never used to look up a bundled table or equation. */
  jurisdiction?: JurisdictionMetadata;
}

export interface MemberAnalysisReport {
  memberId: string;
  status: AnalysisStatus;
  reason?: string;
  jurisdiction?: JurisdictionMetadata;
  condition?: MemberAnalysisCondition;
  spanMm?: number;
  reactionStartN?: number;
  reactionEndN?: number;
  fixedEndMomentNmm?: number;
  maxMomentNmm?: number;
  maxShearN?: number;
  maxDeflectionMm?: number;
  bearingStart?: BearingCheckResult;
  bearingEnd?: BearingCheckResult;
}

function distanceMm(a: Vector3Mm, b: Vector3Mm): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sumField(results: BeamMechanicsResult[], field: keyof BeamMechanicsResult): number | undefined {
  const values = results.map((r) => r[field]).filter((v): v is number => typeof v === "number");
  if (values.length !== results.length) return undefined;
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Ties the load effects declared by the caller to the canonical model: the
 * span comes from the member's own anchor geometry, and the support
 * condition comes only from `memberAnalysisScope`, never from a guess. Each
 * load is analyzed separately with `analyzeBeam` and combined by linear
 * superposition, which is valid for the elastic beam theory used here.
 */
export function analyzeMember(snapshot: AnalysisSnapshot, input: MemberAnalysisInput): MemberAnalysisReport {
  const { document } = snapshot;
  const scope = memberAnalysisScope(document, input.memberId);
  if (!scope.supported) {
    return {
      memberId: input.memberId,
      status: "outside-validated-scope",
      reason: scope.reason,
      jurisdiction: input.jurisdiction,
    };
  }

  const member = document.members.find((m) => m.id === input.memberId)!;
  const start = document.anchors.find((a) => a.id === member.startAnchorId)!.positionMm;
  const end = document.anchors.find((a) => a.id === member.endAnchorId)!.positionMm;
  const spanMm = distanceMm(start, end);

  if (input.loads.length === 0) {
    return {
      memberId: input.memberId,
      status: "input-requires-verification",
      reason: "No loads supplied for this member.",
      jurisdiction: input.jurisdiction,
      condition: scope.condition,
      spanMm,
    };
  }

  const results = input.loads.map((load) =>
    analyzeBeam({
      support: scope.condition,
      spanMm,
      load,
      elasticModulusMPa: input.elasticModulusMPa,
      momentOfInertiaMm4: input.momentOfInertiaMm4,
    }),
  );

  const blocking = results.find((r) => r.status === "outside-validated-scope" || r.status === "check-not-implemented");
  if (blocking) {
    return {
      memberId: input.memberId,
      status: blocking.status,
      reason: blocking.reason,
      jurisdiction: input.jurisdiction,
      condition: scope.condition,
      spanMm,
    };
  }

  const reactionStartN = sumField(results, "reactionStartN");
  const reactionEndN = sumField(results, "reactionEndN");
  const fixedEndMomentNmm = sumField(results, "fixedEndMomentNmm");
  const maxMomentNmm = sumField(results, "maxMomentNmm");
  const maxShearN = sumField(results, "maxShearN");
  const maxDeflectionMm = sumField(results, "maxDeflectionMm");

  const bearingStart =
    input.bearing && reactionStartN !== undefined
      ? checkBearingDemand({
          reactionN: reactionStartN,
          bearingWidthMm: input.bearing.widthMm,
          bearingLengthMm: input.bearing.lengthMm,
          allowableBearingStressMPa: input.bearing.allowableStressMPa,
        })
      : undefined;
  const bearingEnd =
    input.bearing && scope.condition === "simply-supported" && reactionEndN !== undefined
      ? checkBearingDemand({
          reactionN: reactionEndN,
          bearingWidthMm: input.bearing.widthMm,
          bearingLengthMm: input.bearing.lengthMm,
          allowableBearingStressMPa: input.bearing.allowableStressMPa,
        })
      : undefined;

  const mechanicsStatus = worstStatus(results.map((r) => r.status));
  const overallStatus = worstStatus(
    [mechanicsStatus, bearingStart?.status, bearingEnd?.status].filter((s): s is AnalysisStatus => s !== undefined),
  );

  return {
    memberId: input.memberId,
    status: overallStatus,
    jurisdiction: input.jurisdiction,
    condition: scope.condition,
    spanMm,
    reactionStartN,
    reactionEndN,
    fixedEndMomentNmm,
    maxMomentNmm,
    maxShearN,
    maxDeflectionMm,
    bearingStart,
    bearingEnd,
  };
}
