import { describe, expect, it } from "vitest";
import { clientPointToWorld, parseViewBox } from "./plan-coordinates.js";

describe("parseViewBox", () => {
  it("parses the four numbers of an SVG viewBox string", () => {
    expect(parseViewBox("-600 -400 8400 5200")).toEqual({ minX: -600, minY: -400, width: 8400, height: 5200 });
  });
});

describe("clientPointToWorld", () => {
  const viewBox = "-600 -400 8400 5200";
  const rect = { left: 100, top: 50, width: 840, height: 520 };

  it("maps the top-left of the element rect to the viewBox origin", () => {
    expect(clientPointToWorld(viewBox, rect, 100, 50)).toEqual({ x: -600, y: -400, z: 0 });
  });

  it("maps a point 10% across and down the rect proportionally into world mm", () => {
    const result = clientPointToWorld(viewBox, rect, 100 + 84, 50 + 52);
    expect(result.x).toBeCloseTo(240, 6);
    expect(result.y).toBeCloseTo(120, 6);
    expect(result.z).toBe(0);
  });

  it("maps the bottom-right of the element rect to the far corner of the viewBox", () => {
    const result = clientPointToWorld(viewBox, rect, 100 + 840, 50 + 520);
    expect(result.x).toBeCloseTo(7800, 6);
    expect(result.y).toBeCloseTo(4800, 6);
  });
});

describe("clientPointToWorld with a non-matching aspect ratio (preserveAspectRatio='xMidYMid meet' letterboxing)", () => {
  const viewBox = "-600 -400 8400 5200";

  it("maps the rendered area's center to the viewBox center when the rect is taller than the viewBox aspect (letterboxed top/bottom)", () => {
    const rect = { left: 0, top: 0, width: 1000, height: 1000 };
    const result = clientPointToWorld(viewBox, rect, 500, 500);
    expect(result.x).toBeCloseTo(3600, 3);
    expect(result.y).toBeCloseTo(2200, 3);
  });

  it("maps the rendered area's center to the viewBox center when the rect is wider than the viewBox aspect (letterboxed left/right)", () => {
    const rect = { left: 0, top: 0, width: 2000, height: 500 };
    const result = clientPointToWorld(viewBox, rect, 1000, 250);
    expect(result.x).toBeCloseTo(3600, 3);
    expect(result.y).toBeCloseTo(2200, 3);
  });

  it("maps the rect origin outside the rendered area into world space past the viewBox edge instead of stretching into it", () => {
    // With a square rect, the rendered viewBox is letterboxed top/bottom, so
    // the rect's very top-left corner maps above the viewBox's actual top edge.
    const rect = { left: 0, top: 0, width: 1000, height: 1000 };
    const result = clientPointToWorld(viewBox, rect, 0, 0);
    expect(result.x).toBeCloseTo(-600, 3);
    expect(result.y).toBeLessThan(-400);
  });
});
