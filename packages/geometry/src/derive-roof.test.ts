import { describe, expect, it } from "vitest";
import type { Gutter, RoofPlane } from "@canopy/shared";
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
    pitchRad: 0,
    directionRad: 0,
    ...overrides,
  };
}

function gutter(overrides: Partial<Gutter> = {}): Gutter {
  return {
    id: "gutter-1",
    roofPlaneId: "roof-1",
    houseOutlineId: "house-1",
    edgeIndex: 2,
    widthMm: 100,
    dropMm: 50,
    ...overrides,
  };
}

describe("deriveRoofOutline", () => {
  it("places every point at the reference elevation when the pitch is zero", () => {
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ pitchRad: 0 }));
    expect(outline.every((p) => p.z === 2690)).toBe(true);
  });

  it("places the eave edge (maximum projection along direction) exactly at the reference elevation", () => {
    const outline = deriveRoofOutline(
      rectangleFootprint(),
      roofPlane({ pitchRad: (12 * Math.PI) / 180, directionRad: Math.PI / 2 }),
    );
    // y=3000 edge has the greatest projection along +y, so it is the eave.
    expect(outline[2]!.z).toBe(2690);
    expect(outline[3]!.z).toBe(2690);
  });

  it("raises points further from the eave by the pitch angle", () => {
    const pitchRad = (12 * Math.PI) / 180;
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ pitchRad, directionRad: Math.PI / 2 }));
    const expectedRise = 3000 * Math.tan(pitchRad);
    expect(outline[0]!.z).toBeCloseTo(2690 + expectedRise, 6);
    expect(outline[1]!.z).toBeCloseTo(2690 + expectedRise, 6);
  });

  it("preserves the exact 2690 mm reference elevation at the eave with no rounding", () => {
    const outline = deriveRoofOutline(rectangleFootprint(), roofPlane({ referenceElevationMm: 2690, pitchRad: 0 }));
    expect(outline[0]!.z).toBe(2690);
  });
});

describe("deriveGutter", () => {
  it("attaches the gutter to its referenced edge with the configured width and drop", () => {
    const derived = deriveGutter(rectangleFootprint(), gutter({ edgeIndex: 2 }), 2690);
    expect(derived.start.z).toBe(2690);
    expect(derived.end.z).toBe(2690);
    expect(derived.widthMm).toBe(100);
    expect(derived.dropMm).toBe(50);
    const endpointYs = [derived.start.y, derived.end.y].sort();
    expect(endpointYs).toEqual([3000, 3000]);
  });

  it("shares the same reference elevation at both endpoints even for a non-perpendicular slope direction", () => {
    // The roof plane's direction is arbitrary (not perpendicular to any edge);
    // the gutter's elevation is still fixed at the reference elevation.
    const derived = deriveGutter(rectangleFootprint(), gutter({ edgeIndex: 1 }), 2690);
    expect(derived.start.z).toBe(2690);
    expect(derived.end.z).toBe(2690);
  });

  it("wraps an out-of-range edge index onto a valid edge instead of throwing", () => {
    const derived = deriveGutter(rectangleFootprint(), gutter({ edgeIndex: 6 }), 2690);
    expect(derived.start).toBeDefined();
    expect(derived.end).toBeDefined();
  });
});
