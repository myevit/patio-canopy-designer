import { describe, expect, it } from "vitest";
import { formatLengthMm } from "./format-length.js";

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
