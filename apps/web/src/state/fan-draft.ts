import type { FanDistribution, FanElevationRule, FanTarget } from "@canopy/shared";

/**
 * In-progress, editable fan field parameters shown in the preview step before
 * a fan field is committed. `distributionMode`/`elevationMode` mirror the
 * canonical schema's discriminated unions but keep both branches' fields
 * around so the Inspector can switch between them without losing what the
 * user already typed.
 */
export interface FanDraft {
  sourceAnchorId: string;
  target: FanTarget;
  distributionMode: "count" | "spacing";
  count: number;
  spacingMm: number;
  reversed: boolean;
  elevationMode: "linear" | "parabolic";
  sagMm: number;
  sectionId: string;
}

export const DEFAULT_FAN_COUNT = 5;
export const DEFAULT_FAN_SPACING_MM = 600;
export const DEFAULT_FAN_SAG_MM = 150;

export function createFanDraft(sourceAnchorId: string, target: FanTarget, sectionId: string): FanDraft {
  return {
    sourceAnchorId,
    target,
    distributionMode: "count",
    count: DEFAULT_FAN_COUNT,
    spacingMm: DEFAULT_FAN_SPACING_MM,
    reversed: false,
    elevationMode: "linear",
    sagMm: DEFAULT_FAN_SAG_MM,
    sectionId,
  };
}

export function fanDraftDistribution(draft: FanDraft): FanDistribution {
  return draft.distributionMode === "count"
    ? { mode: "count", count: draft.count }
    : { mode: "spacing", spacingMm: draft.spacingMm };
}

export function fanDraftElevationRule(draft: FanDraft): FanElevationRule {
  return draft.elevationMode === "linear" ? { kind: "linear" } : { kind: "parabolic", sagMm: draft.sagMm };
}
