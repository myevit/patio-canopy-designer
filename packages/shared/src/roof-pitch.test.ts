import { describe, expect, it } from "vitest";
import { formatPitch, parsePitch } from "./roof-pitch.js";

const SIX_IN_TWELVE_RAD = Math.atan(6 / 12);

describe("formatPitch", () => {
  it("formats pitch as degrees when the display unit is mm", () => {
    expect(formatPitch((30 * Math.PI) / 180, "mm")).toBe("30.00°");
  });

  it("formats pitch as degrees when the display unit is m", () => {
    expect(formatPitch((30 * Math.PI) / 180, "m")).toBe("30.00°");
  });

  it("formats pitch as a North American rise-per-12-run ratio when the display unit is ft-in", () => {
    expect(formatPitch(SIX_IN_TWELVE_RAD, "ft-in")).toBe("6:12");
  });

  it("keeps a fractional rise-per-12-run ratio to two decimal places", () => {
    expect(formatPitch(Math.atan(4.25 / 12), "ft-in")).toBe("4.25:12");
  });
});

describe("parsePitch", () => {
  it("parses a degree value back to radians", () => {
    expect(parsePitch("30.00°", "mm")).toBeCloseTo((30 * Math.PI) / 180, 6);
  });

  it("parses a plain degree number without the degree symbol", () => {
    expect(parsePitch("30", "m")).toBeCloseTo((30 * Math.PI) / 180, 6);
  });

  it("rejects non-numeric degree input", () => {
    expect(parsePitch("abc", "mm")).toBeNull();
    expect(parsePitch("", "mm")).toBeNull();
  });

  it("parses a colon-separated rise-per-12-run ratio", () => {
    expect(parsePitch("6:12", "ft-in")).toBeCloseTo(SIX_IN_TWELVE_RAD, 9);
  });

  it("parses a slash-separated rise-per-12-run ratio", () => {
    expect(parsePitch("6/12", "ft-in")).toBeCloseTo(SIX_IN_TWELVE_RAD, 9);
  });

  it("rejects a ratio whose run is not 12", () => {
    expect(parsePitch("6:10", "ft-in")).toBeNull();
  });

  it("rejects malformed rise-per-12-run text", () => {
    expect(parsePitch("garbage", "ft-in")).toBeNull();
    expect(parsePitch("", "ft-in")).toBeNull();
  });

  it("round-trips formatPitch output back to the original pitch, within display precision", () => {
    const pitchRad = (26 * Math.PI) / 180;
    expect(parsePitch(formatPitch(pitchRad, "mm"), "mm")).toBeCloseTo(pitchRad, 3);
    expect(parsePitch(formatPitch(pitchRad, "ft-in"), "ft-in")).toBeCloseTo(pitchRad, 3);
  });
});
