import type { Millimetres } from "./units.js";

export const DISPLAY_LENGTH_UNITS = ["mm", "m", "ft-in"] as const;

export type DisplayLengthUnit = (typeof DISPLAY_LENGTH_UNITS)[number];

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

const DECIMAL_NUMBER_PATTERN = /^\d+(\.\d+)?$/;

function parsePlainNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || Number.isNaN(Number(trimmed)) || !Number.isFinite(Number(trimmed))) {
    return null;
  }
  return Number(trimmed);
}

/**
 * Parses North American feet-inches construction notation (e.g. `8'-9 7/8"`,
 * `8' 9"`, `9"`, `8'`) back to millimetres. Requires an explicit `'` or `"`
 * marker on at least one component, since a bare number is ambiguous between
 * feet and inches.
 */
function parseFeetInches(text: string): Millimetres | null {
  let remainder = text.trim();
  if (remainder.length === 0) return null;

  let negative = false;
  if (remainder.startsWith("-")) {
    negative = true;
    remainder = remainder.slice(1).trim();
  }

  let feet = 0;
  const footIndex = remainder.indexOf("'");
  if (footIndex !== -1) {
    const feetText = remainder.slice(0, footIndex).trim();
    if (!DECIMAL_NUMBER_PATTERN.test(feetText)) return null;
    feet = Number(feetText);
    remainder = remainder.slice(footIndex + 1).trim();
  }

  remainder = remainder.replace(/^-\s*/, "");

  let inches = 0;
  if (remainder.length > 0) {
    const inchMatch = /^(.*?)(?:"|in)$/i.exec(remainder);
    if (!inchMatch) return null;
    const inchText = (inchMatch[1] ?? "").trim();
    if (inchText.length === 0) return null;

    const fractionMatch = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?$/.exec(inchText);
    if (!fractionMatch) return null;
    const [, wholeText, numeratorText, denominatorText] = fractionMatch;
    if (wholeText === undefined && numeratorText === undefined) return null;

    const whole = wholeText === undefined ? 0 : Number(wholeText);
    let fraction = 0;
    if (numeratorText !== undefined && denominatorText !== undefined) {
      const denominator = Number(denominatorText);
      if (denominator === 0) return null;
      fraction = Number(numeratorText) / denominator;
    }
    inches = whole + fraction;
  } else if (footIndex === -1) {
    return null;
  }

  if (footIndex === -1 && remainder.length === 0) return null;

  const totalInches = feet * INCHES_PER_FOOT + inches;
  const signedInches = negative ? -totalInches : totalInches;
  return signedInches * MM_PER_INCH;
}

/**
 * Parses text in the given display unit back to canonical millimetres, the
 * inverse of {@link formatLengthMm}. Returns `null` for text that cannot be
 * unambiguously interpreted, rather than guessing or throwing.
 */
export function parseLengthMm(text: string, unit: DisplayLengthUnit): Millimetres | null {
  switch (unit) {
    case "mm": {
      const value = parsePlainNumber(text.trim().replace(/\s*mm$/i, ""));
      return value;
    }
    case "m": {
      const value = parsePlainNumber(text.trim().replace(/\s*m$/i, ""));
      return value === null ? null : value * 1000;
    }
    case "ft-in":
      return parseFeetInches(text);
  }
}
