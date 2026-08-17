import { describe, expect, it } from "vitest";
import { selectEaveEdgeIndex } from "./eave-edge.js";

function rectangle() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

describe("selectEaveEdgeIndex", () => {
  it("picks the edge perpendicular to the slope direction when one exists", () => {
    // Direction +y: the y=3000 edge (vertices 2,3) projects furthest.
    expect(selectEaveEdgeIndex(rectangle(), Math.PI / 2)).toBe(2);
  });

  it("picks the edge perpendicular to a different slope direction", () => {
    // Direction +x: the x=4000 edge (vertices 1,2) projects furthest.
    expect(selectEaveEdgeIndex(rectangle(), 0)).toBe(1);
  });

  it("still returns a single well-defined edge for an arbitrary non-perpendicular direction", () => {
    const index = selectEaveEdgeIndex(rectangle(), Math.PI / 4);
    expect(index).toBe(1);
  });
});
