import { describe, expect, it } from "vitest";
import type { Vector3Mm } from "@canopy/shared";
import { triangulateFootprint } from "./triangulate-polygon.js";

function shoelaceArea(points: Vector3Mm[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function triangleArea(a: Vector3Mm, b: Vector3Mm, c: Vector3Mm): number {
  return Math.abs(a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2;
}

// A "U" shape: vertex 0 cannot see vertex 3 in a straight line without
// crossing the notch, so a naive fan-from-vertex-0 triangulation is invalid.
function uShapeFootprint(): Vector3Mm[] {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 6, y: 0, z: 0 },
    { x: 6, y: 4, z: 0 },
    { x: 4, y: 4, z: 0 },
    { x: 4, y: 2, z: 0 },
    { x: 2, y: 2, z: 0 },
    { x: 2, y: 4, z: 0 },
    { x: 0, y: 4, z: 0 },
  ];
}

describe("triangulateFootprint", () => {
  it("produces n-2 triangles for a simple polygon", () => {
    const points = uShapeFootprint();
    const triangles = triangulateFootprint(points);
    expect(triangles).toHaveLength(points.length - 2);
  });

  it("partitions a concave polygon without overlap: total triangle area equals the polygon area", () => {
    const points = uShapeFootprint();
    const triangles = triangulateFootprint(points);
    const totalArea = triangles.reduce(
      (sum, [a, b, c]) => sum + triangleArea(points[a]!, points[b]!, points[c]!),
      0,
    );
    expect(totalArea).toBeCloseTo(shoelaceArea(points), 6);
  });

  it("every triangle only uses valid vertex indices", () => {
    const points = uShapeFootprint();
    const triangles = triangulateFootprint(points);
    for (const [a, b, c] of triangles) {
      for (const index of [a, b, c]) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(points.length);
      }
    }
  });

  it("still triangulates a simple convex polygon (rectangle)", () => {
    const points: Vector3Mm[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 4, y: 3, z: 0 },
      { x: 0, y: 3, z: 0 },
    ];
    const triangles = triangulateFootprint(points);
    expect(triangles).toHaveLength(2);
    const totalArea = triangles.reduce(
      (sum, [a, b, c]) => sum + triangleArea(points[a]!, points[b]!, points[c]!),
      0,
    );
    expect(totalArea).toBeCloseTo(12, 6);
  });
});
