import { describe, expect, it } from "vitest";
import { formatLengthMm, parseLengthMm } from "./format-length.js";

describe("formatLengthMm", () => {
  it("formats millimetres as a rounded whole number", () => {
    expect(formatLengthMm(2690, "mm")).toBe("2690 mm");
    expect(formatLengthMm(2690.4, "mm")).toBe("2690 mm");
  });

  it("formats metres to three decimal places, matching the mm/m relationship exactly", () => {
    // The 2.69 m reference from the delivery plan's Milestone 1 acceptance criteria.
    expect(formatLengthMm(2690, "m")).toBe("2.690 m");
  });

  it("formats feet-inches with a fractional inch rounded to the nearest 1/16", () => {
    // 2690 mm = 105.9055... in = 8 ft 9.9055 in -> nearest 1/16 in = 9 7/8 in.
    expect(formatLengthMm(2690, "ft-in")).toBe(`8'-9 7/8"`);
  });

  it("formats a whole number of feet with no fractional remainder", () => {
    // 3048 mm = exactly 10 ft.
    expect(formatLengthMm(3048, "ft-in")).toBe(`10'-0"`);
  });

  it("never changes the underlying millimetre value it is given, only its presentation", () => {
    const mmValue = 1234.5;
    formatLengthMm(mmValue, "ft-in");
    expect(mmValue).toBe(1234.5);
  });
});

describe("parseLengthMm", () => {
  it("parses a plain millimetre number", () => {
    expect(parseLengthMm("2690", "mm")).toBe(2690);
    expect(parseLengthMm("2690.5", "mm")).toBe(2690.5);
  });

  it("rejects non-numeric or empty millimetre input", () => {
    expect(parseLengthMm("", "mm")).toBeNull();
    expect(parseLengthMm("abc", "mm")).toBeNull();
  });

  it("parses a metre number, converting to millimetres", () => {
    expect(parseLengthMm("2.69", "m")).toBeCloseTo(2690, 9);
    expect(parseLengthMm("-1.5", "m")).toBeCloseTo(-1500, 9);
  });

  it("rejects non-numeric or empty metre input", () => {
    expect(parseLengthMm("", "m")).toBeNull();
    expect(parseLengthMm("abc", "m")).toBeNull();
  });

  it("parses feet and inches with a fraction", () => {
    // 8 ft 9 7/8 in = 105.875 in = 2689.225 mm.
    expect(parseLengthMm(`8'-9 7/8"`, "ft-in")).toBeCloseTo(2689.225, 6);
  });

  it("parses a whole number of feet with zero inches", () => {
    expect(parseLengthMm(`10'-0"`, "ft-in")).toBeCloseTo(3048, 6);
  });

  it("parses feet and inches separated by a space instead of a hyphen", () => {
    expect(parseLengthMm(`8' 9"`, "ft-in")).toBeCloseTo(2667, 6);
  });

  it("parses feet and inches with no separator at all", () => {
    expect(parseLengthMm(`8'9"`, "ft-in")).toBeCloseTo(2667, 6);
  });

  it("parses inches alone", () => {
    expect(parseLengthMm(`9"`, "ft-in")).toBeCloseTo(228.6, 6);
  });

  it("parses feet alone", () => {
    expect(parseLengthMm(`8'`, "ft-in")).toBeCloseTo(2438.4, 6);
  });

  it("parses a negative feet-inches value", () => {
    expect(parseLengthMm(`-8'-9"`, "ft-in")).toBeCloseTo(-2667, 6);
  });

  it("rejects a bare number with no feet or inches marker, since it is ambiguous", () => {
    expect(parseLengthMm("9", "ft-in")).toBeNull();
  });

  it("rejects malformed feet-inches text", () => {
    expect(parseLengthMm("garbage", "ft-in")).toBeNull();
    expect(parseLengthMm("", "ft-in")).toBeNull();
    expect(parseLengthMm(`'`, "ft-in")).toBeNull();
  });

  it("round-trips formatLengthMm output back to the original millimetre value, within display precision", () => {
    expect(parseLengthMm(formatLengthMm(2690, "mm"), "mm")).toBe(2690);
    expect(parseLengthMm(formatLengthMm(2690, "m"), "m")).toBeCloseTo(2690, 0);
    expect(parseLengthMm(formatLengthMm(2690, "ft-in"), "ft-in")).toBeCloseTo(2690, -1);
  });
});
