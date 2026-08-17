/**
 * Every load and allowable value carries a provenance record so a reviewer
 * can trace a number back to who/what asserted it. Nothing in this module
 * is ever derived from a hardcoded standards table; "computed-*" sources
 * are always computed from other explicit user entries plus geometry
 * already present in the canonical document.
 */
export interface LoadProvenance {
  source: "user-entered" | "computed-self-weight" | "computed-tributary";
  /** Human-readable description shown next to the value, e.g. "User snow load input". */
  label: string;
  note?: string;
}

/**
 * Describes which code edition/provider a user is checking against. This is
 * purely descriptive metadata attached to a report for traceability; it is
 * never used to look up a table or equation bundled with this application.
 */
export interface JurisdictionMetadata {
  provider: string;
  edition: string;
  effectiveDate: string;
  sourceUrl?: string;
  note?: string;
}
