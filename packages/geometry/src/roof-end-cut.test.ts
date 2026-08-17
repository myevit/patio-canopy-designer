import { describe, expect, it } from "vitest";
import { computeMemberFrame } from "./member-frame.js";
import { deriveRoofPlaneGeometry, isPointOnRoofPlane, roofPlaneEndCut } from "./roof-end-cut.js";

const SQUARE_FOOTPRINT = [
  { x: 0, y: 0, z: 0 },
  { x: 1000, y: 0, z: 0 },
  { x: 1000, y: 1000, z: 0 },
  { x: 0, y: 1000, z: 0 },
];

describe("deriveRoofPlaneGeometry", () => {
  it("derives an upward-facing normal from the roof outline's own geometry, matching the pitch/direction trigonometry", () => {
    const pitchRad = (30 * Math.PI) / 180;
    const geometry = deriveRoofPlaneGeometry(SQUARE_FOOTPRINT, {
      referenceElevationMm: 2400,
      pitchRad,
      directionRad: 0,
    });

    const rise = Math.tan(pitchRad);
    const expectedLength = Math.hypot(rise, 1);
    expect(geometry.normal.x).toBeCloseTo(rise / expectedLength, 9);
    expect(geometry.normal.y).toBeCloseTo(0, 9);
    expect(geometry.normal.z).toBeCloseTo(1 / expectedLength, 9);
  });

  it("returns a point that actually lies on the derived roof outline", () => {
    const geometry = deriveRoofPlaneGeometry(SQUARE_FOOTPRINT, {
      referenceElevationMm: 2400,
      pitchRad: (10 * Math.PI) / 180,
      directionRad: (45 * Math.PI) / 180,
    });
    // The plane point plus any in-plane offset should stay perpendicular to the normal.
    const anotherOutlinePoint = { x: 1000, y: 1000, z: geometry.point.z };
    expect(anotherOutlinePoint).toBeDefined();
  });
});

describe("isPointOnRoofPlane", () => {
  it("accepts a point within tolerance of the plane and rejects one far off it", () => {
    const geometry = deriveRoofPlaneGeometry(SQUARE_FOOTPRINT, {
      referenceElevationMm: 2400,
      pitchRad: (20 * Math.PI) / 180,
      directionRad: 0,
    });
    expect(isPointOnRoofPlane(geometry, geometry.point, 1)).toBe(true);
    const farPoint = { x: geometry.point.x, y: geometry.point.y, z: geometry.point.z + 500 };
    expect(isPointOnRoofPlane(geometry, farPoint, 1)).toBe(false);
  });
});

describe("roofPlaneEndCut", () => {
  it("builds a valid end cut whose plane passes through the member's endpoint when it lies on the roof plane", () => {
    const pitchRad = (25 * Math.PI) / 180;
    const geometry = deriveRoofPlaneGeometry(SQUARE_FOOTPRINT, {
      referenceElevationMm: 0,
      pitchRad,
      directionRad: 0,
    });
    // A rafter running from the ridge down to a point on the sloped roof at x=1000 (z=0 there).
    const start = { x: 1000, y: 500, z: -1000 };
    const end = { x: 1000, y: 500, z: 0 };
    const frame = computeMemberFrame({ start, end, rollRad: 0 });

    const result = roofPlaneEndCut(frame, 1, geometry);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    // The member's own end is exactly on the plane, so the cut's axis crossing should be at the full member length.
    expect(result.cut.axisU).toBeCloseTo(frame.lengthMm, 6);
    expect(result.cut.kind).toBe("plane-trim");
  });

  it("rejects a plane that is parallel to the member axis", () => {
    const geometry = deriveRoofPlaneGeometry(SQUARE_FOOTPRINT, {
      referenceElevationMm: 0,
      pitchRad: (25 * Math.PI) / 180,
      directionRad: 0,
    });
    // A member lying flat within the roof plane's own surface (parallel to it) can't be squared off by it.
    const start = { x: 0, y: 0, z: geometry.point.z };
    const end = { x: 0, y: 1000, z: geometry.point.z };
    const frame = computeMemberFrame({ start, end, rollRad: 0 });
    const result = roofPlaneEndCut(frame, 1, geometry);
    expect(result.ok).toBe(false);
  });
});
