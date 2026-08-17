import { describe, expect, it } from "vitest";
import { formatNominalLumberSize, formatSectionLabel } from "./nominal-lumber-size.js";

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

describe("formatSectionLabel", () => {
  it("replaces a raw millimetre dimension prefix with the nominal size", () => {
    expect(formatSectionLabel("140x140 post", 140, 140)).toBe("6x6 post");
    expect(formatSectionLabel("184x38 beam", 184, 38)).toBe("2x8 beam");
    expect(formatSectionLabel("89x38 rafter", 89, 38)).toBe("2x4 rafter");
  });

  it("matches the raw dimension prefix regardless of width/height order", () => {
    expect(formatSectionLabel("38x184 beam", 184, 38)).toBe("2x8 beam");
  });

  it("leaves a custom name unchanged when it does not start with the raw dimensions", () => {
    expect(formatSectionLabel("Section A (140x140)", 140, 140)).toBe("Section A (140x140)");
  });

  it("leaves the name unchanged when no standard nominal size matches", () => {
    expect(formatSectionLabel("500x500 custom post", 500, 500)).toBe("500x500 custom post");
  });
});
