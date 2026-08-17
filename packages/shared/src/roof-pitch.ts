import type { DisplayLengthUnit } from "./format-length.js";
import type { Radians } from "./units.js";

const RUN_INCHES = 12;

function formatDegrees(pitchRad: Radians): string {
  const degrees = (pitchRad * 180) / Math.PI;
  return `${degrees.toFixed(2)}°`;
}

function formatRatio(pitchRad: Radians): string {
  const rise = Number((Math.tan(pitchRad) * RUN_INCHES).toFixed(2));
  return `${rise}:${RUN_INCHES}`;
}

/**
 * Formats a canonical pitch (radians) for display only, as either a degree
 * value or the North American rise-per-12-run construction convention,
 * depending on the document's display unit.
 */
export function formatPitch(pitchRad: Radians, unit: DisplayLengthUnit): string {
  return unit === "ft-in" ? formatRatio(pitchRad) : formatDegrees(pitchRad);
}

function parseDegrees(text: string): number | null {
  const trimmed = text.trim().replace(/°$/, "").trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseRatio(text: string): number | null {
  const match = /^(-?\d+(?:\.\d+)?)\s*(?::|\/)\s*12$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Parses text in the given display unit back to a canonical pitch in
 * radians, the inverse of {@link formatPitch}. Returns `null` for text that
 * cannot be unambiguously interpreted, rather than guessing or throwing.
 */
export function parsePitch(text: string, unit: DisplayLengthUnit): Radians | null {
  if (unit === "ft-in") {
    const rise = parseRatio(text);
    return rise === null ? null : Math.atan(rise / RUN_INCHES);
  }
  const degrees = parseDegrees(text);
  return degrees === null ? null : (degrees * Math.PI) / 180;
}
