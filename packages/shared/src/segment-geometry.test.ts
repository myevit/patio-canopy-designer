import { describe, expect, it } from "vitest";
import { closestPointsBetweenSegments } from "./segment-geometry.js";

describe("closestPointsBetweenSegments", () => {
  it("finds an exact crossing point for two segments that intersect in a plane", () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 500, y: -500, z: 0 },
      { x: 500, y: 500, z: 0 },
    );
    expect(result.distanceMm).toBeCloseTo(0, 6);
    expect(result.pointA).toEqual({ x: 500, y: 0, z: 0 });
    expect(result.pointB).toEqual({ x: 500, y: 0, z: 0 });
  });

  it("reports the true separation for skew (non-coplanar) segments", () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 500, y: -500, z: 300 },
      { x: 500, y: 500, z: 300 },
    );
    expect(result.distanceMm).toBeCloseTo(300, 6);
  });

  it("clamps to segment endpoints when the closest approach lies outside both segments", () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 2000, y: 100, z: 0 },
      { x: 3000, y: 100, z: 0 },
    );
    expect(result.pointA).toEqual({ x: 1000, y: 0, z: 0 });
    expect(result.pointB).toEqual({ x: 2000, y: 100, z: 0 });
  });

  it("handles parallel segments without producing NaN", () => {
    const result = closestPointsBetweenSegments(
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 0, y: 200, z: 0 },
      { x: 1000, y: 200, z: 0 },
    );
    expect(Number.isFinite(result.distanceMm)).toBe(true);
    expect(result.distanceMm).toBeCloseTo(200, 6);
  });

  it("handles a degenerate (zero-length) segment", () => {
    const result = closestPointsBetweenSegments(
      { x: 500, y: 0, z: 0 },
      { x: 500, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
    );
    expect(result.distanceMm).toBeCloseTo(0, 6);
  });
});
