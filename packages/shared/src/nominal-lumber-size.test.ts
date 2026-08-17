import { describe, expect, it } from "vitest";
import { formatNominalLumberSize } from "./nominal-lumber-size.js";

describe("formatNominalLumberSize", () => {
  it("recognizes a 6x6 post from its actual (dressed) millimetre dimensions", () => {
    expect(formatNominalLumberSize(140, 140)).toBe("6x6");
  });

  it("recognizes a 2x8 beam regardless of which dimension is passed first", () => {
    expect(formatNominalLumberSize(184, 38)).toBe("2x8");
    expect(formatNominalLumberSize(38, 184)).toBe("2x8");
  });

  it("recognizes a 2x4 rafter", () => {
    expect(formatNominalLumberSize(89, 38)).toBe("2x4");
  });

  it("tolerates a few millimetres of manufacturing/rounding variance", () => {
    expect(formatNominalLumberSize(90, 90)).toBe("4x4");
  });

  it("returns null for dimensions that do not correspond to a standard nominal size", () => {
    expect(formatNominalLumberSize(500, 500)).toBeNull();
  });
});
