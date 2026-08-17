const MM_PER_INCH = 25.4;

/** Tolerance for matching a dressed (actual) dimension to its nominal size, absorbing typical manufacturing/rounding variance. */
const TOLERANCE_MM = 3;

/** Standard North American dimensional lumber nominal sizes and their actual (dressed) dimensions, in inches. */
const NOMINAL_SIZES: { nominal: string; actualWidthIn: number; actualHeightIn: number }[] = [
  { nominal: "1x2", actualWidthIn: 0.75, actualHeightIn: 1.5 },
  { nominal: "1x3", actualWidthIn: 0.75, actualHeightIn: 2.5 },
  { nominal: "1x4", actualWidthIn: 0.75, actualHeightIn: 3.5 },
  { nominal: "1x6", actualWidthIn: 0.75, actualHeightIn: 5.5 },
  { nominal: "1x8", actualWidthIn: 0.75, actualHeightIn: 7.25 },
  { nominal: "1x10", actualWidthIn: 0.75, actualHeightIn: 9.25 },
  { nominal: "1x12", actualWidthIn: 0.75, actualHeightIn: 11.25 },
  { nominal: "2x2", actualWidthIn: 1.5, actualHeightIn: 1.5 },
  { nominal: "2x3", actualWidthIn: 1.5, actualHeightIn: 2.5 },
  { nominal: "2x4", actualWidthIn: 1.5, actualHeightIn: 3.5 },
  { nominal: "2x6", actualWidthIn: 1.5, actualHeightIn: 5.5 },
  { nominal: "2x8", actualWidthIn: 1.5, actualHeightIn: 7.25 },
  { nominal: "2x10", actualWidthIn: 1.5, actualHeightIn: 9.25 },
  { nominal: "2x12", actualWidthIn: 1.5, actualHeightIn: 11.25 },
  { nominal: "4x4", actualWidthIn: 3.5, actualHeightIn: 3.5 },
  { nominal: "4x6", actualWidthIn: 3.5, actualHeightIn: 5.5 },
  { nominal: "4x8", actualWidthIn: 3.5, actualHeightIn: 7.25 },
  { nominal: "6x6", actualWidthIn: 5.5, actualHeightIn: 5.5 },
  { nominal: "6x8", actualWidthIn: 5.5, actualHeightIn: 7.25 },
  { nominal: "8x8", actualWidthIn: 7.25, actualHeightIn: 7.25 },
];

function withinTolerance(actualMm: number, candidateIn: number): boolean {
  return Math.abs(actualMm - candidateIn * MM_PER_INCH) <= TOLERANCE_MM;
}

/**
 * Matches actual (dressed) cross-section dimensions in millimetres to the
 * North American nominal dimensional-lumber label buyers order by (e.g.
 * "2x4", "6x6"). Returns `null` rather than guessing when nothing in the
 * standard size table is within tolerance, since a wrong nominal label would
 * misrepresent what to buy.
 */
export function formatNominalLumberSize(widthMm: number, heightMm: number): string | null {
  for (const size of NOMINAL_SIZES) {
    const matchesAsIs = withinTolerance(widthMm, size.actualWidthIn) && withinTolerance(heightMm, size.actualHeightIn);
    const matchesSwapped =
      withinTolerance(widthMm, size.actualHeightIn) && withinTolerance(heightMm, size.actualWidthIn);
    if (matchesAsIs || matchesSwapped) {
      return size.nominal;
    }
  }
  return null;
}

/**
 * Rewrites a section name's leading raw-millimetre dimension (e.g. `"140x140
 * post"`) to its North American nominal size (`"6x6 post"`), when the name
 * literally encodes the same width/height this section was given. Leaves the
 * name untouched otherwise — a custom or already-descriptive name (or
 * dimensions with no standard nominal match) is never guessed at or rewritten.
 */
export function formatSectionLabel(name: string, widthMm: number, heightMm: number): string {
  const nominal = formatNominalLumberSize(widthMm, heightMm);
  if (nominal === null) return name;

  const rawPrefixes = [`${widthMm}x${heightMm}`, `${heightMm}x${widthMm}`];
  for (const prefix of rawPrefixes) {
    if (name.startsWith(prefix)) {
      return nominal + name.slice(prefix.length);
    }
  }
  return name;
}
