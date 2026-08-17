import type { AnalysisStatus } from "./status.js";

export type SupportCondition = "simply-supported" | "cantilever";

export interface UniformLoadCase {
  kind: "uniform";
  wNPerMm: number;
}
export interface MidspanPointLoadCase {
  kind: "point-midspan";
  pN: number;
}
export interface TipPointLoadCase {
  kind: "point-tip";
  pN: number;
}
export type MemberLoadCase = UniformLoadCase | MidspanPointLoadCase | TipPointLoadCase;

export interface BeamMechanicsInput {
  support: SupportCondition;
  spanMm: number;
  load: MemberLoadCase;
  elasticModulusMPa?: number;
  momentOfInertiaMm4?: number;
}

export interface BeamMechanicsResult {
  status: AnalysisStatus;
  reason?: string;
  reactionStartN?: number;
  reactionEndN?: number;
  /** Moment reaction at the fixed end; only meaningful for a cantilever. */
  fixedEndMomentNmm?: number;
  maxMomentNmm?: number;
  maxMomentPositionMm?: number;
  maxShearN?: number;
  maxDeflectionMm?: number;
  maxDeflectionPositionMm?: number;
}

/**
 * Textbook closed-form statics/mechanics for exactly four explicitly
 * supported cases: a simply-supported or cantilevered member under a single
 * uniform or point load in one of the two positions those support
 * conditions make unambiguous (midspan for simply-supported, tip for
 * cantilever). Anything else - a different load position, an unsupported
 * combination, or a non-positive span - is refused rather than guessed.
 * Multiple simultaneous loads are handled by the caller through linear
 * superposition of separate calls, not inside this function.
 */
export function analyzeBeam(input: BeamMechanicsInput): BeamMechanicsResult {
  const { support, spanMm, load } = input;

  if (!(spanMm > 0) || !Number.isFinite(spanMm)) {
    return { status: "outside-validated-scope", reason: "Span must be a positive, finite length." };
  }

  const statics = computeStatics(support, spanMm, load);
  if (!statics) {
    return {
      status: "check-not-implemented",
      reason: `Load case "${load.kind}" is not an explicitly supported combination for a ${support} member.`,
    };
  }

  const { elasticModulusMPa: E, momentOfInertiaMm4: I } = input;
  if (E === undefined || I === undefined || !(E > 0) || !(I > 0)) {
    return {
      status: "input-requires-verification",
      reason: "Elastic modulus and moment of inertia are required to compute the deflection envelope.",
      ...statics,
    };
  }

  const deflection = computeDeflection(support, spanMm, load, E, I);
  return {
    status: "calculated-within-stated-assumptions",
    ...statics,
    ...deflection,
  };
}

function computeStatics(
  support: SupportCondition,
  spanMm: number,
  load: MemberLoadCase,
): Omit<BeamMechanicsResult, "status" | "reason"> | null {
  if (support === "simply-supported") {
    if (load.kind === "uniform") {
      const { wNPerMm: w } = load;
      const reaction = (w * spanMm) / 2;
      return {
        reactionStartN: reaction,
        reactionEndN: reaction,
        maxMomentNmm: (w * spanMm ** 2) / 8,
        maxMomentPositionMm: spanMm / 2,
        maxShearN: reaction,
      };
    }
    if (load.kind === "point-midspan") {
      const { pN: p } = load;
      const reaction = p / 2;
      return {
        reactionStartN: reaction,
        reactionEndN: reaction,
        maxMomentNmm: (p * spanMm) / 4,
        maxMomentPositionMm: spanMm / 2,
        maxShearN: reaction,
      };
    }
    return null;
  }

  // Cantilever, fixed at the start and free at the end.
  if (load.kind === "uniform") {
    const { wNPerMm: w } = load;
    const totalN = w * spanMm;
    const fixedEndMomentNmm = (w * spanMm ** 2) / 2;
    return {
      reactionStartN: totalN,
      reactionEndN: 0,
      fixedEndMomentNmm,
      maxMomentNmm: fixedEndMomentNmm,
      maxMomentPositionMm: 0,
      maxShearN: totalN,
    };
  }
  if (load.kind === "point-tip") {
    const { pN: p } = load;
    const fixedEndMomentNmm = p * spanMm;
    return {
      reactionStartN: p,
      reactionEndN: 0,
      fixedEndMomentNmm,
      maxMomentNmm: fixedEndMomentNmm,
      maxMomentPositionMm: 0,
      maxShearN: p,
    };
  }
  return null;
}

function computeDeflection(
  support: SupportCondition,
  spanMm: number,
  load: MemberLoadCase,
  elasticModulusMPa: number,
  momentOfInertiaMm4: number,
): Pick<BeamMechanicsResult, "maxDeflectionMm" | "maxDeflectionPositionMm"> {
  const EI = elasticModulusMPa * momentOfInertiaMm4;
  if (support === "simply-supported") {
    if (load.kind === "uniform") {
      return {
        maxDeflectionMm: (5 * load.wNPerMm * spanMm ** 4) / (384 * EI),
        maxDeflectionPositionMm: spanMm / 2,
      };
    }
    // point-midspan
    const p = (load as MidspanPointLoadCase).pN;
    return {
      maxDeflectionMm: (p * spanMm ** 3) / (48 * EI),
      maxDeflectionPositionMm: spanMm / 2,
    };
  }
  if (load.kind === "uniform") {
    return {
      maxDeflectionMm: (load.wNPerMm * spanMm ** 4) / (8 * EI),
      maxDeflectionPositionMm: spanMm,
    };
  }
  // point-tip
  const p = (load as TipPointLoadCase).pN;
  return {
    maxDeflectionMm: (p * spanMm ** 3) / (3 * EI),
    maxDeflectionPositionMm: spanMm,
  };
}
