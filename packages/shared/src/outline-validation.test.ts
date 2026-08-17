import { describe, expect, it } from "vitest";
import { validateOutline } from "./outline-validation.js";

function pt(x: number, y: number) {
  return { x, y, z: 0 };
}

describe("validateOutline", () => {
  it("accepts a simple closed rectangle", () => {
    const result = validateOutline([pt(0, 0), pt(4000, 0), pt(4000, 3000), pt(0, 3000)]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects fewer than three points", () => {
    const result = validateOutline([pt(0, 0), pt(4000, 0)]);
    expect(result).toEqual({ valid: false, reason: "A house outline needs at least 3 points." });
  });

  it("rejects duplicate consecutive vertices", () => {
    const result = validateOutline([pt(0, 0), pt(4000, 0), pt(4000, 0), pt(4000, 3000)]);
    expect(result).toEqual({
      valid: false,
      reason: "Two consecutive vertices are in the same place. Move or remove one of them.",
    });
  });

  it("rejects a duplicate between the last and first vertex", () => {
    const result = validateOutline([pt(0, 0), pt(4000, 0), pt(4000, 3000), pt(0, 0)]);
    expect(result).toEqual({
      valid: false,
      reason: "Two consecutive vertices are in the same place. Move or remove one of them.",
    });
  });

  it("rejects a self-intersecting bowtie outline", () => {
    const result = validateOutline([pt(0, 0), pt(4000, 3000), pt(4000, 0), pt(0, 3000)]);
    expect(result).toEqual({
      valid: false,
      reason: "The outline edges cross each other. Uncross the edges before closing the outline.",
    });
  });

  it("rejects a zero-area (collinear) outline", () => {
    const result = validateOutline([pt(0, 0), pt(2000, 0), pt(4000, 0)]);
    expect(result).toEqual({
      valid: false,
      reason: "The outline encloses zero area.",
    });
  });

  it("accepts an irregular convex/concave simple polygon", () => {
    const result = validateOutline([pt(0, 0), pt(3000, 0), pt(3000, 2000), pt(1500, 1000), pt(0, 2000)]);
    expect(result).toEqual({ valid: true });
  });
});
