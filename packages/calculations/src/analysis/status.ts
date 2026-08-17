/**
 * Every component check in Milestone 7 reports one of these five states
 * instead of a single global "safe"/"approved" flag. A calculator that
 * cannot fully justify a numeric answer must never silently downgrade to
 * a guess: it returns "check-not-implemented" or "outside-validated-scope"
 * instead.
 */
export type AnalysisStatus =
  | "calculated-within-stated-assumptions"
  | "input-requires-verification"
  | "check-not-implemented"
  | "outside-validated-scope"
  | "engineer-review-required";

const STATUS_RANK: Record<AnalysisStatus, number> = {
  "calculated-within-stated-assumptions": 0,
  "input-requires-verification": 1,
  "engineer-review-required": 2,
  "check-not-implemented": 3,
  "outside-validated-scope": 4,
};

/** Combines several sub-check statuses into one overall status: the least-certain result always wins. */
export function worstStatus(statuses: AnalysisStatus[]): AnalysisStatus {
  return statuses.reduce((worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst));
}
