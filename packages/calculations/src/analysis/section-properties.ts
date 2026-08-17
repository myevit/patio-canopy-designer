/**
 * Rectangular-section geometry only: plain solid geometry, not a graded-
 * lumber or standards-derived property. Allowable stresses and elastic
 * modulus always come from explicit user entries elsewhere in this module.
 */
export function rectSectionAreaMm2(widthMm: number, heightMm: number): number {
  return widthMm * heightMm;
}

/** Second moment of area about the axis perpendicular to `heightMm` (i.e. bending about that axis). */
export function rectSectionIMm4(widthMm: number, heightMm: number): number {
  return (widthMm * heightMm ** 3) / 12;
}
