import type { Millimetres } from "./units.js";

export type DisplayLengthUnit = "mm" | "m" | "ft-in";

const MM_PER_INCH = 25.4;
const SIXTEENTHS_PER_INCH = 16;
const INCHES_PER_FOOT = 12;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatFeetInches(valueMm: Millimetres): string {
  const totalSixteenths = Math.round((valueMm / MM_PER_INCH) * SIXTEENTHS_PER_INCH);
  const sixteenthsPerFoot = INCHES_PER_FOOT * SIXTEENTHS_PER_INCH;
  const feet = Math.floor(totalSixteenths / sixteenthsPerFoot);
  const remainderSixteenths = totalSixteenths - feet * sixteenthsPerFoot;
  const inches = Math.floor(remainderSixteenths / SIXTEENTHS_PER_INCH);
  const fractionSixteenths = remainderSixteenths - inches * SIXTEENTHS_PER_INCH;

  if (fractionSixteenths === 0) {
    return `${feet}'-${inches}"`;
  }
  const divisor = gcd(fractionSixteenths, SIXTEENTHS_PER_INCH);
  return `${feet}'-${inches} ${fractionSixteenths / divisor}/${SIXTEENTHS_PER_INCH / divisor}"`;
}

/**
 * Formats a canonical millimetre length for display only; the canonical
 * value passed in is never mutated or reinterpreted, only presented in the
 * requested unit.
 */
export function formatLengthMm(valueMm: Millimetres, unit: DisplayLengthUnit): string {
  switch (unit) {
    case "mm":
      return `${Math.round(valueMm)} mm`;
    case "m":
      return `${(valueMm / 1000).toFixed(3)} m`;
    case "ft-in":
      return formatFeetInches(valueMm);
  }
}
