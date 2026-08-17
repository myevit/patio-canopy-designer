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
