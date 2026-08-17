import type { ProjectDocument } from "@canopy/shared";

export interface AnalysisSnapshot {
  readonly document: ProjectDocument;
  readonly revision: number;
  readonly frozenAtIso: string;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (!Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Analysis must never mutate the authoring document (invariant 8 / 5 in the
 * delivery plan). This clones the document so later edits in the studio
 * can't leak into an in-progress analysis, then deep-freezes the clone so
 * analysis code itself cannot write back into it either.
 */
export function freezeAnalysisSnapshot(document: ProjectDocument, frozenAtIso: string): AnalysisSnapshot {
  const clone = JSON.parse(JSON.stringify(document)) as ProjectDocument;
  return Object.freeze({
    document: deepFreeze(clone),
    revision: document.revision,
    frozenAtIso,
  });
}
