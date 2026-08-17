import { describe, expect, it } from "vitest";
import { computeMemberFrame, localToWorld, worldToLocal } from "./member-frame.js";

describe("computeMemberFrame", () => {
  it("builds a unit-length orthonormal frame along the member axis", () => {
    const frame = computeMemberFrame({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
      rollRad: 0,
    });

    expect(frame.lengthMm).toBeCloseTo(1000, 9);
    expect(frame.xAxis).toEqual({ x: 1, y: 0, z: 0 });
    // roll=0 reference: worldUp is +Z, refY = normalize(cross(worldUp, xAxis)).
    expect(frame.yAxis.x).toBeCloseTo(0, 9);
    expect(frame.zAxis.x).toBeCloseTo(0, 9);

    // Orthonormal & right-handed.
    const dotXY = frame.xAxis.x * frame.yAxis.x + frame.xAxis.y * frame.yAxis.y + frame.xAxis.z * frame.yAxis.z;
    const dotXZ = frame.xAxis.x * frame.zAxis.x + frame.xAxis.y * frame.zAxis.y + frame.xAxis.z * frame.zAxis.z;
    const dotYZ = frame.yAxis.x * frame.zAxis.x + frame.yAxis.y * frame.zAxis.y + frame.yAxis.z * frame.zAxis.z;
    expect(dotXY).toBeCloseTo(0, 9);
    expect(dotXZ).toBeCloseTo(0, 9);
    expect(dotYZ).toBeCloseTo(0, 9);
  });

  it("rotates the y/z axes about the member axis by rollRad", () => {
    const zeroRoll = computeMemberFrame({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
      rollRad: 0,
    });
    const quarterRoll = computeMemberFrame({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
      rollRad: Math.PI / 2,
    });

    // A 90-degree roll swaps the (negated) y/z reference directions.
    expect(quarterRoll.yAxis.y).toBeCloseTo(zeroRoll.zAxis.y, 9);
    expect(quarterRoll.yAxis.z).toBeCloseTo(zeroRoll.zAxis.z, 9);
    expect(quarterRoll.zAxis.y).toBeCloseTo(-zeroRoll.yAxis.y, 9);
    expect(quarterRoll.zAxis.z).toBeCloseTo(-zeroRoll.yAxis.z, 9);
  });

  it("falls back to a world-Y reference for a vertical member so the frame stays defined", () => {
    const frame = computeMemberFrame({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 2400 },
      rollRad: 0,
    });
    expect(frame.lengthMm).toBeCloseTo(2400, 9);
    expect(Number.isFinite(frame.yAxis.x)).toBe(true);
    expect(Number.isFinite(frame.zAxis.x)).toBe(true);
  });

  it("reports zero length for a degenerate (coincident-endpoint) member without throwing", () => {
    const frame = computeMemberFrame({
      start: { x: 10, y: 20, z: 30 },
      end: { x: 10, y: 20, z: 30 },
      rollRad: 0,
    });
    expect(frame.lengthMm).toBe(0);
  });
});

describe("worldToLocal / localToWorld", () => {
  it("round-trips a world point through local coordinates", () => {
    const frame = computeMemberFrame({
      start: { x: 100, y: 200, z: 300 },
      end: { x: 1100, y: 200, z: 300 },
      rollRad: 0.4,
    });
    const worldPoint = { x: 650, y: 240, z: 310 };
    const local = worldToLocal(frame, worldPoint);
    const roundTripped = localToWorld(frame, local);
    expect(roundTripped.x).toBeCloseTo(worldPoint.x, 9);
    expect(roundTripped.y).toBeCloseTo(worldPoint.y, 9);
    expect(roundTripped.z).toBeCloseTo(worldPoint.z, 9);
  });

  it("places the start point at local origin and the end point at (length, 0, 0)", () => {
    const frame = computeMemberFrame({
      start: { x: 5, y: 5, z: 5 },
      end: { x: 5, y: 5, z: 2005 },
      rollRad: 0,
    });
    const startLocal = worldToLocal(frame, { x: 5, y: 5, z: 5 });
    const endLocal = worldToLocal(frame, { x: 5, y: 5, z: 2005 });
    expect(startLocal.u).toBeCloseTo(0, 9);
    expect(startLocal.v).toBeCloseTo(0, 9);
    expect(startLocal.w).toBeCloseTo(0, 9);
    expect(endLocal.u).toBeCloseTo(2000, 9);
    expect(endLocal.v).toBeCloseTo(0, 9);
    expect(endLocal.w).toBeCloseTo(0, 9);
  });
});
