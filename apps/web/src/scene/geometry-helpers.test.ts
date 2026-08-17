import { describe, expect, it } from "vitest";
import { distance2D, projectPointOntoSegment } from "./geometry-helpers.js";

describe("distance2D", () => {
  it("computes planar distance ignoring z", () => {
    expect(distance2D({ x: 0, y: 0, z: 500 }, { x: 3, y: 4, z: -900 })).toBe(5);
  });
});

describe("projectPointOntoSegment", () => {
  it("projects onto the interior of a segment", () => {
    const result = projectPointOntoSegment(
      { x: 5, y: 5, z: 0 },
      { x: 0, y: 0, z: 100 },
      { x: 10, y: 0, z: 100 },
    );
    expect(result).toEqual({ x: 5, y: 0, z: 100 });
  });

  it("clamps to the start when the projection falls before it", () => {
    const result = projectPointOntoSegment(
      { x: -5, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 },
      { x: 10, y: 0, z: 100 },
    );
    expect(result).toEqual({ x: 0, y: 0, z: 100 });
  });

  it("clamps to the end when the projection falls beyond it", () => {
    const result = projectPointOntoSegment(
      { x: 15, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 },
      { x: 10, y: 0, z: 100 },
    );
    expect(result).toEqual({ x: 10, y: 0, z: 100 });
  });

  it("interpolates elevation along a sloped segment", () => {
    const result = projectPointOntoSegment(
      { x: 5, y: 0, z: 0 },
      { x: 0, y: 0, z: 100 },
      { x: 10, y: 0, z: 200 },
    );
    expect(result).toEqual({ x: 5, y: 0, z: 150 });
  });

  it("handles a zero-length segment by returning the start point", () => {
    const result = projectPointOntoSegment({ x: 5, y: 5, z: 0 }, { x: 1, y: 1, z: 50 }, { x: 1, y: 1, z: 50 });
    expect(result).toEqual({ x: 1, y: 1, z: 50 });
  });
});
