import { describe, expect, it } from "vitest";
import type { RoofPlane } from "@canopy/shared";
import { deriveGutter, deriveRoofOutline } from "./derive-roof.js";

function rectangleFootprint() {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
}

function roofPlane(overrides: Partial<RoofPlane> = {}): RoofPlane {
  return {
    id: "roof-1",
    houseOutlineId: "house-1",
    referenceElevationMm: 2690,
    pitchDeg: 0,
    directionRad: 0,
    gutter: { widthMm: 100, dropMm: 50 },
    ...overrides,
  };
}

describe("deriveRoofOutline", () => {
  it("places every point at the reference elevation when the pitch is zero", () => {
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ pitchDeg: 0 }));
    expect(outline.every((p) => p.z === 2690)).toBe(true);
  });

  it("places the eave edge (maximum projection along direction) exactly at the reference elevation", () => {
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ pitchDeg: 12, directionRad: Math.PI / 2 }));
    // y=3000 edge has the greatest projection along +y, so it is the eave.
    expect(outline[2]!.z).toBe(2690);
    expect(outline[3]!.z).toBe(2690);
  });

  it("raises points further from the eave by the pitch angle", () => {
    const pitchDeg = 12;
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ pitchDeg, directionRad: Math.PI / 2 }));
    const expectedRise = 3000 * Math.tan((pitchDeg * Math.PI) / 180);
    expect(outline[0]!.z).toBeCloseTo(2690 + expectedRise, 6);
    expect(outline[1]!.z).toBeCloseTo(2690 + expectedRise, 6);
  });

  it("preserves the exact 2690 mm reference elevation at the eave with no rounding", () => {
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ referenceElevationMm: 2690, pitchDeg: 0 }));
    expect(outline[0]!.z).toBe(2690);
  });
});

describe("deriveGutter", () => {
  it("attaches the gutter to the eave edge with the configured width and drop", () => {
    const gutter = deriveGutter(rectangleFootprint(), roofPlane({ pitchDeg: 12, directionRad: Math.PI / 2 }));
    expect(gutter.start.z).toBe(2690);
    expect(gutter.end.z).toBe(2690);
    expect(gutter.widthMm).toBe(100);
    expect(gutter.dropMm).toBe(50);
    const endpointYs = [gutter.start.y, gutter.end.y].sort();
    expect(endpointYs).toEqual([3000, 3000]);
  });
});
